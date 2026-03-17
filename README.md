# coconon

`coconon` 是一个单用户、本地部署的 Bilibili 观看历史分析应用。

它会自动拉取你的观看历史，补全主题标签，并通过“今日 vs 昨日”“本周 vs 上周”的窗口比较，生成 `coconon score` 和对应的日报、周报。

> [!IMPORTANT]
> 当前版本面向本机或内网环境设计，不建议直接暴露到公网。

## 你可以用它做什么

- 自动同步 Bilibili 观看历史
- 单独运行 LLM 标签补全，并查看补全进度
- 生成今日日报
- 生成本周周报
- 对比昨日和上周，观察内容是否更收窄
- 输出 `coconon score`、风险等级和维度证据
- 手动补跑同步、补标签、日报/周报、查看任务历史

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

### 3. 执行首次同步与补标签

回到首页，建议按这个顺序执行：

1. **全量刷新一次**：首次接入建议使用，会抓取更多历史记录
2. **LLM 补全标签**：单独运行标签补全，可预览待补条数、预计调用 LLM 的数量和预计耗时
3. **生成今日日报**：生成 `今日 vs 昨日` 的日报
4. **生成本周周报**：生成 `本周 vs 上周` 的周报

> [!TIP]
> 当前版本里，“同步 / 全量刷新”“补标签”“生成报告”已经拆成独立动作。这样你可以先把历史拉全，再单独跑较慢的 LLM 标签补全。

## 主要页面

| 页面 | 作用 |
| --- | --- |
| `/` | 仪表盘，同时查看今日日分、本周周分、最近日报/周报、手动运行入口 |
| `/settings` | 配置 Cookie、LLM 与定时策略 |
| `/jobs` | 查看同步、标签、日报任务历史 |
| `/history` | 查看今日同步到的观看历史和当前标签 |
| `/reports/[date]` | 查看单日详细报告 |
| `/reports/weekly/[weekKey]` | 查看单周详细报告 |

## 报告与评分逻辑

`coconon` 不是直接让模型“凭感觉判断”，而是先做结构化窗口比较，再用 LLM 组织自然语言说明。

当前会生成两类分数：

- `今日日分`：比较 `今日 vs 昨日`
- `本周周分`：比较 `本周 vs 上周`

比较维度固定为 5 项：

- 主题收窄变化
- 分区收窄变化
- UP 主收窄变化
- 新颖度下降变化
- 消费隧道化变化

判定逻辑：

- 分数是“变化风险分”，不是静态兴趣结构分
- 只有多个维度同时朝更窄方向变化时，才会判定为“更进入信息茧房”
- 样本不足时不输出总分，只输出结构变化说明

最终会生成：

- `0-100` 的 coconon score
- `低 / 中 / 高` 风险等级
- 与对照窗口相比的结论
- 5 个维度的拆解卡
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

### 3. 全量刷新后为什么还要单独补标签

这是当前设计，不是异常：

- **全量刷新一次** 只负责拉取历史
- **LLM 补全标签** 单独负责慢速主题补全
- **生成今日日报 / 本周周报** 只基于当前已有标签生成报告

这样做的好处是：

- 历史同步更快
- 补标签进度可见
- 你可以先确认标签质量，再生成报告

### 4. 报告文案不是模型生成

这通常表示：

- 标签和评分逻辑成功
- 但 LLM 调用失败，因此系统自动退回了模板文案

这不会影响分数、结论和维度拆解，只影响自然语言描述部分。

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
    cocoon-score.ts      比较型 coconon score 算法
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
| `GET` | `/api/tags/summary` | 获取待补标签条数、预估耗时和运行状态 |
| `POST` | `/api/tags/run` | 启动标签补全任务 |
| `POST` | `/api/reports/run` | 生成日报、周报或同时生成两者 |
| `GET` | `/api/reports/[date]` | 获取某日报告 |
| `GET` | `/api/reports/weekly/[weekKey]` | 获取某周报告 |
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
5. 生成日报 / 周报
6. 追踪注意力收窄趋势
