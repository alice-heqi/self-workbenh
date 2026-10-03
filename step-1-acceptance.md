# Step 1 验收记录：Supabase 数据库基础

日期：2026-10-02

## 项目

- Supabase 项目引用：`goubrgyarpnvoictbdws`
- 项目地址：`https://goubrgyarpnvoictbdws.supabase.co`
- 管理方式：Supabase Dashboard
- 本地开发环境：React + Vite，`http://127.0.0.1:5173/`

## 已完成检查

- [x] 10 张基础表已建立。
- [x] 表之间的关联和测试数据可以正常保存、读取。
- [x] 10 张表均已启用 RLS。
- [x] 10 张表均有公开 `SELECT` 策略，`anon` 和 `authenticated` 可以读取。
- [x] 没有 `INSERT`、`UPDATE`、`DELETE` 的公开策略。
- [x] 使用公开 key 读取测试资料成功。
- [x] 使用公开 key 新增测试资料返回 `HTTP/2 401`，新增被拒绝。
- [x] 使用公开 key 删除测试资料返回 `HTTP/2 204`，但随后仍能读取原资料，确认没有实际删除。
- [x] `.env.example` 已建立；真实密钥没有写入仓库。

## 说明

Supabase 的 `204` 不一定表示删除成功。此次请求结束后，测试资料仍然存在，因此删除实际被 RLS 阻止。

测试数据文件：`supabase/seed.sql`
迁移文件：`supabase/migrations/20261002000000_initial_schema.sql`

## 尚未完成

- [ ] 单独记录一次公开 key 的修改请求测试结果。
- [ ] 将服务端密钥配置到后续实际使用的 Supabase Edge Function secret。
- [ ] 在本机安装或配置 Supabase CLI，并执行正式迁移命令（当前迁移已通过 Dashboard SQL Editor 执行）。
