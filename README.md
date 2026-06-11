# NodeSeek 自动回帖/水贴助手 (油猴脚本)

本项目是适用于 [NodeSeek](https://www.nodeseek.com/) 论坛的自动化加权挂机回帖助手。支持自适应词云学习、多维度智能过滤屏蔽、跨页连续挂机、以及精致自适应控制面板配色。

---

## 📂 目录结构与项目索引

* **[nodeseek-auto-reply/](file:///d:/Project/antigravity/nodeseek-auto-reply/)**：自动回帖油猴脚本主项目目录。
  - [nodeseek_auto_reply.user.js](file:///d:/Project/antigravity/nodeseek-auto-reply/nodeseek_auto_reply.user.js)：自动回帖油猴脚本。
  - [README.md](file:///d:/Project/antigravity/nodeseek-auto-reply/README.md)：详细的使用指南、核心特色与安全防封建议。
  - [LICENSE](file:///d:/Project/antigravity/nodeseek-auto-reply/LICENSE)：MIT 开源授权协议。
* **[skills/nodeseek-auto-reply/](file:///d:/Project/antigravity/skills/nodeseek-auto-reply/)**：配套的 AI 智能回帖生成 Agent Skill 规则（可将导出的帖子 Markdown 报表交由 AI 自动生成定制回帖 JSON 文件）。

---

## ✨ 核心特色

1. **拟人与发包双通道机制**：优先使用隐藏 Iframe 模拟真实 DOM 填充与点击提交，抗 Cloudflare 验证能力强；失败时自动降级至 API 直接发包。
2. **多维度过滤与屏蔽屏蔽**：支持按阅读量、评论数、特定关键词过滤帖子；支持指定帖子 ID、发帖用户名/UID 以及标题特定敏感词的深度黑名单屏蔽。
3. **连续跨页自动挂机**：当前页无符合条件贴子时自动倒计时翻页，并在新页面加载后自动恢复挂机。
4. **智能 AI JSON 任务**：支持一键导出流量贴 Markdown 汇总，交由 AI 按照 Skill 规则生成个性化回帖 JSON，并支持脚本中一键导入高优先级顺序回帖。

详细的使用方式及安装指南请参阅 [nodeseek-auto-reply/README.md](file:///d:/Project/antigravity/nodeseek-auto-reply/README.md)。
