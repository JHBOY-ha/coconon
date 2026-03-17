# coconon

`coconon` 是一个单用户、本地部署的 Bilibili 观看历史分析应用。

它会自动拉取你的观看历史，按天聚合观看行为，计算内容收窄趋势，并生成一份“今天是否更容易陷入信息茧房”的日报。

> [!IMPORTANT]
> 当前版本面向本机或内网环境设计，不建议直接暴露到公网。

## 你可以用它做什么

- 自动同步 Bilibili 观看历史
- 每天生成一份观看日报
- 对比前一天，观察内容是否更集中
- 输出信息茧房分数、风险等级和证据
- 手动补跑同步、重算日报、查看任务历史

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 准备环境变量

```bash
cp .env.example .env
```

可用环境变量：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `DATABASE_URL` | SQLite 文件路径 | `file:./dev.db` |
| `COCONON_ENCRYPTION_KEY` | 用于加密 Cookie / LLM Key | 无 |
| `COCONON_LLM_BASE_URL` | 默认 LLM 接口地址 | `https://api.openai.com/v1` |
| `COCONON_LLM_MODEL` | 默认模型名 | `gpt-4o-mini` |

### 3. 启动开发环境

```bash
npm run dev
```

打开 `http://localhost:3000`。

> [!NOTE]
> 首次启动时，应用会自动创建本地表结构、默认配置和空的 Bilibili 凭证记录。

## 首次使用流程

### 1. 配置 Bilibili Cookie

打开 `/settings`，在 **Bilibili Cookie** 区域填写：

- `SESSDATA`，必填
- `bili_jct`，推荐填写
- `DedeUserID`，推荐填写

你也可以先点 **测试 Cookie**：

- 默认优先测试当前已保存 Cookie
- 如果当前还没有保存 Cookie，才会用输入框里的值临时组装测试

### 2. 配置 LLM

在 **LLM 与调度** 区域填写：

- `Base URL`
- `Model`
- `API Key`

然后点击：

- **测试 LLM**：验证当前配置是否可调用
- **保存设置**：保存到本地数据库

> [!TIP]
> LLM 测试和正式生成都支持 `responses -> chat.completions` 的兼容回退。某些兼容供应商不支持 OpenAI `responses` 时，系统会自动尝试回退。

### 3. 执行首次同步

回到首页，你可以使用三个入口：

- **同步最近观看历史**：拉取最近 48 小时数据
- **全量刷新一次**：首次接入建议使用，会抓取更多历史记录
- **生成今日日报**：基于现有数据重算当日报告

## 主要页面

| 页面 | 作用 |
| --- | --- |
| `/` | 仪表盘，查看最新日报、系统状态、手动运行入口 |
| `/settings` | 配置 Cookie、LLM 与定时策略 |
| `/jobs` | 查看同步、标签、日报任务历史 |
| `/reports/[date]` | 查看单日详细报告 |

## 日报与评分逻辑

`coconon` 不是直接让模型“凭感觉判断”，而是先做结构化评分，再用 LLM 组织自然语言说明。

当前评分主要参考：

- 主题熵是否下降
- 分区是否更集中
- UP 主是否更重复
- 新主题 / 新 UP 主占比是否下降
- 观看时段与单条时长是否更“隧道化”

最终会生成：

- `0-100` 的 coconon score
- `低 / 中 / 高` 风险等级
- 与前一天相比的结论
- 2 到 4 条可解释证据

## 常见问题

### 1. 测试 Cookie 失败

优先检查：

- `SESSDATA` 是否有效
- 浏览器登录态是否过期
- 是否触发了 Bilibili 风控

如果当前已经保存过 Cookie，测试按钮会默认先测已保存值。

### 2. LLM 测试返回 404

通常意味着：

- `Base URL` 不对
- `Model` 不存在
- 供应商并不支持 OpenAI `responses`，但支持 `chat.completions`

当前系统已经会自动尝试回退；如果仍失败，请检查接口文档是否真的是 OpenAI-compatible。

### 3. 全量刷新成功，但日报文案不是模型生成

这通常表示：

- 观看历史同步成功
- 评分逻辑成功
- 但 LLM 调用失败，因此系统自动退回了模板文案

这不会影响数据和分数，只影响自然语言描述部分。

## 实现说明

如果你只是使用这个应用，这一节可以跳过。

### 技术栈

- `Next.js 16` + App Router
- `better-sqlite3`
- `node-cron`
- `OpenAI-compatible` 接口
- `Vitest`
- `Tailwind CSS 4`

### 目录概览

```text
src/
  app/                   页面与 API 路由
  components/            设置页、卡片、手动操作组件
  lib/
    server/              Bilibili、LLM、任务、调度、报告生成
    cocoon-score.ts      信息茧房评分逻辑
    prisma.ts            SQLite 封装与表初始化
  test/                  纯逻辑测试
```

### API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/settings/cookie` | 保存 Cookie |
| `POST` | `/api/settings/cookie/test` | 测试当前或输入中的 Cookie |
| `POST` | `/api/settings/llm` | 保存 LLM 配置 |
| `POST` | `/api/settings/llm/test` | 测试当前或输入中的 LLM 配置 |
| `POST` | `/api/sync/run` | 执行同步或全量刷新 |
| `POST` | `/api/reports/run` | 生成今日日报 |
| `GET` | `/api/reports/[date]` | 获取某日报告 |
| `GET` | `/api/dashboard/summary` | 获取首页摘要数据 |

### 验证命令

```bash
npm run lint
npm run test
npm run build
```

## 当前阶段

这是一个偏 MVP 的本地分析工具，重点是把下面这条链路：

1. 录入凭证
2. 验证配置
3. 同步历史
4. 标注主题
5. 生成日报
6. 追踪注意力收窄趋势
