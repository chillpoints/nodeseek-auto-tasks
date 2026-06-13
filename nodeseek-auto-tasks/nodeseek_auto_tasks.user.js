// ==UserScript==
// @name         NodeSeek 自动任务助手 (发帖/回帖)
// @namespace    https://github.com/chillpoints/nodeseek-auto-reply
// @version      1.6.0
// @description  自动选择浏览量和评论量大的帖子回复评论，并支持导入自动发帖任务。优先使用 DOM 模拟拟人化回复/发布，失败则自动切换 API 直接发包；支持 OpenAI 官方格式 API、分类关键词匹配和实时运行日志；新增特定关键词、帖子ID及发帖用户的多重屏蔽过滤功能；支持自由定制控制面板配色。
// @author       Antigravity
// @match        *://www.nodeseek.com/*
// @match        *://nodeseek.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ==================== 样式定义 (Premium UI - CSS Variables) ====================
  const PANEL_CSS = `
    #ns-auto-panel {
      position: fixed;
      top: 80px;
      right: 20px;
      width: 400px;
      height: 620px;
      z-index: 999999;
      background: var(--ns-bg, #FFFDF5);
      border: 1px solid var(--ns-accent, #CB4B16);
      border-radius: 16px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
      color: var(--ns-fg, #101010);
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #ns-auto-panel.minimized {
      height: 48px;
      width: 200px;
    }
    .ns-header {
      padding: 12px 16px;
      background: rgba(128, 128, 128, 0.08);
      border-bottom: 1px solid rgba(128, 128, 128, 0.15);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
      user-select: none;
    }
    .ns-title {
      font-weight: 700;
      font-size: 14px;
      color: var(--ns-fg, #101010);
      letter-spacing: 0.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 140px;
    }
    .ns-controls-btn {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .ns-btn-icon {
      background: none;
      border: none;
      color: var(--ns-fg, #101010);
      opacity: 0.6;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .ns-btn-icon:hover {
      opacity: 1;
      background: rgba(128, 128, 128, 0.15);
    }
    .ns-tabs {
      display: flex;
      background: rgba(128, 128, 128, 0.08);
      border-bottom: 1px solid rgba(128, 128, 128, 0.15);
    }
    .ns-tab {
      flex: 1;
      text-align: center;
      padding: 12px 0;
      font-size: 12px;
      font-weight: 600;
      color: var(--ns-fg, #101010);
      opacity: 0.6;
      cursor: pointer;
      transition: all 0.2s;
      border-bottom: 2px solid transparent;
    }
    .ns-tab:hover {
      opacity: 0.9;
    }
    .ns-tab.active {
      opacity: 1;
      color: var(--ns-accent, #CB4B16);
      border-bottom-color: var(--ns-accent, #CB4B16);
      background: rgba(128, 128, 128, 0.03);
    }
    .ns-content-wrapper {
      flex: 1;
      overflow: hidden;
      position: relative;
    }
    .ns-tab-panel {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 16px;
      overflow-y: auto;
      display: none;
      flex-direction: column;
      gap: 14px;
      font-size: 13px;
    }
    .ns-tab-panel.active {
      display: flex;
    }
    .ns-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .ns-label {
      color: var(--ns-fg, #101010);
      opacity: 0.6;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .ns-input, .ns-textarea {
      background: rgba(128, 128, 128, 0.08);
      border: 1px solid rgba(128, 128, 128, 0.2);
      border-radius: 8px;
      padding: 8px 12px;
      color: var(--ns-fg, #101010);
      outline: none;
      font-family: inherit;
      transition: border-color 0.2s, background-color 0.2s;
    }
    .ns-input:focus, .ns-textarea:focus {
      border-color: var(--ns-accent, #CB4B16);
      background: rgba(128, 128, 128, 0.12);
    }
    .ns-textarea {
      resize: vertical;
      min-height: 80px;
    }
    .ns-slider-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .ns-slider {
      flex: 1;
      accent-color: var(--ns-accent, #CB4B16);
      cursor: pointer;
    }
    .ns-slider-val {
      min-width: 45px;
      text-align: right;
      font-weight: 600;
      color: var(--ns-accent, #CB4B16);
    }
    .ns-btn-primary {
      background: var(--ns-accent, #CB4B16);
      border: none;
      border-radius: 8px;
      padding: 10px;
      color: #ffffff;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      transition: transform 0.1s, opacity 0.2s;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
      margin-top: auto;
    }
    .ns-btn-primary:active {
      transform: scale(0.98);
    }
    .ns-btn-primary:hover {
      opacity: 0.9;
    }
    .ns-btn-primary.running {
      background: #dc2626;
    }
    .ns-log-container {
      background: rgba(0, 0, 0, 0.05);
      border: 1px solid rgba(128, 128, 128, 0.2);
      border-radius: 10px;
      padding: 10px;
      flex: 1;
      min-height: 150px;
      overflow-y: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .ns-log-line {
      line-height: 1.5;
      word-break: break-all;
    }
    .ns-log-time {
      color: var(--ns-fg, #101010);
      opacity: 0.5;
      margin-right: 6px;
    }
    .ns-log-info { color: #0284c7; }
    .ns-log-success { color: #16a34a; }
    .ns-log-warning { color: #d97706; }
    .ns-log-error { color: #dc2626; }
    
    .ns-switch-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .ns-switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
    }
    .ns-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .ns-slider-switch {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(128, 128, 128, 0.3);
      transition: .3s;
      border-radius: 24px;
    }
    .ns-slider-switch:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .3s;
      border-radius: 50%;
    }
    input:checked + .ns-slider-switch {
      background-color: var(--ns-accent, #CB4B16);
    }
    input:checked + .ns-slider-switch:before {
      transform: translateX(20px);
    }
    .ns-footer {
      padding: 10px 16px;
      background: rgba(128, 128, 128, 0.08);
      border-top: 1px solid rgba(128, 128, 128, 0.15);
      font-size: 11px;
      color: var(--ns-fg, #101010);
      opacity: 0.6;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .ns-footer a {
      color: var(--ns-accent, #CB4B16);
      text-decoration: none;
    }
    .ns-footer a:hover {
      text-decoration: underline;
    }
    .ns-btn-theme-reset {
      background: rgba(128, 128, 128, 0.08);
      border: 1px solid rgba(128, 128, 128, 0.25);
      border-radius: 6px;
      color: var(--ns-fg);
      cursor: pointer;
      padding: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .ns-btn-theme-reset:hover {
      background: rgba(128, 128, 128, 0.15);
      color: var(--ns-accent);
      border-color: var(--ns-accent);
    }
  `;

  // ==================== 默认关键词分类回复配置 ====================
  const DEFAULT_PRESETS = [
    {
      keywords: "鸡腿,福利,送,鸡",
      replies: [
        "感谢分享福利，已加鸡腿！🍗",
        "前排领个鸡腿，谢谢楼主分享！",
        "祝大佬发财，鸡腿送上啦！",
        "支持福利，祝老板生活愉快！"
      ]
    },
    {
      keywords: "vps,服务器,主机,海外,线路,特价",
      replies: [
        "性价比看起来挺顶的，线路性能如何？",
        "这是哪家的机器？线路是什么优化吗？",
        "感谢大佬分享测速，收藏备用！",
        "吃灰预订，但还是支持一下！"
      ]
    },
    {
      keywords: "default",
      replies: [
        "帮顶！支持一下楼主！",
        "学习了，感谢分享！",
        "路过帮顶，支持优质内容！",
        "写得很详细，收藏了！"
      ]
    }
  ];

  const DEFAULT_CONFIG = {
    minViews: 500,
    minComments: 10,
    interval: 60,
    maxCount: 5,
    kwFilter: "",
    kwBlock: "",
    idBlock: "",
    userBlock: "",
    aiEnabled: false,
    apiKey: "",
    apiUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    systemPrompt: "你是 NodeSeek 论坛的发帖回复助手。请根据下面提供的帖子标题，生成一个友好、口语化、简短（不超过 30 字）的论坛回复，听起来像一个真实的人在互动，不要机械化，不要带翻译腔，可以使用一些网络语气助词，不要带有任何客套的官方辞藻。",
    presetsText: stringifyPresets(DEFAULT_PRESETS),
    bgColor: "#FFFDF5",
    fgColor: "#101010",
    accentColor: "#CB4B16"
  };

  // ==================== 辅助解析函数 ====================
  // ==================== 辅助解析函数 ====================
  function parsePresets(text) {
    const sanitizeReply = (r) => {
      if (typeof r === 'string') {
        return { text: r, weight: 1.0 };
      }
      return {
        text: String(r?.text || "帮顶！支持一下！"),
        weight: parseFloat(r?.weight) || 1.0
      };
    };

    if (!text || !text.trim() || text.includes('undefined') || text.includes('NaN')) {
      return DEFAULT_PRESETS.map(p => ({
        keywords: p.keywords,
        replies: p.replies.map(sanitizeReply)
      }));
    }

    const blocks = text.split(/\n?---\n?/);
    const presets = [];
    for (const block of blocks) {
      const lines = block.split('\n');
      let keywords = '';
      const replies = [];
      let inReplies = false;
      for (const line of lines) {
        if (line.startsWith('关键词:')) {
          keywords = line.slice(4).trim();
        } else if (line.startsWith('回复:')) {
          inReplies = true;
        } else if (inReplies) {
          const t = line.trim();
          if (t) {
            // 解析带有权重的回复，例如 "感谢分享 | w:1.5"
            const match = t.match(/^(.*?)\s*\|\s*(?:w|权重)\s*:\s*([\d.]+)\s*$/i);
            if (match) {
              const rText = match[1].trim();
              const rWeight = parseFloat(match[2]) || 1.0;
              if (rText && rText !== 'undefined' && !isNaN(rWeight)) {
                replies.push({ text: rText, weight: rWeight });
              }
            } else if (t !== 'undefined') {
              replies.push({ text: t, weight: 1.0 });
            }
          }
        }
      }
      if (keywords && replies.length) {
        presets.push({ keywords, replies });
      }
    }

    if (!presets.some(p => p.keywords === 'default')) {
      presets.push({
        keywords: 'default',
        replies: [
          { text: "帮顶！支持一下！", weight: 1.0 },
          { text: "学习了，感谢分享。", weight: 1.0 }
        ]
      });
    }
    return presets;
  }

  function stringifyPresets(presets) {
    if (!Array.isArray(presets)) return '';
    return presets.map(p => {
      const replyLines = (p.replies || []).map(r => {
        const text = typeof r === 'string' ? r : (r?.text || '');
        const weight = typeof r === 'string' ? 1.0 : (r?.weight || 1.0);
        if (!text || text === 'undefined') return null;
        if (Math.abs(weight - 1.0) < 0.01) {
          return text;
        }
        return `${text} | w:${weight.toFixed(1)}`;
      }).filter(Boolean);
      return `关键词: ${p.keywords}\n回复:\n${replyLines.join('\n')}`;
    }).join('\n---\n');
  }

  // ==================== 智能学习与自适应权重系统 ====================
  const STOPWORDS = new Set([
    '的', '了', '是', '在', '和', '有', '而', '与', '关于', '对于', '如何', '怎么', '什么', 
    '这个', '那个', '一个', '一些', '有人', '有人吗', '你们', '我们', '他们', '大家', '求问', 
    '请问', '求助', '大佬', '楼主', '谢谢', '感谢', '支持', '帮顶', '路过', '帖子', '内容', 
    '请教', '分享', '问题', '情况', '时候', '自己', '发现', '感觉', '觉得', '感觉好', '这篇',
    '说明', '处理', '为什么', '怎么做', '什么鬼', '没有', '不是', '可以', '不能', '觉得', '还是',
    '今天', '明天', '昨天', '已经', '开始', '知道', '看到', '觉得', '觉得好', '一下', '这个帖子'
  ]);

  function extractKeywords(title) {
    if (!title) return [];
    // 匹配中文 2-4 字词，或者英数字连续字符
    const rawWords = title.match(/[a-zA-Z0-9]{2,15}|[\u4e00-\u9fa5]{2,4}/g) || [];
    return rawWords
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length >= 2 && !STOPWORDS.has(w));
  }

  function learnFromThread(title, iframeDoc) {
    try {
      // 获取已有的回帖
      const commentEls = iframeDoc.querySelectorAll('.comment-content, .comment-text, .content, .md-content');
      const comments = Array.from(commentEls)
        .map(el => el.textContent.trim())
        .filter(t => t.length > 0 && t.length < 80); // 过滤长度异常的评论

      if (comments.length === 0) return;

      const config = getLocalConfig();
      const presets = parsePresets(config.presetsText);
      let updated = false;

      // 提取标题分词
      const titleWords = extractKeywords(title);

      // 1. 统计当前贴内已有评论频次
      const counts = {};
      comments.forEach(c => {
        counts[c] = (counts[c] || 0) + 1;
      });

      // 2. 遍历我们已有的预设回复，根据别人是否使用来“自适应调整权重”
      presets.forEach(group => {
        group.replies.forEach(replyObj => {
          const text = replyObj.text;
          const matchCount = comments.filter(c => c.toLowerCase().includes(text.toLowerCase())).length;
          
          if (matchCount > 0) {
            // 别人频繁使用：增加该预设的权重（上限 5.0）
            const oldW = replyObj.weight;
            replyObj.weight = Math.min(5.0, replyObj.weight + 0.15 * matchCount);
            if (Math.abs(replyObj.weight - oldW) > 0.01) {
              updated = true;
            }
          } else {
            // 别人未曾使用：轻微扣减该预设权重，实现衰减（下限 0.1）
            const oldW = replyObj.weight;
            replyObj.weight = Math.max(0.1, replyObj.weight - 0.02);
            if (Math.abs(replyObj.weight - oldW) > 0.01) {
              updated = true;
            }
          }
        });
      });



      // 回写 GM 存储，刷新预设文本框
      if (updated) {
        const newPresetsText = stringifyPresets(presets);
        GM_setValue('ns_auto_reply_presetsText', newPresetsText);
        
        const txtArea = runtime.panel?.querySelector('#ns-presets-text');
        if (txtArea) {
          txtArea.value = newPresetsText;
        }
      }
    } catch (err) {
      console.warn("Learning engine error:", err);
    }
  }

  function getNextPageUrl() {
    // 1. 寻找带有 "下一页" 或 "后一页" 文本的 a 标签，或者类名中包含 next 的链接
    const nextLink = Array.from(document.querySelectorAll('a')).find(el => {
      const text = el.textContent.trim();
      return text === '下一页' || text === '后一页' || text.toLowerCase() === 'next' || el.classList.contains('next');
    });
    if (nextLink) {
      const href = nextLink.getAttribute('href');
      if (href) return href;
    }
    
    // 2. 如果 DOM 里没有找到，通过 URL 规则智能计算下一页地址（兼容 NodeSeek page-x 模板）
    const path = location.pathname;
    const match = path.match(/\/page-(\d+)/);
    if (match) {
      const nextNum = parseInt(match[1]) + 1;
      return path.replace(/\/page-\d+/, `/page-${nextNum}`) + location.search;
    } else {
      // 若当前在首页或板块首页
      if (path === '/' || path === '') {
        return '/page-2' + location.search;
      }
      if (path.startsWith('/categories/')) {
        const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
        return `${cleanPath}/page-2` + location.search;
      }
    }
    return null;
  }

  function triggerNextPage(nextPageUrl) {
    let seconds = 3;
    const statusText = runtime.panel?.querySelector('#ns-status-text');
    addLog(`📭 当前页没有符合条件的未回复帖子，准备自动翻页...`, 'warning');
    
    const countdown = () => {
      if (seconds > 0) {
        if (statusText) {
          statusText.textContent = `即将翻页 (${seconds}s)`;
          statusText.style.color = '#f59e0b'; // 设为警示橙色
        }
        addLog(`⏱️ 正在倒计时翻页... 还有 ${seconds} 秒`, 'info');
        seconds--;
        runtime.timer = setTimeout(countdown, 1000);
      } else {
        if (statusText) {
          statusText.textContent = '正在翻页...';
        }
        addLog(`🚀 正在跳转至下一页: ${nextPageUrl}`, 'success');
        
        // 跨页自动启动标记
        GM_setValue('ns_auto_reply_running_state', true);
        location.href = nextPageUrl.startsWith('http') ? nextPageUrl : (location.origin + nextPageUrl);
      }
    };
    countdown();
  }

  function getLocalConfig() {
    const config = {};
    for (const key of Object.keys(DEFAULT_CONFIG)) {
      config[key] = GM_getValue(`ns_auto_reply_${key}`, DEFAULT_CONFIG[key]);
    }
    // 自愈清洗：防脏数据阻碍控制面板渲染
    if (config.presetsText && (config.presetsText.includes('undefined') || config.presetsText.includes('NaN') || !config.presetsText.trim())) {
      config.presetsText = stringifyPresets(DEFAULT_PRESETS);
      GM_setValue('ns_auto_reply_presetsText', config.presetsText);
    }
    return config;
  }

  function saveLocalConfig(config) {
    for (const key of Object.keys(config)) {
      GM_setValue(`ns_auto_reply_${key}`, config[key]);
    }
  }

  // ==================== 脚本全局状态 ====================
  const runtime = {
    isRunning: false,
    repliedCount: 0,
    repliedIds: new Set(GM_getValue('ns_auto_reply_replied_ids', [])),
    queue: [],
    timer: null,
    panel: null,
    logContainer: null,
    startBtn: null,
    isListPage: /^\/(categories\/|page|award|search|$)/.test(location.pathname),
    currentUser: null
  };

  // ==================== 日志输出 ====================
  function addLog(message, type = 'info') {
    if (!runtime.logContainer) return;
    const line = document.createElement('div');
    line.className = `ns-log-line ns-log-${type}`;
    
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'ns-log-time';
    timeSpan.textContent = `[${timeStr}]`;
    
    const contentSpan = document.createElement('span');
    contentSpan.textContent = message;
    
    line.appendChild(timeSpan);
    line.appendChild(contentSpan);
    
    runtime.logContainer.appendChild(line);
    runtime.logContainer.scrollTop = runtime.logContainer.scrollHeight;
  }

  // ==================== 获取页面数据 ====================
  function parseCount(rawText) {
    const text = String(rawText || "")
      .replace(/,/g, "")
      .replace(/\s+/g, "")
      .trim();

    if (!text) return 0;
    const match = text.match(/(\d+(?:\.\d+)?)(万|w|k|m|千)?/i);
    if (!match) return 0;

    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value)) return 0;

    const unit = (match[2] || "").toLowerCase();
    const factor =
      unit === "万" || unit === "w" ? 10000 :
      unit === "千" || unit === "k" ? 1000 :
      unit === "m" ? 1000000 :
      1;

    return Math.round(value * factor);
  }

  function readMetric(item, type) {
    const selector = type === "views"
      ? ".post-info .info-views span[title], .post-info .info-views span, .post-info .info-views"
      : ".post-info .info-comments-count span[title], .post-info .info-comments-count span, .post-info .info-comments-count";

    const el = item.querySelector(selector);
    return parseCount(el?.getAttribute("title") || el?.textContent || "");
  }

  // ==================== 智能回复选择与生成 ====================
  function generateAIReply(title, candidates, config) {
    return new Promise((resolve, reject) => {
      let url = config.apiUrl.replace(/\/+$/, "");
      if (!url.includes("/chat/completions")) {
        url = url.endsWith("/v1") ? `${url}/chat/completions` : `${url}/v1/chat/completions`;
      }

      const candidateTexts = candidates.map(c => c.text);
      const systemPrompt = `你是论坛回复挑选助手。请在提供的备选回复列表中，挑出最贴合帖子标题：《${title}》的一项回复。必须且只能从列表中原封不动地挑出一个选项，绝对不能擅自修改、添加或生成列表之外的任何内容！只返回选中的这行回复，不要带任何解释和标点。
备选回复列表：
${candidateTexts.join('\n')}`;

      GM_xmlhttpRequest({
        method: "POST",
        url: url,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`
        },
        data: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `请从列表中挑选最贴合的一项。` }
          ],
          max_tokens: 100,
          temperature: 0.2
        }),
        onload: (xhr) => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              const selected = res?.choices?.[0]?.message?.content?.trim();
              if (selected && candidateTexts.includes(selected)) {
                resolve(selected);
              } else {
                reject(new Error("AI 返回的选择不在备选列表中"));
              }
            } catch (e) {
              reject(new Error("解析 AI 响应失败"));
            }
          } else {
            reject(new Error(`HTTP 状态码 ${xhr.status}`));
          }
        },
        onerror: (err) => reject(new Error("网络请求失败"))
      });
    });
  }

  async function selectFinalReply(title, config) {
    const presets = parsePresets(config.presetsText);
    const recentReplies = GM_getValue('ns_auto_reply_recent_replies', []);
    
    // 1. 获取匹配的预设组 candidates
    let matchedGroup = null;
    const normalizedTitle = title.toLowerCase();
    for (const preset of presets) {
      if (preset.keywords === 'default') continue;
      const keys = preset.keywords.split(/[，,]/).map(k => k.trim().toLowerCase()).filter(Boolean);
      if (keys.some(k => normalizedTitle.includes(k))) {
        matchedGroup = preset;
        break;
      }
    }
    
    let candidates = matchedGroup ? matchedGroup.replies : [];
    
    // 2. 漏斗去重策略：剔除最近 5 次的回复
    let filtered = candidates.filter(c => !recentReplies.includes(c.text));
    
    // 如果匹配组过滤后为空，退避去 default 组中挑选未在最近 5 次出现的
    if (filtered.length === 0) {
      const defaultGroup = presets.find(p => p.keywords === 'default');
      if (defaultGroup) {
        filtered = defaultGroup.replies.filter(c => !recentReplies.includes(c.text));
        if (filtered.length > 0) {
          candidates = defaultGroup.replies;
        }
      }
    }
    
    // 如果依然为空，说明最近 5 次的回复把匹配组和 default 组全占满了，开始逐步放宽去重限制（退避至最近 3 次，最近 1 次，最后不限制）
    if (filtered.length === 0) {
      for (const limit of [3, 1, 0]) {
        const tempRecent = recentReplies.slice(-limit);
        // 先看匹配组
        filtered = candidates.filter(c => !tempRecent.includes(c.text));
        if (filtered.length === 0) {
          // 看 default 组
          const defaultGroup = presets.find(p => p.keywords === 'default');
          if (defaultGroup) {
            filtered = defaultGroup.replies.filter(c => !tempRecent.includes(c.text));
            if (filtered.length > 0) {
              candidates = defaultGroup.replies;
              break;
            }
          }
        } else {
          break;
        }
      }
    }

    // 如果最后实在都没有过滤出候选，直接用 default 组的所有选项
    if (filtered.length === 0) {
      const defaultGroup = presets.find(p => p.keywords === 'default');
      filtered = defaultGroup ? defaultGroup.replies : [{ text: "帮顶支持！", weight: 1.0 }];
      candidates = filtered;
    }

    let finalReply = "";

    // 3. AI 挑选逻辑 (如果开启且有 API Key)
    if (config.aiEnabled && config.apiKey) {
      try {
        addLog("🧠 正在请求 AI 语义分析并从预设候选列表中挑选最贴切回复...", "info");
        finalReply = await generateAIReply(title, filtered, config);
        addLog(`🤖 AI 成功挑选回复: "${finalReply}"`, "success");
      } catch (err) {
        addLog(`⚠️ AI 挑选失败 (${err.message})。降级使用加权随机算法挑选`, "warning");
      }
    }

    // 4. 加权随机挑选 (作为 AI 挑选失败或未开启 AI 的常规机制)
    if (!finalReply) {
      finalReply = selectWeighted(filtered);
    }

    // 写入最近回复历史
    recentReplies.push(finalReply);
    if (recentReplies.length > 5) {
      recentReplies.shift();
    }
    GM_setValue('ns_auto_reply_recent_replies', recentReplies);

    return finalReply;
  }

  // 轮盘赌加权选择
  function selectWeighted(replies) {
    if (!replies || replies.length === 0) return "帮顶支持！";
    const totalWeight = replies.reduce((sum, r) => sum + (r.weight || 1.0), 0);
    if (totalWeight <= 0) return replies[Math.floor(Math.random() * replies.length)].text;

    let rand = Math.random() * totalWeight;
    for (const r of replies) {
      rand -= (r.weight || 1.0);
      if (rand <= 0) {
        return r.text;
      }
    }
    return replies[replies.length - 1].text;
  }

  // ==================== 通道一：Iframe 拟人化模拟回复 ====================
  function performIframeReply(threadUrl, replyText, title) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.src = threadUrl;
      iframe.style.cssText = 'position: fixed; top: -1000px; left: -1000px; width: 800px; height: 600px; visibility: hidden; opacity: 0; z-index: -99999;';
      document.body.appendChild(iframe);

      let checkInterval = null;
      let timeoutTimer = null;

      const cleanup = () => {
        if (checkInterval) clearInterval(checkInterval);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        iframe.remove();
      };

      // 25秒加载超时
      timeoutTimer = setTimeout(() => {
        cleanup();
        reject(new Error('回帖页面加载超时，请检查您的网络连接或页面渲染速度'));
      }, 25000);

      iframe.onload = () => {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (!iframeDoc) {
          cleanup();
          reject(new Error('同源限制，无法访问回帖页 DOM'));
          return;
        }

        let attempts = 0;
        checkInterval = setInterval(() => {
          attempts++;
          if (attempts > 30) { // 15秒内检查编辑器
            clearInterval(checkInterval);
            cleanup();
            reject(new Error('未找到回复框，该贴可能已被锁定或您没有回复权限'));
            return;
          }

          const editor = iframeDoc.querySelector('.md-editor');
          if (editor) {
            clearInterval(checkInterval);
            checkInterval = null;

            // 触发回复学习与权重调整
            try {
              learnFromThread(title, iframeDoc);
            } catch (le) {
              console.warn("Learning error:", le);
            }

            // 检测是否已经回复过（对比作者的UID）
            const currentUid = runtime.currentUser?.member_id;
            if (currentUid) {
              const commentAuthors = iframeDoc.querySelectorAll(".info-author a[href^='/space/']");
              const alreadyReplied = Array.from(commentAuthors).some(a => {
                const href = a.getAttribute('href') || '';
                const uidMatch = href.match(/\/space\/(\d+)/);
                return uidMatch && String(uidMatch[1]) === String(currentUid);
              });
              if (alreadyReplied) {
                cleanup();
                reject(new Error('检测到您之前已回复过此帖，自动跳过防止二次回复'));
                return;
              }
            }

            // 填充文本
            const cmEl = editor.querySelector('.CodeMirror');
            const ta = editor.querySelector('textarea');
            if (cmEl && cmEl.CodeMirror) {
              cmEl.CodeMirror.setValue(replyText);
            } else if (ta) {
              ta.value = replyText;
              ta.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              cleanup();
              reject(new Error('未找到富文本或文本编辑框，编辑器组件异常'));
              return;
            }

            // 模拟人类延迟，等待 1.5s 后点击
            setTimeout(() => {
              const submitBtn = editor.querySelector('button.submit.btn') || editor.querySelector('button.submit') || iframeDoc.querySelector('.md-editor button.submit');
              if (!submitBtn) {
                cleanup();
                reject(new Error('未找到回复提交按钮'));
                return;
              }
              submitBtn.click();

              // 验证提交结果（编辑器内容是否被清空，代表Ajax成功返回）
              let verifyAttempts = 0;
              const verifyInterval = setInterval(() => {
                verifyAttempts++;
                const currentVal = ta ? ta.value : (cmEl?.CodeMirror?.getValue() || '');
                if (!currentVal.trim()) {
                  clearInterval(verifyInterval);
                  cleanup();
                  resolve();
                } else if (verifyAttempts > 12) { // 6秒无响应
                  clearInterval(verifyInterval);
                  cleanup();
                  if (currentVal.trim()) {
                    reject(new Error('回帖未被清空，可能回复太频繁或触发防火墙限制'));
                  } else {
                    resolve();
                  }
                }
              }, 500);
            }, 1500);
          }
        }, 500);
      };
    });
  }

  // ==================== 通道二：API 接口直接发包 (备用) ====================
  function performApiReply(threadId, replyText) {
    return new Promise((resolve, reject) => {
      // 提取 csrf-token 令牌
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      if (!csrfToken) {
        reject(new Error("未在主页面上找到 Csrf-Token，无法直接进行接口发包"));
        return;
      }

      const payload = {
        content: replyText,
        mode: "new-comment",
        postId: Number(threadId)
      };

      GM_xmlhttpRequest({
        method: "POST",
        url: `${location.origin}/api/content/new-comment`,
        headers: {
          "Content-Type": "application/json",
          "Csrf-Token": csrfToken,
          "Referer": `${location.origin}/post-${threadId}-1`,
          "Origin": location.origin,
          "X-Requested-With": "XMLHttpRequest"
        },
        data: JSON.stringify(payload),
        onload: (xhr) => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              if (res && res.success !== false) {
                resolve();
              } else {
                reject(new Error(res?.message || "服务器端处理请求返回失败状态"));
              }
            } catch (e) {
              resolve(); // 兼容返回空文本的异常
            }
          } else {
            let errMsg = `HTTP ${xhr.status}`;
            try {
              const res = JSON.parse(xhr.responseText);
              if (res?.message) errMsg = res.message;
            } catch (_) {}
            reject(new Error(errMsg));
          }
        },
        onerror: () => reject(new Error("API 发包请求异常（可能是网络中断或防火墙阻断）"))
      });
    });
  }

  // ==================== API 接口直接发帖功能 ====================
  function performApiPost(title, content, category) {
    return new Promise((resolve, reject) => {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      if (!csrfToken) {
        reject(new Error("未在主页面上找到 Csrf-Token，无法发布帖子"));
        return;
      }

      const payload = {
        content: content,
        mode: "new-discussion",
        title: title,
        category: category || "info",
        rank: 4
      };

      GM_xmlhttpRequest({
        method: "POST",
        url: `${location.origin}/api/content/new-discussion`,
        headers: {
          "Content-Type": "application/json",
          "Csrf-Token": csrfToken,
          "Referer": `${location.origin}/new-discussion?category=${category || "info"}`,
          "Origin": location.origin,
          "X-Requested-With": "XMLHttpRequest"
        },
        data: JSON.stringify(payload),
        onload: (xhr) => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              if (res && res.success !== false) {
                resolve(res);
              } else {
                reject(new Error(res?.message || "服务器端处理发贴请求返回失败状态"));
              }
            } catch (e) {
              resolve({});
            }
          } else {
            let errMsg = `HTTP ${xhr.status}`;
            try {
              const res = JSON.parse(xhr.responseText);
              if (res?.message) errMsg = res.message;
            } catch (_) {}
            reject(new Error(errMsg));
          }
        },
        onerror: () => reject(new Error("API 发贴请求异常（可能是网络中断或防火墙阻断）"))
      });
    });
  }

  // ==================== 双通道回复适配器 ====================
  async function performReply(threadId, threadUrl, replyText, title) {
    try {
      addLog("🚀 [通道一] 尝试使用 Iframe DOM 拟人化模拟回复...", 'info');
      await performIframeReply(threadUrl, replyText, title);
    } catch (domErr) {
      addLog(`⚠️ [通道一] DOM 模拟失败: ${domErr.message}`, 'warning');
      addLog("⚡ [通道二] 正在自动切换至 API 直接发包备用通道...", 'info');
      try {
        await performApiReply(threadId, replyText);
      } catch (apiErr) {
        throw new Error(`[双通道失效] 拟人化失败且接口发包报错: ${apiErr.message}`);
      }
    }
  }

  // ==================== 帖子内容统计功能 ====================
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function fetchHtml(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url.startsWith('http') ? url : (location.origin + url),
        onload: (xhr) => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.responseText);
          } else {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        },
        onerror: (err) => reject(new Error("网络请求失败"))
      });
    });
  }

  function htmlToMarkdown(node) {
    if (!node) return "";
    let markdown = "";
    
    const children = node.childNodes;
    if (children && children.length > 0) {
      for (const child of children) {
        const type = child.nodeType;
        if (type === 3) { // Node.TEXT_NODE
          markdown += child.nodeValue;
        } else if (type === 1) { // Node.ELEMENT_NODE
          const tag = child.tagName.toLowerCase();
          const subText = htmlToMarkdown(child);
          switch (tag) {
            case 'h1': markdown += `\n# ${subText}\n`; break;
            case 'h2': markdown += `\n## ${subText}\n`; break;
            case 'h3': markdown += `\n### ${subText}\n`; break;
            case 'h4': markdown += `\n#### ${subText}\n`; break;
            case 'p': markdown += `\n${subText}\n`; break;
            case 'br': markdown += `\n`; break;
            case 'a': markdown += `[${subText}](${child.getAttribute('href') || ''})`; break;
            case 'img': markdown += `![${child.getAttribute('alt') || '图片'}](${child.getAttribute('src') || ''})`; break;
            case 'strong': case 'b': markdown += `**${subText}**`; break;
            case 'em': case 'i': markdown += `*${subText}*`; break;
            case 'li': markdown += `* ${subText}\n`; break;
            case 'ul': case 'ol': markdown += `\n${subText}\n`; break;
            case 'pre': markdown += `\n\`\`\`\n${child.textContent}\n\`\`\`\n`; break;
            case 'code': markdown += `\`${subText}\``; break;
            case 'blockquote': markdown += `\n> ${subText.replace(/\n/g, '\n> ')}\n`; break;
            default: markdown += subText;
          }
        }
      }
    } else {
      if (node.nodeType === 3) {
        markdown += node.nodeValue;
      } else {
        markdown += node.textContent || "";
      }
    }
    return markdown;
  }

  function parsePostsFromDoc(doc) {
    const config = getLocalConfig();
    const items = doc.querySelectorAll('li.post-list-item, .post-list-item');
    const posts = [];
    const kwFilterList = config.kwFilter.split(/[，,]/).map(k => k.trim().toLowerCase()).filter(Boolean);
    const kwBlockList = config.kwBlock.split(/[，,]/).map(k => k.trim().toLowerCase()).filter(Boolean);
    const idBlockList = config.idBlock.split(/[，,]/).map(k => {
      const clean = k.trim();
      const m = clean.match(/\d+/);
      return m ? m[0] : clean;
    }).filter(Boolean);
    const userBlockList = config.userBlock.split(/[，,]/).map(k => k.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);

    items.forEach(item => {
      const link = item.querySelector('.post-title a[href], a.post-title[href]');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      const idMatch = href.match(/\/post-(\d+)(?:-|\/|$)/);
      if (!idMatch) return;
      
      const threadId = idMatch[1];
      const title = String(link.textContent || "").replace(/\s+/g, " ").trim();
      const views = readMetric(item, 'views');
      const comments = readMetric(item, 'comments');
      
      const authorEl = item.querySelector('.info-author a, .post-author a') || Array.from(item.querySelectorAll("a[href*='/space/']")).find(el => el.textContent.trim().length > 0);
      let authorName = '';
      let authorId = '';
      if (authorEl) {
        authorName = authorEl.textContent.trim();
        const authorHref = authorEl.getAttribute('href') || '';
        const uidMatch = authorHref.match(/\/space\/(\d+)/);
        if (uidMatch) {
          authorId = uidMatch[1];
        }
      }

      // 过滤与屏蔽
      if (idBlockList.includes(threadId)) return;
      if (authorName && userBlockList.includes(authorName.toLowerCase())) return;
      if (authorId && userBlockList.includes(authorId.toLowerCase())) return;
      if (kwBlockList.length > 0 && kwBlockList.some(k => title.toLowerCase().includes(k))) return;
      if (views < config.minViews || comments < config.minComments) return;
      if (item.querySelector('use[href="#lock"]')) return;
      if (kwFilterList.length > 0 && !kwFilterList.some(k => title.toLowerCase().includes(k))) return;

      posts.push({
        id: threadId,
        title: title,
        url: href.startsWith('http') ? href : (location.origin + href),
        views,
        comments,
        authorName,
        authorId
      });
    });

    return posts;
  }

  function getNextPageUrlFromDoc(doc, currentUrl) {
    const nextLink = Array.from(doc.querySelectorAll('a')).find(el => {
      const text = el.textContent.trim();
      return text === '下一页' || text === '后一页' || text.toLowerCase() === 'next' || el.classList.contains('next');
    });
    if (nextLink) {
      const href = nextLink.getAttribute('href');
      if (href) return href;
    }
    
    // 智能算术推导
    const match = currentUrl.match(/\/page-(\d+)/);
    if (match) {
      const nextNum = parseInt(match[1]) + 1;
      return currentUrl.replace(/\/page-\d+/, `/page-${nextNum}`);
    } else {
      if (currentUrl === '/' || currentUrl === '' || currentUrl.startsWith('/?')) {
        return '/page-2';
      }
      if (currentUrl.startsWith('/categories/')) {
        const cleanPath = currentUrl.split('?')[0];
        const search = currentUrl.includes('?') ? '?' + currentUrl.split('?')[1] : '';
        const base = cleanPath.endsWith('/') ? cleanPath.slice(0, -1) : cleanPath;
        return `${base}/page-2` + search;
      }
    }
    return null;
  }

  async function gatherMatchingPosts(limit) {
    let matchedPosts = [];
    let currentPageUrl = location.pathname + location.search;

    while (matchedPosts.length < limit) {
      addLog(`正在扫描列表页面 ${currentPageUrl} 中的符合条件的帖子...`, 'info');
      let htmlText;
      if (currentPageUrl === location.pathname + location.search) {
        htmlText = document.documentElement.outerHTML;
      } else {
        htmlText = await fetchHtml(currentPageUrl);
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      const pagePosts = parsePostsFromDoc(doc);
      
      if (pagePosts.length === 0) {
        addLog(`页面 ${currentPageUrl} 未找到符合过滤条件的帖子。`, 'warning');
      } else {
        addLog(`从页面 ${currentPageUrl} 找到 ${pagePosts.length} 个符合条件的帖子。`, 'info');
      }

      for (const post of pagePosts) {
        if (matchedPosts.length < limit) {
          matchedPosts.push(post);
        }
      }

      if (matchedPosts.length >= limit) {
        break;
      }

      const nextUrl = getNextPageUrlFromDoc(doc, currentPageUrl);
      if (!nextUrl) {
        addLog(`已扫描到最后一页，无法搜集更多帖子。`, 'warning');
        break;
      }
      currentPageUrl = nextUrl;
      await sleep(1000);
    }

    return matchedPosts;
  }

  async function crawlPostDetails(post) {
    const htmlText = await fetchHtml(post.url);
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // 1. 正文解析
    const contentEl = doc.querySelector('.post-content .md-content, .post-content, .post .md-content, .md-content');
    const contentMarkdown = contentEl ? htmlToMarkdown(contentEl) : "未获取到正文内容";

    // 2. 评论解析
    const commentItems = doc.querySelectorAll('ul.comments li.content-item, .comments .content-item');
    const commentsList = [];

    if (commentItems.length > 0) {
      commentItems.forEach(item => {
        const authorEl = item.querySelector('.author-name') || item.querySelector('.comment-author a, .info-author a') || Array.from(item.querySelectorAll("a[href*='/space/']")).find(el => el.textContent.trim().length > 0);
        const author = authorEl ? authorEl.textContent.trim() : "匿名";
        const contentEl = item.querySelector('article.post-content, .post-content, .comment-content, .md-content');
        const content = contentEl ? htmlToMarkdown(contentEl).trim() : "";
        const floorEl = item.querySelector('.floor-link, .floor, .comment-floor');
        const floor = floorEl ? floorEl.textContent.trim() : "";

        if (content) {
          commentsList.push({ author, content, floor });
        }
      });
    } else {
      const commentContents = doc.querySelectorAll('.comment-content, .comment-text');
      commentContents.forEach((el, index) => {
        const content = htmlToMarkdown(el).trim();
        if (content) {
          commentsList.push({
            author: "用户",
            content: content,
            floor: `#${index + 1}`
          });
        }
      });
    }

    return {
      ...post,
      content: contentMarkdown,
      commentsList
    };
  }

  function exportStatsToMarkdown(results) {
    const config = getLocalConfig();
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    let md = `# NodeSeek 流量帖子内容与评论统计报表\n\n`;
    md += `* **导出时间**: ${timeStr}\n`;
    md += `* **过滤规则**: 阅读量 >= ${config.minViews} | 评论量 >= ${config.minComments}\n\n`;
    
    md += `---\n\n## 📝 帖子目录索引\n\n`;
    results.forEach((post, index) => {
      md += `${index + 1}. [${post.title}](#post-${post.id})\n`;
    });
    md += `\n---\n\n`;
    
    results.forEach((post, index) => {
      md += `<a name="post-${post.id}"></a>\n`;
      md += `## ${index + 1}. ${post.title}\n\n`;
      md += `* **原帖链接**: [点击访问](${post.url})\n`;
      md += `* **作者**: @${post.authorName || '未知'} (UID: ${post.authorId || '未知'})\n`;
      md += `* **数据**: 👀 ${post.views} 阅读 | 💬 ${post.comments} 评论\n\n`;
      
      md += `### 📄 帖子正文内容\n\n`;
      md += `${post.content.trim()}\n\n`;
      
      md += `### 💬 帖子评论集 (${(post.commentsList || []).length} 条)\n\n`;
      if (!post.commentsList || post.commentsList.length === 0) {
        md += `暂无符合条件的评论。\n\n`;
      } else {
        post.commentsList.forEach(comment => {
          const floor = comment.floor ? `**[${comment.floor}]** ` : "";
          md += `* ${floor}**@${comment.author}**: ${comment.content.trim()}\n`;
        });
        md += `\n`;
      }
      md += `\n---\n\n`;
    });
    
    const fileName = `NodeSeek_Stats_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.md`;
    
    const a = document.createElement("a");
    const file = new Blob([md], { type: "text/markdown;charset=utf-8" });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  async function runStatsCollection(limit) {
    addLog(`🚀 启动帖子内容统计，目标帖子数量上限: ${limit}`, 'info');
    
    const posts = await gatherMatchingPosts(limit);
    if (posts.length === 0) {
      addLog(`⚠️ 没有找到任何符合流量和过滤条件的帖子！`, 'warning');
      return;
    }
    
    addLog(`📂 帖子列表收集完毕，共获取 ${posts.length} 个符合条件的帖子。准备开始爬取详细内容和评论...`, 'success');
    
    const results = [];
    
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      addLog(`⏳ [${i + 1}/${posts.length}] 正在爬取帖子: 《${post.title}》...`, 'info');
      
      try {
        const details = await crawlPostDetails(post);
        results.push(details);
        addLog(`✅ [${i + 1}/${posts.length}] 爬取成功！获取到 ${details.commentsList.length} 条评论。`, 'success');
      } catch (err) {
        addLog(`❌ [${i + 1}/${posts.length}] 爬取失败: ${err.message}`, 'error');
        results.push({
          ...post,
          content: `爬取失败: ${err.message}`,
          commentsList: []
        });
      }
      
      if (i < posts.length - 1) {
        const delay = 1000 + Math.random() * 500;
        await sleep(delay);
      }
    }
    
    addLog(`📝 正在生成 Markdown 报告文档...`, 'info');
    exportStatsToMarkdown(results);
    addLog(`🎉 统计完成，已生成并触发 Markdown 文档下载！`, 'success');
  }

  // ==================== 自动化核心与调度 ====================
  function saveRepliedIds() {
    GM_setValue('ns_auto_reply_replied_ids', Array.from(runtime.repliedIds));
  }

  function updateImportCountUI() {
    const taskCountText = runtime.panel?.querySelector('#ns-task-count-text');
    if (taskCountText) {
      const importedTasks = GM_getValue('ns_auto_reply_imported_tasks', []);
      taskCountText.textContent = importedTasks.length;
    }
  }

  function stopReplier(reason = '用户手动停止') {
    GM_setValue('ns_auto_reply_running_state', false);
    GM_setValue('ns_auto_reply_smart_mode', false);
    runtime.isRunning = false;
    if (runtime.timer) clearTimeout(runtime.timer);
    runtime.timer = null;
    if (runtime.startBtn) {
      runtime.startBtn.textContent = '开始自动任务';
      runtime.startBtn.classList.remove('running');
    }
    const statusText = runtime.panel?.querySelector('#ns-status-text');
    if (statusText) {
      statusText.textContent = '已停止';
      statusText.style.color = '#f87171';
    }
    addLog(`⏹️ 脚本已停止：${reason}`, 'warning');
  }

  async function executeNext() {
    if (!runtime.isRunning) return;

    const config = getLocalConfig();
    const isSmartMode = GM_getValue('ns_auto_reply_smart_mode', false);
    
    // 检查回帖限制
    if (isSmartMode) {
      const importedTasks = GM_getValue('ns_auto_reply_imported_tasks', []);
      const hasImportedInQueue = runtime.queue.some(t => t.importedReply);
      if (importedTasks.length === 0 && !hasImportedInQueue) {
        stopReplier('已完成所有导入的智能回帖任务');
        return;
      }
    } else {
      // 仅在普通模式下检查预设的回帖总数上限
      if (runtime.repliedCount >= config.maxCount) {
        stopReplier('已达到预设的本次回帖总数上限');
        return;
      }
    }

    if (runtime.queue.length === 0) {
      addLog('🔄 当前队列已处理完毕，正在重新扫描页面...', 'info');
      scanThreads();
      if (runtime.queue.length === 0) {
        const nextUrl = getNextPageUrl();
        if (nextUrl) {
          triggerNextPage(nextUrl);
        } else {
          addLog('📭 页面已无符合条件的未回复帖子，且未能查查找下一页链接。已安全休眠，等待重新扫描。', 'warning');
          runtime.timer = setTimeout(executeNext, 30000);
        }
        return;
      }
    }

    const task = runtime.queue.shift();
    
    // 如果此任务是导入的智能任务，从本地存储中清除它，并更新 UI 的待处理任务数量
    if (task.importedReply) {
      let importedTasks = GM_getValue('ns_auto_reply_imported_tasks', []);
      importedTasks = importedTasks.filter(t => String(t.postId) !== String(task.id));
      GM_setValue('ns_auto_reply_imported_tasks', importedTasks);
      updateImportCountUI();
    } else if (task.importedPost) {
      let importedTasks = GM_getValue('ns_auto_reply_imported_tasks', []);
      importedTasks = importedTasks.filter(t => t.taskType === "post" ? t.taskId !== task.id : true);
      GM_setValue('ns_auto_reply_imported_tasks', importedTasks);
      updateImportCountUI();
    }
    
    runtime.repliedIds.add(task.id);
    saveRepliedIds();

    if (task.taskType === "post") {
      addLog(`📝 准备发布新帖子：《${task.title}》...`, 'info');
      try {
        await performApiPost(task.title, task.content, task.category);
        runtime.repliedCount++;
        GM_setValue('ns_auto_reply_replied_count', runtime.repliedCount); // 持久化保存计数以支持跨页运行
        if (isSmartMode) {
          const remaining = GM_getValue('ns_auto_reply_imported_tasks', []).length;
          addLog(`✅ 成功发布新帖子！[当前累计操作: ${runtime.repliedCount} | 剩余智能任务: ${remaining}] 标题:《${task.title}》`, 'success');
        } else {
          addLog(`✅ 成功发布新帖子！[当前本次累计: ${runtime.repliedCount}/${config.maxCount}] 标题:《${task.title}》`, 'success');
        }
      } catch (e) {
        addLog(`❌ 发布新帖子失败: ${e.message}`, 'error');
      }
    } else {
      addLog(`📝 准备回复帖子：《${task.title}》...`, 'info');
      
      // 1. 挑选出回复文案
      const replyText = task.importedReply || await selectFinalReply(task.title, config);

      // 2. 模拟回帖 (双通道机制)
      try {
        await performReply(task.id, task.url, replyText, task.title);
        runtime.repliedCount++;
        GM_setValue('ns_auto_reply_replied_count', runtime.repliedCount); // 持久化保存计数以支持跨页运行
        if (isSmartMode) {
          const remaining = GM_getValue('ns_auto_reply_imported_tasks', []).length;
          addLog(`✅ 成功回帖！[当前累计回复: ${runtime.repliedCount} | 剩余智能任务: ${remaining}] 帖子:《${task.title}》`, 'success');
        } else {
          addLog(`✅ 成功回帖！[当前本次累计: ${runtime.repliedCount}/${config.maxCount}] 帖子:《${task.title}》`, 'success');
        }
      } catch (e) {
        addLog(`❌ 回帖失败: ${e.message}`, 'error');
      }
    }

    // 3. 计算下一次的延迟
    if (runtime.isRunning) {
      const activeInterval = Math.max(5, config.interval);
      // 随机添加 10% ~ 20% 的抖动防特征分析
      const jitter = (Math.random() * 0.2 + 0.1) * activeInterval;
      const totalDelay = Math.round(activeInterval + jitter);
      addLog(`⏱️ 间隔调度：计划在 ${totalDelay} 秒后操作下一贴...`, 'info');
      runtime.timer = setTimeout(executeNext, totalDelay * 1000);
    }
  }

  function scanThreads() {
    const config = getLocalConfig();
    const items = document.querySelectorAll('li.post-list-item, .post-list-item');
    const scanned = [];
    
    // --- 优先提取导入的发帖任务 ---
    const importedTasks = GM_getValue('ns_auto_reply_imported_tasks', []);
    const postTasks = importedTasks.filter(t => t.taskType === "post");
    postTasks.forEach(task => {
      if (!runtime.repliedIds.has(task.taskId)) {
        scanned.push({
          taskType: "post",
          id: task.taskId,
          title: task.title,
          content: task.content,
          category: task.category,
          importedPost: true
        });
      }
    });
    
    const kwFilterList = config.kwFilter.split(/[，,]/).map(k => k.trim().toLowerCase()).filter(Boolean);

    // 解析屏蔽配置列表
    const kwBlockList = config.kwBlock.split(/[，,]/).map(k => k.trim().toLowerCase()).filter(Boolean);
    
    // 帖子 ID 屏蔽列表：支持输入 766934 或 post-766934-1，统一提取其中的纯数字
    const idBlockList = config.idBlock.split(/[，,]/).map(k => {
      const clean = k.trim();
      const m = clean.match(/\d+/);
      return m ? m[0] : clean;
    }).filter(Boolean);
    
    // 用户屏蔽列表：过滤掉用户名开头的 @ 符号并统一转为小写
    const userBlockList = config.userBlock.split(/[，,]/).map(k => {
      let clean = k.trim().toLowerCase();
      if (clean.startsWith('@')) {
        clean = clean.slice(1);
      }
      return clean;
    }).filter(Boolean);

    items.forEach(item => {
      const link = item.querySelector('.post-title a[href], a.post-title[href]');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      const idMatch = href.match(/\/post-(\d+)(?:-|\/|$)/);
      if (!idMatch) return;
      
      const threadId = idMatch[1];
      const title = String(link.textContent || "").replace(/\s+/g, " ").trim();
      const views = readMetric(item, 'views');
      const comments = readMetric(item, 'comments');
      
      // 提取发帖人与发帖人 ID
      // 优先寻找指向 /space/ 的 a 标签，以防 class 被 NodeSeek 更改
      const authorEl = item.querySelector('.info-author a, .post-author a') || Array.from(item.querySelectorAll("a[href*='/space/']")).find(el => el.textContent.trim().length > 0);
      let authorName = '';
      let authorId = '';
      if (authorEl) {
        authorName = authorEl.textContent.trim();
        const authorHref = authorEl.getAttribute('href') || '';
        const uidMatch = authorHref.match(/\/space\/(\d+)/);
        if (uidMatch) {
          authorId = uidMatch[1];
        }
      }

      // --- 智能任务匹配 ---
      const importedTasks = GM_getValue('ns_auto_reply_imported_tasks', []);
      const matchedImported = importedTasks.find(t => String(t.postId) === String(threadId));
      if (matchedImported) {
        if (!runtime.repliedIds.has(threadId)) {
          scanned.unshift({
            id: threadId,
            title: title,
            url: `${location.origin}/post-${threadId}-1`,
            views,
            comments,
            authorName,
            authorId,
            importedReply: matchedImported.reply
          });
        }
        return;
      }

      // 如果当前存有导入的智能任务，只处理匹配到的智能任务，忽略其他帖子
      if (importedTasks.length > 0) {
        return;
      }

      // --- 屏蔽逻辑过滤 ---
      // 1. 已回复去重
      if (runtime.repliedIds.has(threadId)) return;

      // 2. 指定帖子ID屏蔽
      if (idBlockList.includes(threadId)) return;

      // 3. 指定发帖人（用户名或 ID 匹配）屏蔽
      if (authorName && userBlockList.includes(authorName.toLowerCase())) return;
      if (authorId && userBlockList.includes(authorId.toLowerCase())) return;

      // 4. 帖子标题包含屏蔽关键词
      if (kwBlockList.length > 0) {
        const titleLower = title.toLowerCase();
        if (kwBlockList.some(k => titleLower.includes(k))) return;
      }
      
      // --- 基本条件限制 ---
      if (views < config.minViews) return;
      if (comments < config.minComments) return;
      
      // 跳过已被锁定的帖子
      if (item.querySelector('use[href="#lock"]')) return;

      // 过滤规则：只回复带特定关键词的帖子
      if (kwFilterList.length > 0) {
        const titleLower = title.toLowerCase();
        if (!kwFilterList.some(k => titleLower.includes(k))) return;
      }

      scanned.push({
        id: threadId,
        title: title,
        url: `${location.origin}/post-${threadId}-1`,
        views,
        comments,
        authorName,
        authorId
      });
    });

    runtime.queue = scanned;
    addLog(`🔍 页面扫描：找到 ${scanned.length} 个符合过滤条件的帖子加入缓冲队列`, 'info');
  }

  function startReplier(isRestore = false) {
    const config = getLocalConfig();
    
    // 安全验证
    runtime.currentUser = unsafeWindow?.__config__?.user || window?.__config__?.user;
    if (!runtime.currentUser) {
      addLog("🚫 启动失败: 未检测到 NodeSeek 登录凭证，请先登录账号！", "error");
      stopReplier("未登录账户");
      return;
    }

    addLog(`👤 当前登录用户: @${runtime.currentUser.name}，正在启动自动化...`, 'success');

    if (!runtime.isListPage) {
      addLog("⚠️ 警告: 您当前不在 NodeSeek 帖子列表页（如首页、板块页），扫描器可能无法工作。建议您前往首页启动！", "warning");
    }

    GM_setValue('ns_auto_reply_running_state', true);
    runtime.isRunning = true;
    
    if (isRestore) {
      runtime.repliedCount = GM_getValue('ns_auto_reply_replied_count', 0);
      addLog(`🔄 已恢复运行状态，当前已回复累计: ${runtime.repliedCount}`, 'info');
    } else {
      runtime.repliedCount = 0;
      GM_setValue('ns_auto_reply_replied_count', 0);
      
      const importedTasks = GM_getValue('ns_auto_reply_imported_tasks', []);
      if (importedTasks.length > 0) {
        GM_setValue('ns_auto_reply_smart_mode', true);
        addLog(`🎯 开启智能任务模式，总计待处理任务: ${importedTasks.length} 个。`, 'success');
      } else {
        GM_setValue('ns_auto_reply_smart_mode', false);
      }
    }
    
    if (runtime.startBtn) {
      runtime.startBtn.textContent = '停止自动任务';
      runtime.startBtn.classList.add('running');
    }

    scanThreads();
    executeNext();
  }

  // ==================== 拖拽控制面板 ====================
  function setupDragging(panel, dragHeader) {
    let active = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    dragHeader.addEventListener("pointerdown", dragStart, false);
    document.addEventListener("pointerup", dragEnd, false);
    document.addEventListener("pointermove", drag, false);

    function dragStart(e) {
      if (e.target.closest('button') || e.target.closest('input')) return;
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      active = true;
      try { dragHeader.setPointerCapture(e.pointerId); } catch(_) {}
    }

    function dragEnd() {
      active = false;
    }

    function drag(e) {
      if (!active) return;
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      panel.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
  }

  // ==================== 界面渲染 (Premium UI) ====================
  function injectUI() {
    const shadowHost = document.createElement('div');
    shadowHost.id = 'ns-auto-shadow-host';
    document.body.appendChild(shadowHost);
    
    const shadow = shadowHost.attachShadow({ mode: 'closed' });
    
    // 注入样式
    const style = document.createElement('style');
    style.textContent = PANEL_CSS;
    shadow.appendChild(style);

    // 构建 DOM
    const panel = document.createElement('div');
    panel.id = 'ns-auto-panel';
    runtime.panel = panel;

    // 头部
    const header = document.createElement('div');
    header.className = 'ns-header';
    header.innerHTML = `
      <div class="ns-title" title="NodeSeek 水贴助手">NS 自动水贴助手</div>
      <div class="ns-controls-btn">
        <button class="ns-btn-icon" id="ns-btn-minimize" title="最小化">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
      </div>
    `;
    panel.appendChild(header);

    // 标签栏
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'ns-tabs';
    tabsContainer.innerHTML = `
      <div class="ns-tab active" data-target="ns-panel-control">控制</div>
      <div class="ns-tab" data-target="ns-panel-ai">AI配置</div>
      <div class="ns-tab" data-target="ns-panel-presets">预设回复</div>
      <div class="ns-tab" data-target="ns-panel-log">运行日志</div>
    `;
    panel.appendChild(tabsContainer);

    // 选项卡内容包裹器
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'ns-content-wrapper';
    panel.appendChild(contentWrapper);

    const config = getLocalConfig();

    // 根据保存的配置加载初始背景配色样式
    panel.style.setProperty('--ns-bg', config.bgColor);
    panel.style.setProperty('--ns-fg', config.fgColor);
    panel.style.setProperty('--ns-accent', config.accentColor);

    // 1. 控制与过滤选项页
    const panelControl = document.createElement('div');
    panelControl.id = 'ns-panel-control';
    panelControl.className = 'ns-tab-panel active';
    panelControl.innerHTML = `
      <div class="ns-group">
        <div class="ns-switch-container">
          <span class="ns-label">启用 AI 润色回复</span>
          <label class="ns-switch">
            <input type="checkbox" id="ns-ai-enabled" ${config.aiEnabled ? 'checked' : ''}>
            <span class="ns-slider-switch"></span>
          </label>
        </div>
      </div>
      <div class="ns-group">
        <span class="ns-label">至少浏览量 (过滤)</span>
        <div class="ns-slider-container">
          <input type="range" class="ns-slider" id="ns-min-views" min="50" max="5000" step="50" value="${config.minViews}">
          <span class="ns-slider-val" id="val-min-views">${config.minViews}</span>
        </div>
      </div>
      <div class="ns-group">
        <span class="ns-label">至少评论数 (过滤)</span>
        <div class="ns-slider-container">
          <input type="range" class="ns-slider" id="ns-min-comments" min="0" max="200" step="5" value="${config.minComments}">
          <span class="ns-slider-val" id="val-min-comments">${config.minComments}</span>
        </div>
      </div>
      <div class="ns-group">
        <span class="ns-label">回帖间隔频率 (秒)</span>
        <div class="ns-slider-container">
          <input type="range" class="ns-slider" id="ns-interval" min="5" max="300" step="5" value="${config.interval}">
          <span class="ns-slider-val" id="val-interval">${config.interval}s</span>
        </div>
      </div>
      <div class="ns-group">
        <span class="ns-label">单次运行回帖总数上限</span>
        <div class="ns-slider-container">
          <input type="range" class="ns-slider" id="ns-max-count" min="1" max="50" step="1" value="${config.maxCount}">
          <span class="ns-slider-val" id="val-max-count">${config.maxCount}</span>
        </div>
      </div>
      <div class="ns-group">
        <span class="ns-label">只回复带特定关键词的帖子 (选填,逗号分隔)</span>
        <input type="text" class="ns-input" id="ns-kw-filter" value="${config.kwFilter}" placeholder="例如: 鸡腿,福利,机器">
      </div>
      <div class="ns-group">
        <span class="ns-label">屏蔽包含特定关键词的帖子 (选填,逗号分隔)</span>
        <input type="text" class="ns-input" id="ns-kw-block" value="${config.kwBlock}" placeholder="例如: 抽奖,免费,低价">
      </div>
      <div class="ns-group">
        <span class="ns-label">屏蔽特定帖子ID (选填,支持完整编号如 post-766934-1 或纯数字,逗号分隔)</span>
        <input type="text" class="ns-input" id="ns-id-block" value="${config.idBlock}" placeholder="例如: 766934, post-766555-1">
      </div>
      <div class="ns-group">
        <span class="ns-label">屏蔽特定发帖用户 (选填,支持用户名或用户编号,逗号分隔)</span>
        <input type="text" class="ns-input" id="ns-user-block" value="${config.userBlock}" placeholder="例如: OYZER0-, 60081">
      </div>
      <div class="ns-group">
        <span class="ns-label">外观配色定制 (背景 / 文字 / 主题色)</span>
        <div style="display: flex; gap: 8px; align-items: center;">
          <div style="flex: 1; display: flex; align-items: center; gap: 4px; background: rgba(128, 128, 128, 0.08); border-radius: 8px; padding: 4px 8px; border: 1px solid rgba(128, 128, 128, 0.15);">
            <input type="color" id="ns-color-bg" value="${config.bgColor}" title="背景颜色" style="width: 24px; height: 24px; border: none; border-radius: 4px; cursor: pointer; background: transparent; padding: 0;">
            <span style="font-size: 11px; opacity: 0.8; user-select: none;">背景</span>
          </div>
          <div style="flex: 1; display: flex; align-items: center; gap: 4px; background: rgba(128, 128, 128, 0.08); border-radius: 8px; padding: 4px 8px; border: 1px solid rgba(128, 128, 128, 0.15);">
            <input type="color" id="ns-color-fg" value="${config.fgColor}" title="文字颜色" style="width: 24px; height: 24px; border: none; border-radius: 4px; cursor: pointer; background: transparent; padding: 0;">
            <span style="font-size: 11px; opacity: 0.8; user-select: none;">文字</span>
          </div>
          <div style="flex: 1; display: flex; align-items: center; gap: 4px; background: rgba(128, 128, 128, 0.08); border-radius: 8px; padding: 4px 8px; border: 1px solid rgba(128, 128, 128, 0.15);">
            <input type="color" id="ns-color-accent" value="${config.accentColor}" title="主题/高亮色" style="width: 24px; height: 24px; border: none; border-radius: 4px; cursor: pointer; background: transparent; padding: 0;">
            <span style="font-size: 11px; opacity: 0.8; user-select: none;">主题</span>
          </div>
          <button id="ns-btn-reset-theme" class="ns-btn-theme-reset" title="重置为默认配色">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          </button>
        </div>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 10px;">
        <button class="ns-btn-primary" id="ns-btn-start" style="flex: 1; margin: 0;">开始自动任务</button>
        <button class="ns-btn-primary" id="ns-btn-import-json" style="flex: 1; margin: 0; background: #16a34a;" title="导入 AI 智能 JSON 任务">导入 JSON 任务</button>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <button class="ns-btn-primary" id="ns-btn-stats" style="flex: 1; margin: 0; background: #0284c7;">帖子内容统计</button>
        <button class="ns-btn-primary" id="ns-btn-clear-tasks" style="flex: 1; margin: 0; background: #dc2626;" title="清空所有导入的 JSON 智能任务">清空所有任务</button>
      </div>
    `;
    contentWrapper.appendChild(panelControl);

    // 2. AI 配置页
    const panelAI = document.createElement('div');
    panelAI.id = 'ns-panel-ai';
    panelAI.className = 'ns-tab-panel';
    panelAI.innerHTML = `
      <div class="ns-group">
        <span class="ns-label">API Key</span>
        <input type="password" class="ns-input" id="ns-api-key" value="${config.apiKey}" placeholder="sk-...">
      </div>
      <div class="ns-group">
        <span class="ns-label">API Base URL</span>
        <input type="text" class="ns-input" id="ns-api-url" value="${config.apiUrl}" placeholder="https://api.openai.com/v1">
      </div>
      <div class="ns-group">
        <span class="ns-label">模型模型 (Model)</span>
        <input type="text" class="ns-input" id="ns-model" value="${config.model}" placeholder="gpt-4o-mini">
      </div>
      <div class="ns-group">
        <span class="ns-label">系统 Prompt (引导生成风格)</span>
        <textarea class="ns-textarea" id="ns-system-prompt">${config.systemPrompt}</textarea>
      </div>
      <button class="ns-btn-primary" id="ns-btn-save-ai">保存 AI 配置</button>
    `;
    contentWrapper.appendChild(panelAI);

    // 3. 预设回复页
    const panelPresets = document.createElement('div');
    panelPresets.id = 'ns-panel-presets';
    panelPresets.className = 'ns-tab-panel';
    panelPresets.innerHTML = `
      <div class="ns-group" style="flex: 1; display: flex; flex-direction: column;">
        <span class="ns-label">自定义匹配回复配置 (---分隔分组)</span>
        <textarea class="ns-textarea" id="ns-presets-text" style="flex: 1; min-height: 250px; font-family: monospace; font-size: 11px;">${config.presetsText}</textarea>
      </div>
      <button class="ns-btn-primary" id="ns-btn-save-presets">保存预设配置</button>
    `;
    contentWrapper.appendChild(panelPresets);

    // 4. 日志页
    const panelLog = document.createElement('div');
    panelLog.id = 'ns-panel-log';
    panelLog.className = 'ns-tab-panel';
    panelLog.innerHTML = `
      <div class="ns-label" style="display:flex; justify-content:space-between; align-items:center;">
        <span>运行实时日志</span>
        <button class="ns-btn-icon" id="ns-btn-clear-log" title="清除日志" style="padding:2px;">🗑️</button>
      </div>
      <div class="ns-log-container" id="ns-log-container"></div>
    `;
    contentWrapper.appendChild(panelLog);
    runtime.logContainer = panelLog.querySelector('#ns-log-container');

    // 页脚
    const footer = document.createElement('div');
    footer.className = 'ns-footer';
    footer.innerHTML = `
      <span>状态: <strong id="ns-status-text" style="color: var(--ns-fg); opacity: 0.8;">空闲</strong> | 智能任务: <strong id="ns-task-count-text" style="color: var(--ns-accent);">0</strong></span>
      <span>NS任务助手 v1.6.0</span>
    `;
    panel.appendChild(footer);

    shadow.appendChild(panel);

    // ==================== 逻辑交互绑定 ====================

    // 拖动头部
    setupDragging(panel, header);

    // 最小化 / 展开
    const minBtn = header.querySelector('#ns-btn-minimize');
    minBtn.addEventListener('click', () => {
      panel.classList.toggle('minimized');
      if (panel.classList.contains('minimized')) {
        minBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`;
        minBtn.title = "展开";
      } else {
        minBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
        minBtn.title = "最小化";
      }
    });

    // 选项卡切换
    const tabs = tabsContainer.querySelectorAll('.ns-tab');
    const tabPanels = contentWrapper.querySelectorAll('.ns-tab-panel');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-target');
        contentWrapper.querySelector(`#${targetId}`).classList.add('active');
      });
    });

    // 双向绑定 Sliders 数值显示与配置保存
    const bindSlider = (sliderId, valId, configKey, suffix = '') => {
      const slider = panelControl.querySelector(`#${sliderId}`);
      const valDisplay = panelControl.querySelector(`#${valId}`);
      slider.addEventListener('input', () => {
        valDisplay.textContent = `${slider.value}${suffix}`;
        GM_setValue(`ns_auto_reply_${configKey}`, Number(slider.value));
      });
    };

    bindSlider('ns-min-views', 'val-min-views', 'minViews');
    bindSlider('ns-min-comments', 'val-min-comments', 'minComments');
    bindSlider('ns-interval', 'val-interval', 'interval', 's');
    bindSlider('ns-max-count', 'val-max-count', 'maxCount');

    // 双向绑定文本框
    const bindInput = (inputId, configKey) => {
      const input = panelControl.querySelector(`#${inputId}`);
      input.addEventListener('change', () => {
        GM_setValue(`ns_auto_reply_${configKey}`, input.value.trim());
      });
    };

    bindInput('ns-kw-filter', 'kwFilter');
    bindInput('ns-kw-block', 'kwBlock');
    bindInput('ns-id-block', 'idBlock');
    bindInput('ns-user-block', 'userBlock');

    // 绑定配色选择器
    const bgInput = panelControl.querySelector('#ns-color-bg');
    const fgInput = panelControl.querySelector('#ns-color-fg');
    const accentInput = panelControl.querySelector('#ns-color-accent');

    const updateThemeColors = () => {
      panel.style.setProperty('--ns-bg', bgInput.value);
      panel.style.setProperty('--ns-fg', fgInput.value);
      panel.style.setProperty('--ns-accent', accentInput.value);
      GM_setValue('ns_auto_reply_bgColor', bgInput.value);
      GM_setValue('ns_auto_reply_fgColor', fgInput.value);
      GM_setValue('ns_auto_reply_accentColor', accentInput.value);
    };

    bgInput.addEventListener('input', updateThemeColors);
    fgInput.addEventListener('input', updateThemeColors);
    accentInput.addEventListener('input', updateThemeColors);

    // 重置主题配色
    const resetThemeBtn = panelControl.querySelector('#ns-btn-reset-theme');
    resetThemeBtn.addEventListener('click', () => {
      bgInput.value = '#FFFDF5';
      fgInput.value = '#101010';
      accentInput.value = '#CB4B16';
      updateThemeColors();
      addLog('🎨 已重置主题颜色为默认配置 (Background #FFFDF5 / Foreground #101010 / Accent #CB4B16)。', 'info');
    });

    // AI 启用开关绑定
    const aiEnabledCheck = panelControl.querySelector('#ns-ai-enabled');
    aiEnabledCheck.addEventListener('change', () => {
      GM_setValue('ns_auto_reply_aiEnabled', aiEnabledCheck.checked);
      addLog(`AI 生成润色回复: ${aiEnabledCheck.checked ? '已开启' : '已关闭'}`);
    });

    // AI 设置保存
    const saveAiBtn = panelAI.querySelector('#ns-btn-save-ai');
    saveAiBtn.addEventListener('click', () => {
      GM_setValue('ns_auto_reply_apiKey', panelAI.querySelector('#ns-api-key').value.trim());
      GM_setValue('ns_auto_reply_apiUrl', panelAI.querySelector('#ns-api-url').value.trim());
      GM_setValue('ns_auto_reply_model', panelAI.querySelector('#ns-model').value.trim());
      GM_setValue('ns_auto_reply_systemPrompt', panelAI.querySelector('#ns-system-prompt').value.trim());
      
      addLog('💾 AI 接口与 Prompt 偏好已成功存入本地。', 'success');
    });

    // 预设回复保存
    const savePresetsBtn = panelPresets.querySelector('#ns-btn-save-presets');
    savePresetsBtn.addEventListener('click', () => {
      const val = panelPresets.querySelector('#ns-presets-text').value.trim();
      try {
        parsePresets(val); // 验证格式是否符合
        GM_setValue('ns_auto_reply_presetsText', val);
        addLog('💾 本地预设关键词分类随机回复库已存入。', 'success');
      } catch (e) {
        addLog('❌ 预设保存失败，请检查格式是否正确。', 'error');
      }
    });

    // 清空日志
    const clearLogBtn = panelLog.querySelector('#ns-btn-clear-log');
    clearLogBtn.addEventListener('click', () => {
      runtime.logContainer.innerHTML = '';
      addLog('日志控制台已清空。', 'info');
    });

    // 启动/停止回帖按钮
    const startBtn = panelControl.querySelector('#ns-btn-start');
    runtime.startBtn = startBtn;
    
    const statusText = footer.querySelector('#ns-status-text');

    startBtn.addEventListener('click', () => {
      if (runtime.isRunning) {
        stopReplier();
        statusText.textContent = '已停止';
        statusText.style.color = '#f87171';
      } else {
        statusText.textContent = '运行中';
        statusText.style.color = '#4ade80';
        // 自动切到日志页方便用户观察
        tabs.forEach(t => t.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        tabsContainer.querySelector('[data-target="ns-panel-log"]').classList.add('active');
        panelLog.classList.add('active');
        
        startReplier();
      }
    });

    // 绑定导入 JSON 任务按钮
    const importBtn = panelControl.querySelector('#ns-btn-import-json');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    panelControl.appendChild(fileInput);

    importBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (!Array.isArray(parsed)) {
            throw new Error("JSON 根节点必须是一个数组");
          }
          
          const validTasks = [];
          for (let i = 0; i < parsed.length; i++) {
            const item = parsed[i];
            const taskType = item.taskType || "reply";
            
            if (taskType === "post") {
              const title = item.title;
              const content = item.content;
              const category = item.category || "info";
              if (!title || !content) {
                throw new Error(`第 ${i + 1} 项发帖数据格式不正确，必须包含 title 和 content 字段`);
              }
              validTasks.push({
                taskType: "post",
                taskId: item.taskId || `post_${Date.now()}_${i}`,
                title: String(title).trim(),
                content: String(content).trim(),
                category: String(category).trim()
              });
            } else {
              const postId = item.postId || item.id;
              const reply = item.reply;
              if (!postId || !reply) {
                throw new Error(`第 ${i + 1} 项回帖数据格式不正确，必须包含 postId/id 和 reply 字段`);
              }
              validTasks.push({
                taskType: "reply",
                postId: String(postId).trim(),
                title: (item.title || "").trim(),
                reply: String(reply).trim()
              });
            }
          }

          const existing = GM_getValue('ns_auto_reply_imported_tasks', []);
          const merged = [...existing];
          
          validTasks.forEach(newTask => {
            let idx = -1;
            if (newTask.taskType === "post") {
              idx = merged.findIndex(t => t.taskType === "post" && (t.taskId === newTask.taskId || t.title === newTask.title));
            } else {
              idx = merged.findIndex(t => t.taskType !== "post" && String(t.postId) === String(newTask.postId));
            }
            if (idx >= 0) {
              merged[idx] = newTask;
            } else {
              merged.push(newTask);
            }
          });

          GM_setValue('ns_auto_reply_imported_tasks', merged);
          addLog(`📥 成功导入 ${validTasks.length} 个 AI 智能任务！当前累计待处理智能任务: ${merged.length} 个。`, 'success');
          updateImportCountUI();
          
          fileInput.value = '';
        } catch (err) {
          addLog(`❌ 解析并导入 JSON 任务失败: ${err.message}`, 'error');
          alert(`导入失败: ${err.message}`);
        }
      };
      reader.readAsText(file);
    });

    // 绑定帖子内容统计按钮
    const statsBtn = panelControl.querySelector('#ns-btn-stats');
    statsBtn.addEventListener('click', async () => {
      const limitInput = prompt("请输入需要统计的符合条件的帖子数量上限：", "10");
      if (limitInput === null) return;
      const limit = parseInt(limitInput) || 10;

      // 切换到日志页面
      tabs.forEach(t => t.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      tabsContainer.querySelector('[data-target="ns-panel-log"]').classList.add('active');
      panelLog.classList.add('active');

      try {
        statsBtn.disabled = true;
        statsBtn.textContent = '统计中...';
        await runStatsCollection(limit);
      } catch (err) {
        addLog(`❌ 统计过程中发生错误: ${err.message}`, 'error');
      } finally {
        statsBtn.disabled = false;
        statsBtn.textContent = '帖子内容统计';
      }
    });

    // 绑定清空所有任务按钮
    const clearTasksBtn = panelControl.querySelector('#ns-btn-clear-tasks');
    clearTasksBtn.addEventListener('click', () => {
      const importedTasks = GM_getValue('ns_auto_reply_imported_tasks', []);
      if (importedTasks.length === 0) {
        alert('当前没有待处理的智能任务！');
        return;
      }
      if (confirm(`确定要清空所有已导入的智能任务吗？共 ${importedTasks.length} 个任务。`)) {
        GM_setValue('ns_auto_reply_imported_tasks', []);
        GM_setValue('ns_auto_reply_smart_mode', false);
        runtime.queue = runtime.queue.filter(t => !t.importedReply);
        updateImportCountUI();
        addLog('🗑️ 已成功清空所有待处理的智能任务！', 'success');
      }
    });

    // 页面初始化日志提示
    addLog('👋 欢迎使用 NodeSeek 自动回帖/水贴助手！', 'success');
    addLog('💡 优先使用 [DOM 模拟拟人化] 双通道回帖，失败自动切换到 [API 发包] 模式。', 'info');
    addLog('🛡️ 已支持多维度屏蔽（特定关键词、帖子ID及发帖用户名/编号），助您安心挂机。', 'success');
  }

  // ==================== 初始化入口 ====================
  function init() {
    injectUI();
    updateImportCountUI();

    // 检测跨页运行标记，并自动恢复运行状态
    const autoStart = GM_getValue('ns_auto_reply_running_state', false);
    if (autoStart) {
      addLog('🔄 检测到跨页连续运行标记，已自动恢复运行中...', 'success');
      setTimeout(() => {
        const startBtn = runtime.panel?.querySelector('#ns-btn-start');
        const statusText = runtime.panel?.querySelector('#ns-status-text');
        if (startBtn && !runtime.isRunning) {
          if (statusText) {
            statusText.textContent = '运行中';
            statusText.style.color = '#4ade80';
          }
          startReplier(true); // 传入 true 表示跨页恢复，加载持久化回复计数
        }
      }, 1500); // 留出 1.5s 缓存时间让 DOM 准备就绪
    }
  }

  // 等待 DOM 加载完毕
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }

})();
