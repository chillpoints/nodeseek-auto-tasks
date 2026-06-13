---
name: nodeseek-auto-tasks
description: 用于分析 NodeSeek 帖子内容统计报表（生成拟人化回帖 JSON）或分析 Daily Digest 热帖打包订阅报表（生成发帖 JSON），最终输出为可供油猴脚本直接导入的 JSON 任务格式。当用户提及 NodeSeek、回帖、水贴、发帖、帖子内容统计、回帖JSON、发帖JSON、NodeSeek 自动水贴助手等关键词时触发。
keywords:
  - nodeseek
  - 回帖
  - 水贴
  - 发帖
  - 帖子内容统计
  - 回帖JSON
  - 发帖JSON
packageType: instruction-skill
instructionOnly: true
metadata:
  version: 1.6.0
---

# NodeSeek 智能任务分析与生成助手 (NodeSeek Auto Tasks Skill)

本技能用于处理 NodeSeek 自动化任务生成，支持以下两种场景：

## 1. 自动回帖任务生成
当收到名为 `NodeSeek_Stats_YYYYMMDD_HHMM.md` 的文档（“流量帖子内容与评论统计报表”）时：
- **提取 postId**：从帖子小标题或链接中提取出唯一的帖子 ID（纯数字，如 `post-12345-1` 对应的 ID 为 `12345`）。
- **回帖内容生成规范**：
  - **绝对简短**：回帖字数控制在 30 字以内，通常 10-20 字最佳。
  - **极度拟人化**：语气必须口语化、接地气，符合 NodeSeek 论坛用语风格（如：啊、哈、啦、捏、顶、支持）。
  - **严禁 AI 腔调**：禁止使用“作为 AI...”、“祝您的项目顺利！”等官方客套话。
  - **语境对应**：福利贴/送鸡腿贴表达感谢和已加鸡腿，技术贴提出合理问题或评价，分享贴表达感谢 and 收藏。
- **输出格式**：输出一个 JSON 数组，每个对象包含 `taskType` (设为 `"reply"`), `postId`, `title` 和 `reply` 字段。

## 2. 自动发帖任务生成
当收到名为 `NodeSeek_Daily_Digest_YYYYMMDD_HHMM.md` 的文档（“过去 24 小时热帖打包订阅”）时：
- **生成发帖标题**：根据文档中的生成日期，如 `生成时间: 2026-06-13 14:49:19`，生成标题，例如：`🔥 NodeSeek 过去 24 小时热帖打包订阅 (2026-06-13)`。
- **板块选择**：默认将板块（category）设置为 `"info"`（代表“情报”板块）或 `"daily"`（日常板块）。对于打包订阅内容，强烈推荐使用 `"info"`。
- **发帖正文**：将 Markdown 文档的全部内容作为 `content` 字段的字符串值（必须保留完整的 Markdown 格式，并确保转义 JSON 字符串安全）。
- **输出格式**：输出一个 JSON 数组，包含单个对象，每个对象包含 `taskType` (设为 `"post"`), `title`, `category` 和 `content` 字段。

---

## 📤 输出格式规范 (强约束)

你必须输出一个**纯 JSON 代码块**，不包含任何前言、后记、Markdown 说明或额外的字符。该 JSON file 必须是一个对象数组，结构必须与下方 Schema 完全一致：

### 结构一（回帖任务）：
```json
[
  {
    "taskType": "reply",
    "postId": "12345",
    "title": "帖子标题 A",
    "reply": "回复内容"
  }
]
```

### 结构二（发帖任务）：
```json
[
  {
    "taskType": "post",
    "title": "🔥 NodeSeek 过去 24 小时热帖打包订阅 (2026-06-13)",
    "category": "info",
    "content": "完整的 Markdown 帖子正文内容"
  }
]
```

### 输出要求：
* **只能输出纯 JSON 代码块**。禁止带有 `这里是为您生成的 JSON 文件：` 等任何废话。
* 确保输出的 JSON 可以被 `JSON.parse()` 完美解析，双引号、换行和特殊字符必须在 JSON 中正确转义（特别是 content 字段大文本里的反斜杠和双引号）。
