# Analytics Agent 学习工作台

这是依据 `brief.md` 与 `plan.md` 建立的 React + Vite + TypeScript 前端项目。当前已完成 Step 0 的模拟数据页面，并已记录 Step 1 使用的 Supabase 项目。

## Supabase 项目

- 项目引用（project ref）：`goubrgyarpnvoictbdws`
- 项目地址：<https://goubrgyarpnvoictbdws.supabase.co>
- 管理方式：通过 [Supabase Dashboard](https://supabase.com/dashboard/project/goubrgyarpnvoictbdws) 管理数据库、认证、迁移和项目设置。
- 开发环境：本地 React + Vite 开发服务器，地址为 `http://127.0.0.1:5173/`；后续通过环境变量连接上述 Supabase 项目。
- 当前权限方案：访客可浏览全部内容；未登录访客不能新增、修改或删除；管理员后续通过登录或 Supabase Dashboard 管理数据。
- 数据库迁移：`supabase/migrations/20261002000000_initial_schema.sql`，包含第一阶段 10 张基础表、关联、索引和公开只读 RLS 规则。

## 环境变量

环境变量模板位于 `.env.example`。复制为本地 `.env.local` 后再填写实际值；`.env.local` 已被 Git 忽略，不应提交。

- `VITE_SUPABASE_URL`：Supabase 项目地址，可用于前端连接。
- `VITE_SUPABASE_ANON_KEY`：Supabase 公开号，可用于前端连接。
- `SUPABASE_SERVICE_ROLE_KEY`：服务端专用密钥，当前不放入前端；后续服务端功能应配置在 Supabase secret 中。

开发验收测试数据位于 `supabase/seed.sql`，只包含测试内容，不是真实学习资料。

不要把 Supabase service role key 或其他真实密钥写入 Git、README 或前端代码。

## 本地启动

```bash
npm install
npm run dev
```

访问 <http://127.0.0.1:5173/>。

## 验证

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

页面中的学习路线、资料和启动卡都是模拟数据，不会保存。后续步骤再实现资料研究、计划和学习记录。
