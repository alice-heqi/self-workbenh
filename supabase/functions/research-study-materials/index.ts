const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ResearchRequest = {
  action?: 'research' | 'generate_plan'
  researchBriefId?: string
  diagnosticMode?: 'text' | 'web_search'
  goal?: string
  currentLevel?: string
  weeklyMinutes?: number
  languagePreference?: string
  priorityQuestions?: string
  resources?: { title: string; url: string; summary?: string }[]
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isValidRequest(body: ResearchRequest) {
  return typeof body.goal === 'string' && body.goal.trim().length >= 3
}

function extractChatResult(response: any) {
  const content = response.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('\n').trim()
  }
  return ''
}

function extractSources(response: any, text: string) {
  const sources = new Map<string, { title: string; url: string }>()
  const annotations = response.choices?.[0]?.message?.annotations ?? []
  for (const annotation of annotations) {
    const citation = annotation.url_citation ?? annotation
    if ((annotation.type === 'url_citation' || citation.type === 'url_citation') && typeof citation.url === 'string') {
      sources.set(citation.url, {
        title: citation.title || citation.url,
        url: citation.url,
      })
    }
  }

  const markdownLink = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
  for (const match of text.matchAll(markdownLink)) {
    if (!sources.has(match[2])) sources.set(match[2], { title: match[1], url: match[2] })
  }
  if (!sources.size) {
    const urls = text.match(/https?:\/\/[^\s)\]}>,]+/g) ?? []
    for (const url of urls) sources.set(url, { title: url, url })
  }
  return [...sources.values()]
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: '只接受 POST 请求' }, 405)

  const authHeader = request.headers.get('Authorization')
  const isAdminRequest = Boolean(authHeader?.startsWith('Bearer '))

  let body: ResearchRequest
  try {
    body = await request.json()
  } catch {
    return json({ error: '请求内容不是有效 JSON' }, 400)
  }

  if (!isValidRequest(body)) return json({ error: '至少需要填写 3 个字的学习目标' }, 400)

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return json({ error: '服务端还没有配置 API Key' }, 500)

  const diagnosticMode = body.diagnosticMode
  const generatePlan = body.action === 'generate_plan'
  const researchPrompt = generatePlan
    ? [
      '你是一位务实的个性化学习计划设计师。请仅依据用户提供的目标、时间和资料，生成一个循序渐进的 10 周学习计划。',
      '必须返回纯 JSON，不要 Markdown 代码围栏或额外说明，格式为：{"tasks":[{"weekNumber":1,"title":"...","purpose":"...","resourceTitle":"...","estimatedMinutes":120,"completionCriteria":"..."}]}。',
      '要求：恰好 10 周；每周内容具体且不同，先基础后练习再综合；每周分钟数为正整数且不超过用户每周预算；引用资料时 resourceTitle 必须选自给定资料标题，无法匹配时写空字符串；不得虚构资料标题、链接、事实或学习内容。',
      '每周目标和内容都要不同，按基础→练习→综合递进。purpose 与 completionCriteria 各用一句简短中文（建议各不超过 45 字），不要输出长篇解释，以确保 JSON 完整。',
      `学习目标：${body.goal!.trim()}`,
      `已有基础：${body.currentLevel ?? '未填写'}`,
      `每周可投入分钟：${body.weeklyMinutes ?? 270}`,
      `优先问题：${body.priorityQuestions ?? '未填写'}`,
      `可用资料（仅可从这里选）：${JSON.stringify(body.resources ?? [])}`,
    ].join('\n')
    : diagnosticMode === 'text'
    ? '请只回复：普通文本请求成功。'
    : [
    '你是学习资料研究助手。请围绕用户的学习目标，进行一次真实联网资料搜索。',
    '只推荐公开可访问、来源清楚、适合学习的资料。优先官方文档、标准、论文和高质量技术资料。',
    '请用中文简洁回答：先用 2 句话总结学习方向，再列出最多 3 条资料。每条只需标题、来源链接、适合学习什么和推荐理由。',
    '每条资料都必须附上可访问的原始网址；不要编造来源。',
    `用户学习目标：${body.goal.trim()}`,
    `已有基础：${body.currentLevel ?? '未填写'}`,
    `每周时间：${body.weeklyMinutes ?? '未填写'} 分钟`,
    `优先问题：${body.priorityQuestions ?? '未填写'}`,
    `语言偏好：${body.languagePreference ?? '中文为主，保留英文原文'}`,
    ].join('\n')

  let apiResponse: Response
  try {
    apiResponse = await fetch('https://api.tu-zi.com/v1/chat/completions', {
      signal: AbortSignal.timeout(120000),
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5-search-api',
        messages: [{ role: 'user', content: researchPrompt }],
        stream: false,
        temperature: 0.7,
        max_tokens: generatePlan ? 4096 : 512,
      }),
    })
  } catch (error) {
    console.error('Tu-zi network error', error)
    const message = error instanceof Error ? error.message : String(error)
    return json({
      ok: false,
      diagnosticMode: diagnosticMode ?? 'web_search',
      failureStage: 'network_or_timeout',
      detail: message,
      error: 'Tu-zi 搜索模型没有在 120 秒内返回响应',
    }, diagnosticMode ? 200 : 502)
  }

  if (!apiResponse.ok) {
    const detail = await apiResponse.text()
    console.error('Tu-zi research failed', detail)
    const failure = {
      ok: false,
      diagnosticMode: diagnosticMode ?? 'web_search',
      failureStage: 'tuzi_http_response',
      upstreamStatus: apiResponse.status,
      upstreamDetail: detail.slice(0, 2000),
      error: 'Tu-zi 返回了错误响应',
    }
    return json(failure, diagnosticMode ? 200 : 502)
  }

  let response: any
  try {
    response = await apiResponse.json()
  } catch (error) {
    console.error('Tu-zi returned invalid JSON', error)
    return json({ error: '研究服务返回了无法解析的结果' }, 502)
  }

  let result: string
  let sources: { title: string; url: string }[]
  try {
    result = extractChatResult(response)
    sources = extractSources(response, result)
  } catch (error) {
    console.error('Unable to parse Tu-zi response', error)
    return json({ error: '研究结果格式暂时无法识别' }, 502)
  }
  if (!result) {
    return json({
      ok: false,
      diagnosticMode: diagnosticMode ?? null,
      failureStage: 'empty_chat_response',
      error: '搜索模型返回成功状态，但回答内容为空',
    }, diagnosticMode ? 200 : 502)
  }
  if (generatePlan) {
    const finishReason = response.choices?.[0]?.finish_reason
    if (finishReason === 'length') {
      return json({
        ok: false,
        action: 'generate_plan',
        failureStage: 'plan_output_truncated',
        error: 'AI 计划回复被截断了，请重新生成',
        detail: '模型触及输出长度上限；已增加计划输出预算，请重试。',
      }, 502)
    }
    try {
      const normalized = result.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const firstBrace = normalized.indexOf('{')
      const lastBrace = normalized.lastIndexOf('}')
      if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error('回复中没有完整的 JSON 对象')
      const parsed = JSON.parse(normalized.slice(firstBrace, lastBrace + 1))
      const tasks = parsed.tasks
      if (!Array.isArray(tasks) || tasks.length !== 10) throw new Error('计划必须包含 10 周')
      const cleanTasks = tasks.map((task: any, index: number) => {
        const weekNumber = Number(task.weekNumber)
        const estimatedMinutes = Number(task.estimatedMinutes)
        if (weekNumber !== index + 1 || typeof task.title !== 'string' || !task.title.trim() ||
            typeof task.purpose !== 'string' || !task.purpose.trim() ||
            !Number.isInteger(estimatedMinutes) || estimatedMinutes < 1 ||
            estimatedMinutes > (body.weeklyMinutes ?? 270) || typeof task.completionCriteria !== 'string' || !task.completionCriteria.trim()) {
          throw new Error(`第 ${index + 1} 周内容不完整或超出时间预算`)
        }
        const requestedTitle = typeof task.resourceTitle === 'string' ? task.resourceTitle.trim() : ''
        const availableResources = body.resources ?? []
        const matchedResource = availableResources.find((resource) => {
          const availableTitle = resource.title.trim().toLowerCase()
          return availableTitle === requestedTitle.toLowerCase()
        })
        if (requestedTitle && !matchedResource) {
          throw new Error(`第 ${index + 1} 周引用了未提供的资料`)
        }
        const resourceTitle = matchedResource?.title ?? ''
        return { weekNumber, title: task.title.trim(), purpose: task.purpose.trim(), resourceTitle, estimatedMinutes, completionCriteria: task.completionCriteria.trim() }
      })
      return json({ ok: true, status: 'completed', action: 'generate_plan', upstreamStatus: apiResponse.status, tasks: cleanTasks })
    } catch (error) {
      console.error('Tu-zi returned invalid study plan JSON', error, { finishReason, resultLength: result.length })
      return json({ ok: false, action: 'generate_plan', error: 'AI 返回的计划格式不完整，请重新生成', detail: error instanceof Error ? error.message : String(error) }, 502)
    }
  }
  return json({
    ok: true,
    status: 'completed',
    diagnosticMode: diagnosticMode ?? null,
    upstreamStatus: apiResponse.status,
    researchRunId: null,
    result,
    sources,
    requestedBy: isAdminRequest ? 'authenticated-admin' : null,
    researchBriefId: body.researchBriefId ?? null,
  })
})
