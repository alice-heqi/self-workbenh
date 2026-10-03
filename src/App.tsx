import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigMissing } from './lib/supabase'

type FlowStep = 1 | 2 | 3 | 4
type Tab = 'setup' | 'research' | 'plan' | 'today'
type ResourceStatus = '待审核' | '已确认' | '暂缓' | '已放弃'
type Resource = { title: string; source: string; topic: string; summary: string; reason: string; minutes: number; status: ResourceStatus }
type PlanTask = { id?: string; title: string; week_number: number; estimated_minutes: number | null }

const baseStages = [
  ['第 1 周', '建立起点', '明确目标、能力盘点与安全待确认问题'], ['第 2 周', '理解 Agent 基础', '理解 Agent、模型、工具与任务之间的关系'], ['第 3 周', '完成最小练习', '用一个简单场景练习提示词与工具调用'], ['第 4 周', '分析边界', '明确目标、指标、基准与可回答问题'],
  ['第 5 周', '问题拆解', '把一个分析任务拆成可执行的步骤'], ['第 6 周', '取数与工具调用', '理解数据读取、工具选择与错误处理'], ['第 7 周', '形成回答', '练习从证据到结论的分析过程'], ['第 8 周', '真实场景准备', '梳理可用于练习的真实业务场景'], ['第 9 周', '场景复盘', '在获批范围内核对历史 campaign'], ['第 10 周', '形成交付计划', '输出搭建计划、风险和验收方式'],
]
const initialResources: Resource[] = [
  { title: 'Agent 基础概念', source: '官方资料 · 示例', topic: '理解 Agent', summary: '理解 Agent、模型、工具和任务之间的关系。', reason: '帮助建立共同语言，适合当前入门阶段。', minutes: 45, status: '待审核' },
  { title: '工具调用与错误处理', source: '官方资料 · 示例', topic: '工具调用', summary: '通过小例子理解工具选择、参数和失败处理。', reason: '对应你希望优先解决的实践问题。', minutes: 60, status: '待审核' },
  { title: 'Campaign 指标与基准', source: '手动资料 · 示例', topic: '分析边界', summary: '梳理指标、基准和可回答问题的边界。', reason: '为后续真实场景练习准备分析框架。', minutes: 50, status: '待审核' },
]
const buildResourcesForQuestion = (question: string): Resource[] => {
  const text = question.toLowerCase()
  if (text.includes('指标') || text.includes('campaign')) return [
    { title: '指标定义与口径', source: '模拟研究 · 主题匹配', topic: '指标基础', summary: '理解指标定义、统计口径和常见误读。', reason: '直接对应你优先解决的指标问题。', minutes: 45, status: '待审核' },
    { title: '基准与对比分析', source: '模拟研究 · 主题匹配', topic: '分析边界', summary: '建立基准、分组和对比分析的基本方法。', reason: '帮助把问题转成可验证的比较。', minutes: 60, status: '待审核' },
    { title: 'Campaign 结果复盘', source: '模拟研究 · 主题匹配', topic: '实践复盘', summary: '练习从数据证据回到结论和下一步行动。', reason: '把指标问题连接到实际复盘。', minutes: 70, status: '待审核' },
  ]
  if (text.includes('安全') || text.includes('权限')) return [
    { title: '数据权限与边界', source: '模拟研究 · 主题匹配', topic: '安全边界', summary: '理解数据访问范围、权限和敏感信息边界。', reason: '直接对应你优先解决的安全问题。', minutes: 45, status: '待审核' },
    { title: 'Agent 风险控制', source: '模拟研究 · 主题匹配', topic: '安全实践', summary: '识别工具调用、输出和自动化过程中的风险。', reason: '帮助建立可控的 Agent 使用方式。', minutes: 60, status: '待审核' },
    { title: '失败处理与审计', source: '模拟研究 · 主题匹配', topic: '错误处理', summary: '练习失败、回滚、记录和人工复核。', reason: '把安全要求落实到操作流程。', minutes: 70, status: '待审核' },
  ]
  return initialResources
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [dbMessage, setDbMessage] = useState('')
  const [learningNote, setLearningNote] = useState('')
  const [planVersion, setPlanVersion] = useState<number | null>(null)
  const [planUpdatedAt, setPlanUpdatedAt] = useState<string | null>(null)
  const [planTasks, setPlanTasks] = useState<PlanTask[]>([])
  const [weeklyMinutes, setWeeklyMinutes] = useState(270)
  const [priorityQuestions, setPriorityQuestions] = useState('')
  const previousResources = useRef(initialResources)
  const resetWorkspace = () => { setStep(1); setTab('setup'); setGoal(''); setPriorityQuestions(''); setSubmitted(false); setResources(initialResources); setSelectedResource(null); setResearchState('完成'); setTodayStarted(false); setTodayCompleted(false); setRecordSaved(false); setLearningNote(''); setScheduleNote(''); setDay(1); setResting(false); setCompletedDays([]); setDbMessage('') }
  const [step, setStep] = useState<FlowStep>(1); const [tab, setTab] = useState<Tab>('setup'); const [goal, setGoal] = useState(''); const [submitted, setSubmitted] = useState(false); const [archiveOpen, setArchiveOpen] = useState(false); const [resources, setResources] = useState(initialResources); const [selectedResource, setSelectedResource] = useState<string | null>(null); const [researchState, setResearchState] = useState<'完成' | '研究中' | '失败'>('完成'); const [todayStarted, setTodayStarted] = useState(false); const [todayCompleted, setTodayCompleted] = useState(false); const [recordSaved, setRecordSaved] = useState(false); const [scheduleNote, setScheduleNote] = useState(''); const [day, setDay] = useState(1); const [resting, setResting] = useState(false); const [completedDays, setCompletedDays] = useState<number[]>([])
  const stages = baseStages.map((stage, index) => {
    const confirmed = resources.filter(resource => resource.status === '已确认')
    const resource = confirmed[index % Math.max(confirmed.length, 1)]
    const goalLabel = goal.trim() ? ` · 围绕：${goal.trim().slice(0, 22)}` : ''
    const timeLabel = weeklyMinutes >= 420 ? '预计 4–5 小时' : weeklyMinutes >= 270 ? '预计 2–3 小时' : '预计 1–2 小时'
    const goalText = goal.toLowerCase()
    const focus = goalText.includes('工具') || goalText.includes('调用') ? '工具练习与错误处理' : goalText.includes('分析') || goalText.includes('指标') ? '指标拆解与证据分析' : goalText.includes('安全') ? '安全边界与风险判断' : '概念理解与小步实践'
    const depth = weeklyMinutes >= 420 ? '增加一次动手练习和一次复盘' : weeklyMinutes >= 270 ? '完成一次小练习并记录问题' : '完成核心阅读并写下要点'
    return [stage[0], resource ? `${focus}：${resource.title}` : `${focus}：${stage[1]}`, `${stage[2]}；${depth}${goalLabel} · 每周可投入 ${weeklyMinutes} 分钟 · ${timeLabel}`]
  })
  const dailyTasks = planTasks.length ? planTasks.map(task => [task.title, `来自第 ${task.week_number} 周计划 · 预计 ${task.estimated_minutes ?? 0} 分钟`]) : stages.map(stage => [stage[1], stage[2]])
  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!supabase) return
    void supabase.from('resource_candidates').select('title,source_name,topic,summary,recommendation_reason,estimated_minutes,review_status').order('created_at', { ascending: true }).then(({ data }) => {
      if (!data?.length) return
      const statusMap: Record<string, ResourceStatus> = { confirmed: '已确认', deferred: '暂缓', rejected: '已放弃', pending: '待审核' }
      setResources(data.map(resource => ({ title: resource.title, source: resource.source_name ?? '已保存资料', topic: resource.topic ?? '未分类', summary: resource.summary ?? '', reason: resource.recommendation_reason ?? '', minutes: resource.estimated_minutes ?? 0, status: statusMap[resource.review_status] ?? '待审核' })))
    })
  }, [])
  useEffect(() => {
    if (!supabase || !session) return
    void supabase.from('research_briefs').select('goal,weekly_minutes,priority_questions').order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data, error }) => {
      if (error) setDbMessage(`读取最近学习目标失败：${error.message}`)
      else if (data?.goal) { setGoal(data.goal); if (data.weekly_minutes) setWeeklyMinutes(data.weekly_minutes); if (data.priority_questions) setPriorityQuestions(data.priority_questions) }
    })
    const client = supabase
    void client.from('study_plans').select('id').eq('status', 'active').order('version', { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (data) { setStep(4); setTab('today'); void client.from('study_tasks').select('id,title,week_number,estimated_minutes').eq('study_plan_id', data.id).order('week_number').order('position').then(({ data: tasks }) => { const currentTasks = tasks ?? []; setPlanTasks(currentTasks); const taskIds = currentTasks.map(task => task.id); if (taskIds.length) void client.from('learning_sessions').select('understanding,status').in('study_task_id', taskIds).order('updated_at', { ascending: false }).limit(1).maybeSingle().then(({ data: sessionData }) => { if (sessionData?.status === 'completed') { setTodayStarted(true); setTodayCompleted(true); setRecordSaved(true); setLearningNote(sessionData.understanding ?? ''); setCompletedDays([1]) } }) }) }
    })
    void supabase.from('study_plans').select('version,updated_at').eq('status', 'active').order('version', { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (data) { setPlanVersion(data.version); setPlanUpdatedAt(data.updated_at) }
    })
  }, [session])
  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setAuthBusy(true); setAuthMessage('')
    if (!supabase) { setAuthMessage('还没有配置 Supabase 环境变量，请先填写 .env.local。'); setAuthBusy(false); return }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setAuthMessage(error ? `登录失败：${error.message}` : '登录成功。'); setAuthBusy(false)
  }
  useEffect(() => {
    const handleTimeChange = (event: Event) => {
      const target = event.target
      if (target instanceof HTMLSelectElement && target.value.includes('分钟')) {
        const match = target.value.match(/(\d+)/)
        if (match) setWeeklyMinutes(Number(match[1]))
      }
    }
    document.addEventListener('change', handleTimeChange)
    return () => document.removeEventListener('change', handleTimeChange)
  }, [])
  useEffect(() => {
    const handlePriorityChange = (event: Event) => {
      const target = event.target
      if (target instanceof HTMLInputElement && target.placeholder.includes('工具调用')) {
        setPriorityQuestions(target.value)
        if (target.value.trim()) setResources(buildResourcesForQuestion(target.value))
      }
    }
    document.addEventListener('input', handlePriorityChange)
    return () => document.removeEventListener('input', handlePriorityChange)
  }, [])
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); resetWorkspace(); setAuthMessage('已退出管理员账号，页面已回到访客初始状态。') }
  const saveResearchBrief = async () => {
    setDbMessage('正在保存…')
    if (!supabase || !session) { setSubmitted(true); setDbMessage('访客预览：本次内容未保存，刷新页面后会消失。'); go(2, 'research'); return }
    const { data: previous, error: readError } = await supabase.from('research_briefs').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (readError) { setDbMessage(`读取原记录失败：${readError.message}`); return }
    const values = { goal, current_level: '有一些相关经验', weekly_minutes: weeklyMinutes, language_preference: '中文为主，保留英文原文', priority_questions: priorityQuestions, updated_at: new Date().toISOString() }
    const { error } = previous
      ? await supabase.from('research_briefs').update(values).eq('id', previous.id)
      : await supabase.from('research_briefs').insert(values)
    setDbMessage(error ? `保存失败：${error.message}` : '已保存到 Supabase。')
    if (!error) { setSubmitted(true); go(2, 'research') }
  }
  const saveLearningSession = async () => {
    if (!supabase || !session) { setRecordSaved(true); setCompletedDays(days => days.includes(day) ? days : [...days, day]); setScheduleNote('访客预览：本次学习记录未保存，刷新页面后会消失。'); return }
    setDbMessage('正在保存学习记录…')
    const { data: previous, error: readError } = await supabase.from('learning_sessions').select('id').eq('study_task_id', currentPlanTaskId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (readError) { setScheduleNote(`读取原学习记录失败：${readError.message}`); return }
    const values = { planned_minutes: 30, actual_minutes: 30, status: 'completed', completed_at: new Date().toISOString(), understanding: learningNote || '已完成今日学习记录。', updated_at: new Date().toISOString() }
    const { error } = previous
      ? await supabase.from('learning_sessions').update(values).eq('id', previous.id)
      : await supabase.from('learning_sessions').insert({ ...values, study_task_id: currentPlanTaskId })
    if (error) setScheduleNote(`保存失败：${error.message}`)
    else { setRecordSaved(true); setCompletedDays(days => days.includes(day) ? days : [...days, day]); setDbMessage('学习记录已保存到 Supabase。') }
  }
  const updateResourceStatus = async (resource: Resource, status: ResourceStatus) => {
    setResources(items => items.map(item => item.title === resource.title ? { ...item, status } : item))
    if (!supabase || !session) { setDbMessage('访客预览：资料状态未保存，刷新页面后会消失。'); return }
    const reviewStatus = status === '已确认' ? 'confirmed' : status === '暂缓' ? 'deferred' : status === '已放弃' ? 'rejected' : 'pending'
    const { data: previous, error: readError } = await supabase.from('resource_candidates').select('id').eq('title', resource.title).limit(1).maybeSingle()
    if (readError) { setDbMessage(`读取资料失败：${readError.message}`); return }
    const values = { title: resource.title, topic: resource.topic, summary: resource.summary, recommendation_reason: resource.reason, estimated_minutes: resource.minutes, review_status: reviewStatus, updated_at: new Date().toISOString() }
    const { error } = previous
      ? await supabase.from('resource_candidates').update(values).eq('id', previous.id)
      : await supabase.from('resource_candidates').insert(values)
    setDbMessage(error ? `资料状态保存失败：${error.message}` : '资料状态已保存到 Supabase。')
  }
  // The persistence helper is intentionally kept stable for this small mock-to-Supabase bridge.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!supabase || !session) { previousResources.current = resources; return }
    const changed = resources.filter((resource, index) => resource.status !== previousResources.current[index]?.status)
    previousResources.current = resources
    changed.forEach(resource => { void updateResourceStatus(resource, resource.status) })
  }, [resources, session])
  const activatePlan = async () => {
    if (!supabase || !session) { go(4, 'today'); setDbMessage('访客预览：计划没有保存，刷新页面后会消失。'); return }
    setDbMessage('正在保存新计划…')
    const { error: archiveError } = await supabase.from('study_plans').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('status', 'active')
    if (archiveError) { setDbMessage(`旧计划归档失败：${archiveError.message}`); return }
    const { data: latest } = await supabase.from('study_plans').select('version').order('version', { ascending: false }).limit(1).maybeSingle()
    const nextVersion = (latest?.version ?? 0) + 1
    const confirmedAt = new Date().toISOString()
    const confirmedResources = resources.filter(resource => resource.status === '已确认')
    const planName = goal.trim() ? `围绕“${goal.trim().slice(0, 24)}”的学习计划` : '我的学习计划'
    const { data: newPlan, error } = await supabase.from('study_plans').insert({ name: planName, status: 'active', version: nextVersion, weekly_budget_minutes: weeklyMinutes, confirmed_at: confirmedAt }).select('id,version,updated_at').single()
    if (error) { setDbMessage(`新计划保存失败：${error.message}`); return }
    const taskRows = stages.map((stage, index) => {
      const resource = confirmedResources[index % Math.max(confirmedResources.length, 1)]
      const resourceLabel = resource ? ` · 对应资料：${resource.title}` : ''
      return { study_plan_id: newPlan.id, week_number: index + 1, title: `${stage[1]}${resourceLabel}`, purpose: `${stage[2]}${goal.trim() ? ` 当前目标：${goal.trim()}` : ''}`, resource_id: null, estimated_minutes: Math.round(weeklyMinutes / 2), completion_criteria: `完成第 ${index + 1} 周学习目标`, position: 1 }
    })
    const { data: savedTasks, error: taskError } = await supabase.from('study_tasks').insert(taskRows).select('id,title,week_number,estimated_minutes')
    if (taskError) { setDbMessage(`计划任务保存失败：${taskError.message}`); return }
    setPlanTasks(savedTasks ?? []); setTodayStarted(false); setTodayCompleted(false); setRecordSaved(false); setLearningNote(''); setCompletedDays([])
    setPlanVersion(newPlan.version); setPlanUpdatedAt(newPlan.updated_at)
    setDbMessage('新计划已确认并生效。'); go(4, 'today')
  }
  const currentTask = planTasks.length ? [planTasks[(day - 1) % planTasks.length].title, `来自第 ${planTasks[(day - 1) % planTasks.length].week_number} 周计划 · 预计 ${planTasks[(day - 1) % planTasks.length].estimated_minutes ?? 0} 分钟`] : dailyTasks[(day - 1) % dailyTasks.length]
  const currentPlanTaskId = planTasks.length ? planTasks[(day - 1) % planTasks.length].id : '00000000-0000-0000-0000-000000000041'
  const advanceDay = () => { setCompletedDays(days => days.includes(day) ? days : [...days, day]); setDay(value => value + 1); setTodayStarted(false); setTodayCompleted(false); setRecordSaved(false); setResting(false); setScheduleNote('') }
  const go = (next: FlowStep, nextTab: Tab) => { setStep(next); setTab(nextTab) }
  const tabs: [Tab, string][] = [['setup', '建立起点'], ['research', '资料收集'], ['plan', '学习计划'], ['today', '今日启动']]
  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">A</span><span>Agent Study Lab</span></div><div className="auth-area">{session ? <><span className="auth-status">管理员已登录</span><button className="text-button" type="button" onClick={() => void signOut()}>退出</button></> : <button className="text-button" type="button" onClick={() => setAuthOpen(value => !value)}>管理员登录</button>}<span className="step-tag">公开浏览 · 管理员写入</span></div></header>
    {authOpen && !session && <section className="auth-panel"><h2>管理员登录</h2><p>访客无需登录；这里只供你管理学习工作台。</p><form onSubmit={signIn} className="auth-form"><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="管理员邮箱" required /><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="密码" required /><button className="primary-button" type="submit" disabled={authBusy}>{authBusy ? '登录中…' : '登录'}</button></form>{supabaseConfigMissing && <p className="auth-warning">当前还未配置 `.env.local`，登录暂时不会成功。</p>}{authMessage && <p className="auth-message">{authMessage}</p>}</section>}
    <section className="hero compact"><div className="eyebrow">START YOUR LEARNING PLAN</div><h1>先明晰计划，<br /><em>再开始学习。</em></h1><p>把你的目标、基础和可投入时间告诉我。我会先收集合适的资料，再制作一份由你确认的学习计划。</p></section>
    {step < 4 && <><div className="start-intro"><span className="start-kicker">LET'S START</span></div><div className="flow-steps" aria-label="Let's start 学习计划流程">{[['1', '输入条件'], ['2', '收集资料'], ['3', '确认计划']].map(([number, label], index) => { const current = index + 1; return <button key={number} type="button" className={step === current ? 'flow-step current' : step > current ? 'flow-step done' : 'flow-step'} onClick={() => current <= step && go(current as FlowStep, tabs[index][0])}><span>{step > current ? '✓' : number}</span>{label}</button> })}</div></>}
    {step >= 4 && <section className={archiveOpen ? 'archive open' : 'archive'}><div className="archive-controls"><button type="button" className="archive-toggle" onClick={() => setArchiveOpen(value => !value)}><span><strong>查看学习计划</strong></span><span className="archive-chevron">⌄</span></button><button type="button" className="archive-edit" onClick={() => go(1, 'setup')}>修改计划</button></div>{archiveOpen && <div className="archive-body"><div className="archive-steps"><span className="status">当前已确认计划{planVersion ? ` · 第 ${planVersion} 版` : ''}</span><span className="status">每周预算：270 分钟</span></div><p>这里仅查看当前计划记录，不会改变今天的学习。需要修改时，请点击旁边的“修改计划”，从起点重新填写。</p>{planUpdatedAt && <p className="plan-updated">最近更新：{new Date(planUpdatedAt).toLocaleString('zh-CN')}</p>}<div className="archive-plan-list">{planTasks.length ? planTasks.map(task => <div className="archive-plan-row" key={`${task.week_number}-${task.title}`}><strong>第 {task.week_number} 周 · {task.title}</strong><span>预计 {task.estimated_minutes ?? 0} 分钟</span></div>) : stages.map(stage => <div className="archive-plan-row" key={stage[0]}><strong>{stage[0]} · {stage[1]}</strong><span>{stage[2]} · 预计 2–3 小时</span></div>)}</div></div>}</section>}
    {step < 4 && <nav className="tabs" aria-label="工作台页面">{tabs.slice(0, 3).map(([key, label]) => <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => { if (key === 'setup' || (key === 'research' && submitted) || (key === 'plan' && step >= 3)) setTab(key) }}>{label}</button>)}</nav>}
    {tab === 'setup' && <section className="panel setup-panel"><div className="panel-number">STEP 01 / 输入学习条件</div><h2>先告诉我，你想从哪里开始</h2><p>这些信息会帮助我筛选资料，并把学习计划安排在你的真实时间里。</p><div className="form-grid"><label className="full">你的学习目标<textarea value={goal} onChange={event => setGoal(event.target.value)} placeholder="例如：我想理解 Analytics Agent 的工作方式，并做出一个安全可控的最小原型。" /></label><label>现有基础<select defaultValue="有一些相关经验"><option>刚开始了解</option><option>有一些相关经验</option><option>已经做过项目</option></select></label><label>每周可投入时间<select defaultValue="每周约 270 分钟"><option>每周约 120 分钟</option><option>每周约 270 分钟</option><option>每周约 420 分钟</option></select></label><label>资料偏好<select defaultValue="中文为主，保留英文原文"><option>中文为主，保留英文原文</option><option>英文原文优先</option><option>短文与视频优先</option></select></label><label>希望优先解决的问题<input placeholder="例如：工具调用、指标口径、安全边界" /></label></div><div className="form-actions"><span>{dbMessage || '提交后先进入资料收集，不会直接生成计划。'}</span><button className="primary-button" disabled={!goal.trim()} onClick={() => void saveResearchBrief()}>保存条件，开始收集资料 <span>→</span></button></div></section>}
    {tab === 'research' && <section className="panel list-panel"><div className="panel-number">STEP 02 / 资料收集</div><h2>围绕你的目标，找到值得学习的资料</h2><p>这是一次模拟研究结果。打开条目查看主旨、理由和来源，再决定是否纳入计划。</p><div className="research-banner"><span className="spinner">✦</span><div><strong>{researchState === '研究中' ? '正在整理 3 个主题…' : researchState === '失败' ? '研究暂时失败' : '已根据你的学习条件整理 3 个主题'}</strong><small>Agent 基础 · 工具调用 · 分析边界</small></div><span className="status">{researchState}</span></div>{researchState === '失败' && <div className="error-box">模拟网络错误：之前的有效结果仍保留。<button className="text-button" onClick={() => setResearchState('研究中')}>重试研究</button></div>}<div className="stage-list">{resources.map(resource => <div className="stage-row resource-row" key={resource.title} onClick={() => setSelectedResource(selectedResource === resource.title ? null : resource.title)}><span className="resource-icon">↗</span><div><strong>{resource.title}</strong><small>{resource.source} · {resource.topic} · {resource.minutes} 分钟</small>{selectedResource === resource.title && <div className="resource-detail"><p>{resource.summary}</p><small>推荐理由：{resource.reason}</small><div className="resource-actions"><button onClick={event => { event.stopPropagation(); setResources(items => items.map(item => item.title === resource.title ? { ...item, status: '已确认' } : item)) }}>确认</button><button onClick={event => { event.stopPropagation(); setResources(items => items.map(item => item.title === resource.title ? { ...item, status: '暂缓' } : item)) }}>暂缓</button><button onClick={event => { event.stopPropagation(); setResources(items => items.map(item => item.title === resource.title ? { ...item, status: '已放弃' } : item)) }}>放弃</button></div></div>}</div><span className="status">{resource.status}</span></div>)}</div><div className="form-actions"><span>已确认 {resources.filter(resource => resource.status === '已确认').length} 条资料 · 只有确认项会进入计划。</span><button className="primary-button" onClick={() => go(3, 'plan')}>用这些资料制作计划 <span>→</span></button></div></section>}
    {tab === 'plan' && <section className="panel plan-panel"><div className="panel-number">STEP 03 / 修改并确认学习计划</div><h2>先修改，再生成新的计划版本</h2><p>当前计划不会立即改变。确认后，新计划才会成为之后的“今日学习”。旧计划会保留为历史版本。</p><div className="plan-summary"><div><small>学习目标</small><strong>{goal || '理解 Analytics Agent 并完成一个最小实践'}</strong></div><div><small>时间预算</small><strong>每周 {(weeklyMinutes / 60).toFixed(1)} 小时</strong></div><div><small>已纳入资料</small><strong>{resources.filter(resource => resource.status === '已确认').length || 3} 条</strong></div></div><div className="budget-note">这是新的计划草稿。第 5 周预计 {Math.round(weeklyMinutes * 1.1)} 分钟，当前每周预算为 {weeklyMinutes} 分钟。</div><div className="stage-list">{stages.map(stage => <div className="stage-row" key={stage[0]}><span className="week">{stage[0]}</span><div><strong>{stage[1]}</strong><small>{stage[2]}</small></div><span className="status">新草稿</span></div>)}</div><div className="form-actions"><button className="text-button" onClick={() => go(4, 'today')}>← 返回今日学习</button><button className="primary-button" onClick={() => void activatePlan()}>确认新计划并开始学习 <span>→</span></button></div></section>}
    {tab === 'today' && <section className="grid"><article className="panel primary"><div className="panel-number">本周学习计划 / WEEK 01{planVersion ? ` · 第 ${planVersion} 版` : ''}</div><h2>{planTasks.length ? '当前学习计划' : 'Agent 基础'}</h2><div className="today-date">2026 年 10 月 2 日 · 星期五</div><p>本周目标：{goal || '建立对 Agent 的整体理解'} · 每周预算 {weeklyMinutes} 分钟。</p><div className="week-tasks">{(planTasks.length ? planTasks.slice(0, 3) : dailyTasks.slice(0, 3).map((task, index) => ({ title: task[0], week_number: index + 1 }))).map((task, index) => <div key={task.title}><span>{completedDays.includes(index + 1) ? '✓' : '○'}</span>{task.title}</div>)}</div><div className="progress"><span className={completedDays.length ? 'progress-complete' : ''} /></div><div className="meta"><span>本周进度</span><strong>{completedDays.length} / {Math.min(planTasks.length || 3, 3)} 项</strong></div></article><article className="panel"><div className="panel-number">WEEK 01 / DAY 0{day}</div><h2>今天学什么</h2>{scheduleNote && <div className="schedule-note">{scheduleNote}</div>}{!todayStarted && <div className="review-card"><strong>{day === 1 ? '今天是学习的第一天，享受当下吧。' : `今天是学习的第 ${day} 天，继续保持自己的节奏。`}</strong><p>完成今天的学习后，再回来记录你的理解、疑问和练习结果。</p></div>} {todayStarted && <div className="review-card"><span className="review-label">学习回顾</span><strong>{day === 1 ? '这是你的第一天，目前还没有过去的学习记录。' : '回顾昨天的学习记录，再开始今天的内容。'}</strong><p>今天先专注于当前任务，完成后再记录新的发现。</p></div>}<div className="today-task"><span>0{day}</span><div><strong>{currentTask[0]}</strong><small>{currentTask[1]}</small></div></div><div className="schedule-actions"><button onClick={() => { if (resting) advanceDay(); else if (!todayCompleted) setScheduleNote('先完成今天的份额哦'); else if (!recordSaved) setScheduleNote('先保存今天的学习记录哦'); else advanceDay() }}>提前学习</button></div>{!todayStarted && !resting && <button className="primary-button full-button" onClick={() => setTodayStarted(true)}>开始今日学习 <span>→</span></button>}{todayStarted && !todayCompleted && <button className="primary-button full-button" onClick={() => setTodayCompleted(true)}>完成今日计划，填写学习记录 <span>→</span></button>}{todayCompleted && !recordSaved && <div className="record-after-task"><div className="panel-number">完成今日计划 / 保存学习记录</div><textarea className="record-input" value={learningNote} onChange={event => setLearningNote(event.target.value)} placeholder="记录今天学会了什么、还不清楚什么，以及练习结果" /><button className="primary-button full-button" onClick={() => void saveLearningSession()}>保存今日学习记录 <span>→</span></button></div>}{recordSaved && !resting && <div className="next-day"><div className="saved-note">已保存本次学习记录。</div><strong>是否进入下一天？</strong><div><button onClick={advanceDay}>是，继续学习</button><button onClick={() => setResting(true)}>否，先休息</button></div></div>}{resting && <div className="saved-note">学习完成，可以休息啦。想提前开始下一天吗？</div>}</article></section>}
    <footer>依据 Project Brief · 本地模拟版本 · 数据不会保存</footer>
  </main>
}
export default App
