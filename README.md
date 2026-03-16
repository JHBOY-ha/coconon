# coconon

`coconon` 是一个单用户、本地部署的 Bilibili 观看历史分析工具。它会：

- 保存并加密你的 Bilibili `Cookie`
- 定时拉取观看历史
- 给视频打主题标签
- 按天生成观看报告
- 对比前一天，输出信息茧房风险分数

## Stack

- `Next.js 16` + App Router
- `better-sqlite3` 本地 SQLite 持久化
- `node-cron` 定时任务
- `OpenAI-compatible` LLM 接口
- `Vitest` 纯逻辑测试

## Run

1. 安装依赖

```bash
npm install
```

2. 复制环境变量

```bash
cp .env.example .env
```

3. 启动开发环境

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。
首次启动时应用会自动创建本地 SQLite 表、默认配置和空的 Bilibili 凭证记录。

## Environment

- `DATABASE_URL`: SQLite 文件路径，默认 `file:./dev.db`
- `COCONON_ENCRYPTION_KEY`: 用于加密 Cookie / LLM key 的密钥
- `COCONON_LLM_BASE_URL`: 兼容 OpenAI 的接口地址
- `COCONON_LLM_MODEL`: 默认模型名

如果没有配置 LLM Key，系统仍可运行，只是会退回模板文案而不是模型生成文案。

## Main pages

- `/`: 仪表盘，查看最新日报、状态和快捷操作
- `/settings`: 录入 Cookie、LLM 配置、定时策略
- `/jobs`: 查看同步/分析任务执行历史
- `/reports/[date]`: 查看某一天的详细报告

## APIs

- `POST /api/settings/cookie`
- `POST /api/settings/llm`
- `POST /api/sync/run`
- `POST /api/reports/run`
- `GET /api/reports/[date]`
- `GET /api/dashboard/summary`

## Verification

```bash
npm run lint
npm run test
npm run build
```

建议部署在本机或内网环境，不要把当前版本直接暴露到公网。
