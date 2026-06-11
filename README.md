# Antigravity 工作空间 (Workspace)

这是一个用于存放个人开发项目、自动化脚本和 Agent 自定义技能的整合仓库。为了保持结构清晰，本项目已完成目录重构，各模块按功能独立归类。

---

## 📁 目录结构与项目索引

```text
antigravity/
├── nodeseek-auto-reply/   # NodeSeek 论坛自动回帖/水贴助手项目
│   ├── LICENSE
│   ├── README.md          # 详细的使用指南与安全防封建议
│   └── nodeseek_auto_reply.user.js
│
├── photo-manager/         # 本地照片与媒体管理工具集
│   ├── .photo_manager_config.json
│   ├── README.md          # 工具使用说明及依赖安装指南
│   ├── clean_small_photos.pyw
│   ├── move_duplicate_mp4.pyw
│   └── photo_manager.pyw
│
├── skills/                # Agent (Antigravity/Gemini) 的自定义复用技能库
│   └── my-coffee-skill/   # 瑞幸咖啡点单查询与支付技能
│
└── .gitignore             # 忽略文件配置
```

---

## 🚀 项目简述

### 1. [NodeSeek 自动回帖助手](file:///d:/Project/antigravity/nodeseek-auto-reply)
* 一个适用于 [NodeSeek](https://www.nodeseek.com/) 论坛的自动化挂机回帖油猴脚本。
* 支持双通道发包（DOM模拟与API发包）、动态增重与词云学习系统、跨页自动挂机及全参数定制 Premium 面板。

### 2. [照片与媒体管理工具集](file:///d:/Project/antigravity/photo-manager)
* 一套基于 Python (tkinter + Pillow) 实现的本地多线程图像与视频整理工具。
* **批量照片管理器**：高 DPI 锐化，支持鼠标左键批量划选、右键查看 EXIF 元数据和右键双击移至删除。
* **小图清除工具**：极速流式读取头部尺寸，批量剔除低于 256px 不符备份标准的缩略图。
* **同名视频整理**：一键识别并归档 JPG/JPEG 照片同名的 MP4 短视频。

### 3. [Agent 技能库 (skills)](file:///d:/Project/antigravity/skills)
* **Luckin Coffee 点单技能**：支持与南京特定门店接口交互获取 Butter Americano 价格，调用凭证下单并生成支付二维码。

---

## 📜 许可协议
仓库内的具体项目有其各自的授权说明（例如 `nodeseek-auto-reply` 基于 MIT 协议开源），详情请参阅各子项目目录下的 `LICENSE` 或说明文件。
