# 任务清单 (Task List) - 2026-05-21 创建

用于记录整个项目的计划、执行与结果。

## 任务拆解与状态追踪

- [x] **1. 项目初始化与基本骨架**
  - [x] 1.1 使用 Vite 创建 Vanilla JS/HTML 基础工程
  - [x] 1.2 清理默认模板，创建所需的目录结构（`src/` 及其子目录）
  - [x] 1.3 安装必要的依赖（通常为静态应用）
- [x] **2. 复古温馨的 UI 界面与 CSS 样式系统 (Vanilla CSS)**
  - [x] 2.1 建立全局 CSS 变量（米色纸张背景、暗绿/暖橘回忆调、玻璃拟物化面板）
  - [x] 2.2 设计自适应的主窗口布局（左侧剧情/NPC 对话，右侧人生分支轨迹树，上方 API/存档控制栏）
  - [x] 2.3 编写“时空倒流”特效（模糊、旋转、倒带灰色滤镜）与流式打字机打字动效
- [x] **3. AI 对局与核心逻辑引擎**
  - [x] 3.1 编写 `src/npcAssets.js`（预设 NPC 数据、属性结构与 Prompt 模板）
  - [x] 3.2 编写 `src/main.js` 中的核心状态机（管理当前节点、玩家属性、NPC状态）
  - [x] 3.3 实现 AI 客户端（兼容标准 OpenAI 协议，对接中转站，处理自定义 Base URL 与 Key）
  - [x] 3.4 编写 LocalStorage 自动存档与 JSON 文件下载导入/导出模块
- [x] **4. 蝴蝶效应分支树 Canvas 绘制**
  - [x] 4.1 编写 `src/butterflyTree.js`，基于 HTML5 Canvas 绘制动态分裂的人生轨迹节点树
  - [x] 4.2 实现树图 of 鼠标拖拽拖动、滚轮缩放、以及点击历史节点回溯的交互
- [x] **5. NPC 动态数字人表现层 (立绘与 Web Speech 语音)**
  - [x] 5.1 制作/集成 NPC 的 SVG 呼吸眨眼立绘，能够根据 AI 返回的情绪值自动切换表情
  - [x] 5.2 编写 TTS 语音渲染器（调用 Web Speech API 同步朗读剧情与对话）
- [x] **6. 系统集成与综合调试**
  - [x] 6.1 跑通“初始剧情 -> 抉择 -> AI 生成 -> 分支分裂 -> 属性变化”的完整主循环
  - [x] 6.2 进行中转站 API 实调测试并排查 JSON 截断或格式错误
  - [x] 6.3 验证 Cloudflare Pages 静态构建，确保无编译异常

- [x] **7. CORS 跨域代理与 CF 部署优化**
  - [x] 7.1 新建 `vite.config.js`，添加本地开发 `/api-proxy` 动态转发配置
  - [x] 7.2 新建 `functions/api-proxy/[[path]].js`，为 Cloudflare 部署配置动态代理函数
  - [x] 7.3 在 `src/main.js` 中启用 `/api-proxy` 代理转发，彻底消除浏览器的跨域拦截与超时问题
- [x] **8. 免配置体验通道 (Gemini) 功能同步与 GitHub 代码提交**
  - [x] 8.1 验证本地构建 `npm run build`，确保无编译警告或错误
  - [x] 8.2 检查本地 Git 状态，确认包含免配置体验通道的前后端代码 (api-game.js, main.js, css, html等)
  - [x] 8.3 将本次修改进行本地 Git 暂存 (git add) 并提交 (git commit)
  - [x] 8.4 推送代码至 GitHub 远程仓库 (git push origin main)
  - [x] 8.5 记录本次构建与测试结果到 `Build_And_Test_Report.md` 并更新 `AI沟通记录`
