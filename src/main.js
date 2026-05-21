import './style.css';
import { 
  INITIAL_PLAYER_STATS, 
  INITIAL_NPCS, 
  INITIAL_STORY_NODE, 
  SYSTEM_PROMPT, 
  getAvatarSvg 
} from './npcAssets.js';
import { TimeBranchTree } from './butterflyTree.js';

// ==========================================================================
// 1. 全局游戏状态 (Game State)
// ==========================================================================
let gameData = {
  nodes: {},            // 时空树的所有节点映射 { id: LifeNode }
  rootId: 'root_node',
  currentNodeId: 'root_node',
  playerStats: { ...INITIAL_PLAYER_STATS },
  npcs: JSON.parse(JSON.stringify(INITIAL_NPCS))
};

// 时空分支树 Canvas 实例
let branchTreeInstance = null;

// 时空回溯时的临时目标节点
let rewindTargetId = null;

// 打字机与语音朗读定时器/实例
let typewriterTimer = null;
let currentUtterance = null;

// ==========================================================================
// 2. AI 多渠道配置状态 (AI Config State)
// ==========================================================================
const DEFAULT_AI_CONFIG = {
  preset: 'free-gemini',
  baseUrl: '',
  apiKey: '',
  model: 'gemini-2.5-flash-lite'
};

let aiConfig = { ...DEFAULT_AI_CONFIG };

const STORAGE_KEYS = {
  save: 'game_life_save',
  saveBackup: 'game_life_save_backup',
  aiConfig: 'game_life_ai_config',
  anonymousUserId: 'game_life_anonymous_user_id'
};
const SAVE_SCHEMA_VERSION = 1;

// ==========================================================================
// 3. UI 元素缓存
// ==========================================================================
const DOM = {
  // 控制按钮
  btnSaveCenter: document.getElementById('btn-save-center'),
  btnAiConfig: document.getElementById('btn-ai-config'),
  btnResetGame: document.getElementById('btn-reset-game'),
  btnZoomIn: document.getElementById('btn-zoom-in'),
  btnZoomOut: document.getElementById('btn-zoom-out'),
  btnZoomReset: document.getElementById('btn-zoom-reset'),
  
  // 属性展示
  statCourage: document.getElementById('stat-courage'),
  statHonesty: document.getElementById('stat-honesty'),
  statEmpathy: document.getElementById('stat-empathy'),
  valCourage: document.getElementById('val-courage'),
  valHonesty: document.getElementById('val-honesty'),
  valEmpathy: document.getElementById('val-empathy'),

  // NPC 栏目
  npcMother: document.getElementById('npc-mother'),
  npcClassmate: document.getElementById('npc-classmate'),
  npcFriend: document.getElementById('npc-friend'),
  motherEmotion: document.getElementById('mother-emotion'),
  motherAffinity: document.getElementById('mother-affinity'),
  classmateEmotion: document.getElementById('classmate-emotion'),
  classmateAffinity: document.getElementById('classmate-affinity'),
  friendEmotion: document.getElementById('friend-emotion'),
  friendAffinity: document.getElementById('friend-affinity'),
  
  // 剧情及输入
  currentAgeTag: document.getElementById('current-age-tag'),
  storyContent: document.getElementById('story-content'),
  optionsList: document.getElementById('options-list'),
  inputCustomAction: document.getElementById('input-custom-action'),
  btnSubmitAction: document.getElementById('btn-submit-action'),
  
  // 弹窗
  modalAiConfig: document.getElementById('modal-ai-config'),
  modalSaveCenter: document.getElementById('modal-save-center'),
  modalConfirmRewind: document.getElementById('modal-confirm-rewind'),
  
  // 弹窗控制
  btnCloseAi: document.getElementById('btn-close-ai'),
  btnSaveAi: document.getElementById('btn-save-ai'),
  btnCloseSave: document.getElementById('btn-close-save'),
  btnExportSave: document.getElementById('btn-export-save'),
  btnImportTrigger: document.getElementById('btn-import-trigger'),
  fileImportSave: document.getElementById('file-import-save'),
  
  // 回溯二次确认
  rewindNodeTitle: document.getElementById('rewind-node-title'),
  btnCancelRewind: document.getElementById('btn-cancel-rewind'),
  btnConfirmRewind: document.getElementById('btn-confirm-rewind'),
  
  // 弹出提示和过渡遮罩
  timeTravelOverlay: document.getElementById('time-travel-overlay'),
  saveNodeCount: document.getElementById('save-node-count'),
  aiPreset: document.getElementById('ai-preset'),
  aiBaseUrl: document.getElementById('ai-base-url'),
  aiApiKey: document.getElementById('ai-api-key'),
  aiModel: document.getElementById('ai-model')
};

// ==========================================================================
// 4. 游戏数据初始化与存档管理 (LocalStorage / JSON)
// ==========================================================================

// 加载 AI 配置
function loadAiConfig() {
  const saved = localStorage.getItem(STORAGE_KEYS.aiConfig);
  if (saved) {
    try {
      aiConfig = { ...DEFAULT_AI_CONFIG, ...JSON.parse(saved) };
      migrateLegacyNengpaConfig();
    } catch (e) {
      console.error('加载 AI 配置失败，恢复默认值');
    }
  }
  updateAiConfigForm();
}

function migrateLegacyNengpaConfig() {
  const isNengpaPreset = aiConfig.preset === 'nengpa';
  const isMiniMaxDefault = aiConfig.model === 'MiniMax-M2.7';
  const isOldOpenAiBase = aiConfig.baseUrl === 'https://api.nengpa.com/v1';
  if (isNengpaPreset && isMiniMaxDefault && isOldOpenAiBase) {
    aiConfig.baseUrl = 'https://api.nengpa.com/anthropic';
    localStorage.setItem(STORAGE_KEYS.aiConfig, JSON.stringify(aiConfig));
  }
}

// 刷新 AI 配置弹窗中的表单值
function updateAiConfigForm() {
  DOM.aiPreset.value = aiConfig.preset;
  DOM.aiBaseUrl.value = aiConfig.baseUrl;
  DOM.aiApiKey.value = aiConfig.apiKey;
  DOM.aiModel.value = aiConfig.model;
  updateAiConfigFieldVisibility();
}

// 保存 AI 配置
function saveAiConfigFromForm() {
  aiConfig.preset = DOM.aiPreset.value;
  aiConfig.baseUrl = DOM.aiBaseUrl.value.trim();
  aiConfig.apiKey = DOM.aiApiKey.value.trim();
  aiConfig.model = DOM.aiModel.value.trim();

  localStorage.setItem(STORAGE_KEYS.aiConfig, JSON.stringify(aiConfig));
  DOM.modalAiConfig.classList.add('hidden');
  
  // 激活按钮
  checkApiConfiguration();
  renderOptionsForCurrentNode();
  
  // 如果当前是初始加载状态，且已经填好了 Key，直接开始
  if (Object.keys(gameData.nodes).length === 0) {
    initNewGame();
  }
}

// 检查 API 配置，判断是否启用按钮锁定
function checkApiConfiguration() {
  const usesBuiltInFreeChannel = aiConfig.preset === 'free-gemini';
  const hasKey = !!aiConfig.apiKey;
  if (!usesBuiltInFreeChannel && !hasKey) {
    DOM.optionsList.innerHTML = `<button class="option-btn locked" id="btn-unlock-api">⚠️ 请先点击右上角“⚙️ AI配置”填入 API Key 激活人生</button>`;
    const unlockBtn = document.getElementById('btn-unlock-api');
    if (unlockBtn) {
      unlockBtn.onclick = () => DOM.modalAiConfig.classList.remove('hidden');
    }
    DOM.inputCustomAction.disabled = true;
    DOM.btnSubmitAction.disabled = true;
  } else {
    // 若已有数据，则不需锁死
    DOM.inputCustomAction.disabled = false;
    DOM.btnSubmitAction.disabled = false;
  }
  return usesBuiltInFreeChannel || hasKey;
}

// 自动存档至 LocalStorage
function autoSaveGame() {
  if (!isValidSaveData(gameData)) {
    console.warn('存档被拒绝：当前 gameData 结构不完整，已保留用户旧存档。');
    return;
  }

  const previousSave = localStorage.getItem(STORAGE_KEYS.save);
  if (previousSave) {
    localStorage.setItem(STORAGE_KEYS.saveBackup, previousSave);
  }

  const saveData = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    nodes: gameData.nodes,
    rootId: gameData.rootId,
    currentNodeId: gameData.currentNodeId,
    playerStats: gameData.playerStats,
    npcs: gameData.npcs
  };
  localStorage.setItem(STORAGE_KEYS.save, JSON.stringify(saveData));
  
  // 更新存档中心的数据统计
  if (DOM.saveNodeCount) {
    DOM.saveNodeCount.textContent = Object.keys(gameData.nodes).length;
  }
}

// 从 LocalStorage 加载游戏状态
function tryLoadGame() {
  const saved = localStorage.getItem(STORAGE_KEYS.save);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (isValidSaveData(parsed)) {
        gameData = parsed;
        return true;
      }
    } catch (e) {
      console.error('加载存档失败，尝试使用备份存档');
    }
  }

  const backup = localStorage.getItem(STORAGE_KEYS.saveBackup);
  if (backup) {
    try {
      const parsedBackup = JSON.parse(backup);
      if (isValidSaveData(parsedBackup)) {
        gameData = parsedBackup;
        localStorage.setItem(STORAGE_KEYS.save, backup);
        return true;
      }
    } catch (e) {
      console.error('备份存档也无法读取，将保留原始数据并进入离线预览');
    }
  }

  return false;
}

function isValidSaveData(data) {
  return !!(
    data
    && data.nodes
    && typeof data.nodes === 'object'
    && data.rootId
    && data.currentNodeId
    && data.nodes[data.rootId]
    && data.nodes[data.currentNodeId]
    && data.playerStats
    && data.npcs
  );
}

// 开启全新一局游戏
function initNewGame() {
  preserveCurrentSaveAsBackup();
  gameData.nodes = {};
  gameData.nodes[INITIAL_STORY_NODE.id] = JSON.parse(JSON.stringify(INITIAL_STORY_NODE));
  gameData.rootId = INITIAL_STORY_NODE.id;
  gameData.currentNodeId = INITIAL_STORY_NODE.id;
  gameData.playerStats = { ...INITIAL_PLAYER_STATS };
  gameData.npcs = JSON.parse(JSON.stringify(INITIAL_NPCS));

  renderStoryNode(gameData.currentNodeId);
  updateBranchTree();
  autoSaveGame();
}

// ==========================================================================
// 5. UI 渲染与动态 NPC 情感立绘表现层
// ==========================================================================

// 更新性格属性进度条
function renderPlayerStats() {
  const stats = gameData.playerStats;
  const updateBar = (statId, valId, val) => {
    const valClamped = Math.max(0, Math.min(100, val));
    document.getElementById(statId).style.width = `${valClamped}%`;
    document.getElementById(valId).textContent = valClamped;
  };
  updateBar('stat-courage', 'val-courage', stats.courage);
  updateBar('stat-honesty', 'val-honesty', stats.honesty);
  updateBar('stat-empathy', 'val-empathy', stats.empathy);
}

// 动态载入 NPC 的 SVG 表情立绘
function renderNpcAvatars() {
  const npcs = gameData.npcs;
  
  const updateNpcSlot = (slotId, nameId, affinityId, emotionId, npcObj) => {
    const container = document.querySelector(`#${slotId} .npc-sprite-container`);
    if (container) {
      // 传入 NPC 唯一标识及当前大模型返回的情绪，动态拼接 SVG
      container.innerHTML = getAvatarSvg(npcObj.id, npcObj.emotion);
    }
    
    // 更新文本标签
    document.getElementById(affinityId).textContent = `好感: ${npcObj.affection}`;
    
    // 中文情绪显示
    const emotionCn = {
      neutral: '平静',
      happy: '高兴 ☀️',
      angry: '生气 💢',
      sad: '难过 🌧️',
      surprised: '惊讶 ⚡'
    };
    
    const badge = document.getElementById(emotionId);
    badge.textContent = emotionCn[npcObj.emotion] || '平静';
    
    // 动态增删情绪样式
    badge.className = `npc-badge emotion-badge emotion-${npcObj.emotion}`;
  };

  updateNpcSlot('npc-mother', 'mother-name', 'mother-affinity', 'mother-emotion', npcs.mother);
  updateNpcSlot('npc-classmate', 'classmate-name', 'classmate-affinity', 'classmate-emotion', npcs.classmate);
  updateNpcSlot('npc-friend', 'friend-name', 'friend-affinity', 'friend-emotion', npcs.friend);
}

// 文字打字机特效与语音朗读
function playTypewriterAndSpeech(text) {
  // 1. 清除任何正在运行的打字机
  if (typewriterTimer) {
    clearInterval(typewriterTimer);
  }
  DOM.storyContent.innerHTML = '';
  
  // 2. 终止当前任何正在播放的声音
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // 3. 解析文本，提炼 NPC 专属的台词段落
  // 规则：AI 在剧情中输出的“林素琴：“宝贝，写作业了””会被提炼出专门样式
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  let currentParaIndex = 0;

  function renderNextParagraph() {
    if (currentParaIndex >= paragraphs.length) {
      // 所有文字打字机绘制完毕，展示选项
      renderOptionsForCurrentNode();
      return;
    }

    const rawText = paragraphs[currentParaIndex];
    let isNpcSpeech = false;
    let speakerKey = ''; // 'mother', 'classmate', 'friend', 'dm'
    let displayName = '';
    let speechContent = rawText;

    // 检测说话者
    if (rawText.includes('林素琴：') || rawText.includes('妈妈：')) {
      isNpcSpeech = true;
      speakerKey = 'mother';
      displayName = '林素琴 (母亲)';
      speechContent = rawText.replace(/(林素琴|妈妈)：/g, '');
    } else if (rawText.includes('苏清婉：') || rawText.includes('同桌：')) {
      isNpcSpeech = true;
      speakerKey = 'classmate';
      displayName = '苏清婉 (同桌)';
      speechContent = rawText.replace(/(苏清婉|同桌)：/g, '');
    } else if (rawText.includes('张小胖：') || rawText.includes('发小：') || rawText.includes('死党：')) {
      isNpcSpeech = true;
      speakerKey = 'friend';
      displayName = '张小胖 (发小)';
      speechContent = rawText.replace(/(张小胖|发小|死党)：/g, '');
    }

    // 激活舞台上对应说话 NPC 的高亮，淡出其他
    if (isNpcSpeech && speakerKey) {
      document.querySelectorAll('.npc-slot').forEach(slot => slot.classList.remove('active'));
      const activeSlot = document.getElementById(`npc-${speakerKey}`);
      if (activeSlot) activeSlot.classList.add('active');
    } else {
      // 旁白 DM 状态，全部淡出/或保持原样
      document.querySelectorAll('.npc-slot').forEach(slot => slot.classList.remove('active'));
    }

    // 创建段落 DOM
    const paraElement = document.createElement('p');
    paraElement.className = `story-paragraph ${isNpcSpeech ? 'npc-speech' : ''}`;
    
    if (isNpcSpeech) {
      paraElement.innerHTML = `<span class="speaker-name">${displayName}</span><span class="text-body"></span>`;
    } else {
      paraElement.innerHTML = `<span class="text-body"></span>`;
    }
    DOM.storyContent.appendChild(paraElement);
    
    const textBodySpan = paraElement.querySelector('.text-body');
    let charIndex = 0;
    
    // 朗读当前段落
    speakText(speechContent, speakerKey);

    // 打字机循环
    typewriterTimer = setInterval(() => {
      if (charIndex < rawText.length) {
        // 如果是NPC说话，只打字台词内容，但为了视觉统一，我们可以直接打字整句
        textBodySpan.textContent += rawText[charIndex];
        charIndex++;
        // 自动卷动至底部
        DOM.storyContent.scrollTop = DOM.storyContent.scrollHeight;
      } else {
        clearInterval(typewriterTimer);
        currentParaIndex++;
        // 延迟一秒绘制下一段
        setTimeout(renderNextParagraph, 800);
      }
    }, 25); // 打字速度：25ms/字
  }

  renderNextParagraph();
}

// 调用 Web Speech API 朗读文本
function speakText(text, speakerKey) {
  if (!window.speechSynthesis) return;

  // 移出括号及提示文字
  const cleanSpeech = text.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();
  if (!cleanSpeech) return;

  currentUtterance = new SpeechSynthesisUtterance(cleanSpeech);
  
  // 获取浏览器中文声音包
  const voices = window.speechSynthesis.getVoices();
  const zhVoices = voices.filter(v => v.lang.includes('zh') || v.lang.includes('ZH'));
  
  if (zhVoices.length > 0) {
    // 智能为不同角色挑选最合适的声音模型
    if (speakerKey === 'mother') {
      // 寻找成熟温润的普通话女声 (如 Yaoyao)
      const yy = zhVoices.find(v => v.name.includes('Yaoyao') || v.name.includes('Liting') || v.name.includes('Huihui'));
      currentUtterance.voice = yy || zhVoices[0];
      currentUtterance.pitch = 0.95; // 音高稍低，有威严
      currentUtterance.rate = 1.0;
    } else if (speakerKey === 'classmate') {
      // 寻找清脆温柔的普通话女声 (如 Xiaoxiao)
      const xx = zhVoices.find(v => v.name.includes('Xiaoxiao') || v.name.includes('Kangkang'));
      currentUtterance.voice = xx || zhVoices[0];
      currentUtterance.pitch = 1.15; // 少女音调偏高
      currentUtterance.rate = 1.05;
    } else if (speakerKey === 'friend') {
      // 寻找偏少年的男声或女声
      const boy = zhVoices.find(v => v.name.includes('Yunxi') || v.name.includes('Xiaoxiao'));
      currentUtterance.voice = boy || zhVoices[0];
      currentUtterance.pitch = 1.1;
      currentUtterance.rate = 1.15; // 胖子说话快些
    } else {
      // DM旁白：平缓中性
      const dm = zhVoices.find(v => v.name.includes('Yunjian') || v.name.includes('Yunxi') || v.name.includes('Kangkang'));
      currentUtterance.voice = dm || zhVoices[0];
      currentUtterance.pitch = 1.0;
      currentUtterance.rate = 0.95; // 旁白慢而沉浸
    }
  }
  
  window.speechSynthesis.speak(currentUtterance);
}

// 刷新树图显示
function updateBranchTree() {
  if (!branchTreeInstance) {
    branchTreeInstance = new TimeBranchTree('tree-canvas', 'canvas-container', (nodeId) => {
      triggerNodeSelectionPreview(nodeId);
    });
  }
  branchTreeInstance.setData(gameData.nodes, gameData.rootId, gameData.currentNodeId);
}

// 渲染指定节点的完整游戏状态
function renderStoryNode(nodeId) {
  const node = gameData.nodes[nodeId];
  if (!node) return;

  // 1. 同步全局状态
  gameData.currentNodeId = nodeId;
  gameData.playerStats = { ...node.playerStats };
  gameData.npcs = JSON.parse(JSON.stringify(node.npcStates));

  // 2. 更新上方岁数 Banner
  DOM.currentAgeTag.textContent = `⏳ ${node.age} 岁 · ${getAgePeriod(node.age)}`;

  // 3. 更新主角属性和 NPC 立绘
  renderPlayerStats();
  renderNpcAvatars();

  // 4. 播放打字机与配音，在完成打字后会加载选项
  playTypewriterAndSpeech(node.storyText);
}

// 根据岁数获得学龄称呼
function getAgePeriod(age) {
  if (age <= 6) return '幼儿时期';
  if (age === 7) return '小学一年级';
  if (age === 8) return '小学二年级';
  if (age === 9) return '小学三年级';
  if (age === 10) return '小学四年级';
  if (age === 11) return '小学五年级';
  if (age === 12) return '小学六年级';
  return '青葱少年';
}

// 根据当前节点的选项配置展示选项区
function renderOptionsForCurrentNode() {
  const node = gameData.nodes[gameData.currentNodeId];
  if (!node) return;

  // 锁定检查
  const isApiConfigured = checkApiConfiguration();
  if (!isApiConfigured) return;

  DOM.optionsList.innerHTML = '';
  
  // 渲染选项
  const opts = node.options || ['继续前进...', '回味当前状态...', '做出新的打算...'];
  opts.forEach((optText, index) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = `${index + 1}. ${optText}`;
    btn.onclick = () => handlePlayerChoice(optText);
    DOM.optionsList.appendChild(btn);
  });

  // 激活自定义输入
  DOM.inputCustomAction.disabled = false;
  DOM.btnSubmitAction.disabled = false;
  DOM.inputCustomAction.value = '';
}

// ==========================================================================
// 6. AI 剧情演变推演主流程 (Butterfly Ripple Cycle)
// ==========================================================================

async function handlePlayerChoice(choiceText) {
  // 1. 锁死交互，防连击
  DOM.optionsList.innerHTML = `
    <div class="ai-loading-card" role="status" aria-live="polite">
      <div class="ai-loading-orb" aria-hidden="true">⏳</div>
      <div class="ai-loading-copy">
        <strong>AI 正在推演新的时空分叉</strong>
        <span class="ai-loading-text">正在读取当前记忆、角色关系与蝴蝶效应</span>
        <div class="ai-loading-bar" aria-hidden="true"><span></span></div>
        <small>通常需要 20-90 秒，请保持页面开启。</small>
      </div>
    </div>`;
  DOM.inputCustomAction.disabled = true;
  DOM.btnSubmitAction.disabled = true;

  const currentNode = gameData.nodes[gameData.currentNodeId];
  
  // 2. 构建本次推演在 API 调用时的上下文 Prompt
  const promptContext = `
【当前时间线节点】
- 岁数：${currentNode.age} 岁
- 前序事件：${currentNode.title}
- 当前故事背景：
${currentNode.storyText}

【当前世界状态 (已在本地缓存)】
- 玩家性格属性：勇气 ${gameData.playerStats.courage}, 诚实 ${gameData.playerStats.honesty}, 共情 ${gameData.playerStats.empathy}
- 母亲 (林素琴)：好感 ${gameData.npcs.mother.affection}, 情绪 '${gameData.npcs.mother.emotion}'
- 同桌 (苏清婉)：好感 ${gameData.npcs.classmate.affection}, 情绪 '${gameData.npcs.classmate.emotion}'
- 发小 (张小胖)：好感 ${gameData.npcs.friend.affection}, 情绪 '${gameData.npcs.friend.emotion}'

【玩家当前做出的抉择】
玩家决定：“${choiceText}”

请根据大宪章规则，推演下一年（年龄递增1岁，变成 ${currentNode.age + 1} 岁）的全新剧情。
记住：必须用纯 JSON 格式返回！`;

  // 3. 调用 API 推演
  let aiResult = null;
  try {
    aiResult = await callLlmEngine(promptContext);
  } catch (err) {
    console.error('LLM API 发生故障:', err);
    DOM.storyContent.innerHTML += `<p class="story-paragraph" style="color: var(--color-danger)">⚠️ 时空扰动失败（接口调用出错，请检查右上角配置）：${err.message}</p>`;
    renderOptionsForCurrentNode();
    return;
  }

  if (!aiResult) {
    DOM.storyContent.innerHTML += `<p class="story-paragraph" style="color: var(--color-danger)">⚠️ 接口返回了空白响应，时空陷入停滞。</p>`;
    renderOptionsForCurrentNode();
    return;
  }

  // 4. 解析结果并创建全新子节点
  try {
    // 属性变化与好感刷新
    const nextAge = currentNode.age + 1;
    const newStats = {
      courage: Math.max(0, Math.min(100, gameData.playerStats.courage + (aiResult.playerStatsChange?.courage || 0))),
      honesty: Math.max(0, Math.min(100, gameData.playerStats.honesty + (aiResult.playerStatsChange?.honesty || 0))),
      empathy: Math.max(0, Math.min(100, gameData.playerStats.empathy + (aiResult.playerStatsChange?.empathy || 0)))
    };

    const newNpcs = JSON.parse(JSON.stringify(gameData.npcs));
    ['mother', 'classmate', 'friend'].forEach(key => {
      const delta = aiResult.npcStatusChanges?.[key] || {};
      newNpcs[key].affection = Math.max(0, Math.min(100, newNpcs[key].affection + (delta.affection || 0)));
      newNpcs[key].trust = Math.max(0, Math.min(100, newNpcs[key].trust + (delta.trust || 0)));
      if (delta.emotion) {
        newNpcs[key].emotion = delta.emotion;
      }
    });

    const childNodeId = `node_${Date.now()}`;
    const newTitle = choiceText.length > 10 ? choiceText.substring(0, 9) + '..' : choiceText;

    const newLifeNode = {
      id: childNodeId,
      parentId: currentNode.id,
      age: nextAge,
      title: newTitle,
      playerAction: choiceText,
      storyText: aiResult.storyText,
      npcStates: newNpcs,
      playerStats: newStats,
      options: aiResult.options || [],
      children: []
    };

    // 将新节点塞入树中并关联父节点
    gameData.nodes[childNodeId] = newLifeNode;
    currentNode.children.push(childNodeId);
    
    // 渲染新阶段
    gameData.currentNodeId = childNodeId;
    gameData.playerStats = newStats;
    gameData.npcs = newNpcs;

    // 自动存档与重绘 Canvas 树
    autoSaveGame();
    updateBranchTree();
    renderStoryNode(childNodeId);

  } catch (err) {
    console.error('解析剧情分支 JSON 失败:', err, aiResult);
    DOM.storyContent.innerHTML += `<p class="story-paragraph" style="color: var(--color-danger)">⚠️ AI 剧情解析故障（未返回合规的JSON，请点击重试）。</p>`;
    renderOptionsForCurrentNode();
  }
}

// 兼容各厂商标准协议的 API 请求发送端 (通过同源代理解决跨域CORS拦截与网络握手阻隔)
async function callLlmEngine(promptText) {
  if (aiConfig.preset === 'free-gemini') {
    return callFreeGeminiEngine(promptText);
  }

  const normalizedBaseUrl = normalizeApiBaseUrl(aiConfig.baseUrl);
  const useAnthropic = isAnthropicBaseUrl(normalizedBaseUrl);

  // 本地开发或线上部署均请求同源下的 api-proxy 路径
  const chatUrl = useAnthropic
    ? '/api-proxy/v1/messages'
    : '/api-proxy/chat/completions';

  // 剧情推演 prompt 较长，部分思考型模型首次响应会超过 15 秒
  const controller = new AbortController();
  const timeoutMs = useAnthropic ? 90000 : 60000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: buildLlmRequestHeaders(normalizedBaseUrl, useAnthropic),
      body: JSON.stringify(buildLlmRequestBody(promptText, useAnthropic)),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await readApiErrorText(response);
      throw new Error(`API 返回异常 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const rawContent = extractLlmTextContent(data, useAnthropic);
    if (!rawContent) {
      const serverMessage = data?.error?.message || data?.message || JSON.stringify(data).slice(0, 500);
      throw new Error(`API 返回格式异常：${serverMessage}`);
    }
    
    return JSON.parse(cleanJsonFence(rawContent));
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`时空通道堵塞 (API 调用超时 ${Math.round(timeoutMs / 1000)} 秒无响应)，请检查网络并重试！`);
    }
    throw err;
  }
}

async function callFreeGeminiEngine(promptText) {
  const controller = new AbortController();
  const timeoutMs = 90000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('/api-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'gemini',
        model: aiConfig.model || 'gemini-2.5-flash-lite',
        systemPrompt: SYSTEM_PROMPT,
        promptText,
        anonymousUserId: getAnonymousUserId()
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await readApiErrorText(response);
      throw new Error(`免费体验通道异常 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const rawContent = data?.content?.trim();
    if (!rawContent) {
      throw new Error(`免费体验通道返回格式异常：${JSON.stringify(data).slice(0, 500)}`);
    }

    return JSON.parse(cleanJsonFence(rawContent));
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`免费体验通道超时 ${Math.round(timeoutMs / 1000)} 秒无响应，可稍后重试或在 AI 配置中填写自己的 API。`);
    }
    throw err;
  }
}

function getAnonymousUserId() {
  let id = localStorage.getItem(STORAGE_KEYS.anonymousUserId);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(STORAGE_KEYS.anonymousUserId, id);
  }
  return id;
}

function cleanJsonFence(rawContent) {
  let cleanJsonStr = rawContent.trim();
  if (cleanJsonStr.startsWith('```json')) {
    cleanJsonStr = cleanJsonStr.replace(/^```json/, '').replace(/```$/, '');
  } else if (cleanJsonStr.startsWith('```')) {
    cleanJsonStr = cleanJsonStr.replace(/^```/, '').replace(/```$/, '');
  }
  return cleanJsonStr.trim();
}

function buildLlmRequestHeaders(baseUrl, useAnthropic) {
  const headers = {
    'Content-Type': 'application/json',
    'x-target-url': baseUrl
  };

  if (useAnthropic) {
    headers['x-api-key'] = aiConfig.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers.Authorization = `Bearer ${aiConfig.apiKey}`;
  }

  return headers;
}

function buildLlmRequestBody(promptText, useAnthropic) {
  if (useAnthropic) {
    return {
      model: aiConfig.model,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: promptText }
      ],
      max_tokens: 4096,
      temperature: 0.7,
      stream: false
    };
  }

  return {
    model: aiConfig.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: promptText }
    ],
    temperature: 0.7,
    stream: false
    // 移除了 response_format: { type: 'json_object' }，大幅提高国产模型与中转站的兼容度
  };
}

function extractLlmTextContent(data, useAnthropic) {
  if (useAnthropic) {
    return (data?.content || [])
      .filter(item => item?.type === 'text' && item.text)
      .map(item => item.text)
      .join('\n')
      .trim();
  }

  return data?.choices?.[0]?.message?.content?.trim();
}

function normalizeApiBaseUrl(baseUrl) {
  const trimmed = (baseUrl || '').trim();
  if (!trimmed) {
    throw new Error('API Base URL 为空，请在右上角 AI 配置中填写接口地址。');
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch (err) {
    throw new Error('API Base URL 格式不正确，请填写类似 https://api.example.com/v1 的地址。');
  }

  url.pathname = url.pathname
    .replace(/\/chat\/completions\/?$/, '')
    .replace(/\/v1\/messages\/?$/, '')
    .replace(/\/$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function isAnthropicBaseUrl(baseUrl) {
  try {
    return new URL(baseUrl).pathname.toLowerCase().includes('/anthropic');
  } catch (err) {
    return false;
  }
}

async function readApiErrorText(response) {
  const text = await response.text();
  if (!text) {
    if (response.status === 502) {
      return '上游模型服务或中转站返回 502。请优先确认模型 ID 是否被该渠道支持，或稍后重试/切换 DeepSeek、OpenAI 等渠道。';
    }
    return response.statusText || '无错误详情';
  }

  try {
    const parsed = JSON.parse(text);
    return parsed?.error?.message || parsed?.error || parsed?.message || text.slice(0, 800);
  } catch (err) {
    return text.slice(0, 800);
  }
}

// ==========================================================================
// 7. 时空回溯交互逻辑 (Rewind System)
// ==========================================================================

// 点击树节点时的触发预览和回溯二次确认
function triggerNodeSelectionPreview(nodeId) {
  if (nodeId === gameData.currentNodeId) return; // 点击当前节点，无视

  const targetNode = gameData.nodes[nodeId];
  if (!targetNode) return;

  rewindTargetId = nodeId;
  DOM.rewindNodeTitle.textContent = `${targetNode.age}岁 · ${targetNode.title}`;
  DOM.modalConfirmRewind.classList.remove('hidden');
}

// 确认吃后悔药回溯，启动全屏滤镜特效
function executeTimeTravelRewind() {
  DOM.modalConfirmRewind.classList.add('hidden');
  
  if (!rewindTargetId || !gameData.nodes[rewindTargetId]) return;

  // 1. 播放回溯特效
  DOM.timeTravelOverlay.classList.remove('hidden');
  DOM.timeTravelOverlay.classList.add('active');

  // 2. 终止任何正在进行的语音朗读
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // 3. 特效播放至转折点（1秒）时，进行底层数据热重载
  setTimeout(() => {
    renderStoryNode(rewindTargetId);
    updateBranchTree();
    autoSaveGame();
  }, 1000);

  // 4. 特效结束后（1.8秒），隐藏遮罩
  setTimeout(() => {
    DOM.timeTravelOverlay.classList.remove('active');
    DOM.timeTravelOverlay.classList.add('hidden');
    rewindTargetId = null;
  }, 1800);
}

// ==========================================================================
// 8. 存档的导入与导出 (JSON Serialization)
// ==========================================================================

// 导出整棵树为本地 JSON 文件
function exportSaveFile() {
  const saveDataStr = localStorage.getItem(STORAGE_KEYS.save);
  if (!saveDataStr) {
    alert('暂无存档数据可以导出，请先推进一段剧情。');
    return;
  }

  const blob = new Blob([saveDataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `GameLife_平行宇宙备份_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 导入外部 JSON 存档
function handleSaveFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (isValidSaveData(parsed)) {
        // 重载内存变量
        preserveCurrentSaveAsBackup();
        gameData = parsed;
        
        // 保存至本地存储并刷新
        autoSaveGame();
        updateBranchTree();
        renderStoryNode(gameData.currentNodeId);
        
        DOM.modalSaveCenter.classList.add('hidden');
        alert('🌿 恭喜，成功载入平行时空！正在展现别人的故事树。');
      } else {
        alert('文件结构不正确，无法还原多重宇宙。');
      }
    } catch (err) {
      alert('导入失败，请确保您选择的是合法的 .json 存档文件。');
    }
  };
  reader.readAsText(file);
}

function preserveCurrentSaveAsBackup() {
  const currentSave = localStorage.getItem(STORAGE_KEYS.save);
  if (currentSave) {
    localStorage.setItem(STORAGE_KEYS.saveBackup, currentSave);
  }
}

// ==========================================================================
// 9. 事件绑定与生命周期初始化
// ==========================================================================

function setupEventListeners() {
  // 弹窗控制：打开
  DOM.btnAiConfig.onclick = () => {
    updateAiConfigForm();
    DOM.modalAiConfig.classList.remove('hidden');
  };
  DOM.btnSaveCenter.onclick = () => {
    if (DOM.saveNodeCount) {
      DOM.saveNodeCount.textContent = Object.keys(gameData.nodes).length;
    }
    DOM.modalSaveCenter.classList.remove('hidden');
  };

  // 弹窗控制：关闭
  DOM.btnCloseAi.onclick = () => DOM.modalAiConfig.classList.add('hidden');
  DOM.btnCloseSave.onclick = () => DOM.modalSaveCenter.classList.add('hidden');
  DOM.btnCancelRewind.onclick = () => DOM.modalConfirmRewind.classList.add('hidden');

  // 保存与操作
  DOM.btnSaveAi.onclick = saveAiConfigFromForm;
  DOM.btnExportSave.onclick = exportSaveFile;
  
  DOM.btnImportTrigger.onclick = () => DOM.fileImportSave.click();
  DOM.fileImportSave.onchange = handleSaveFileImport;
  
  DOM.btnConfirmRewind.onclick = executeTimeTravelRewind;

  // 自定义动作提交
  DOM.btnSubmitAction.onclick = () => {
    const text = DOM.inputCustomAction.value.trim();
    if (text) {
      handlePlayerChoice(text);
    }
  };
  DOM.inputCustomAction.onkeydown = (e) => {
    if (e.key === 'Enter') {
      DOM.btnSubmitAction.click();
    }
  };

  // 分支树缩放平移控制按钮
  DOM.btnZoomIn.onclick = () => branchTreeInstance?.zoomIn();
  DOM.btnZoomOut.onclick = () => branchTreeInstance?.zoomOut();
  DOM.btnZoomReset.onclick = () => branchTreeInstance?.resetZoom();

  // 重置游戏按钮
  DOM.btnResetGame.onclick = () => {
    if (confirm('⚡ 您真的确定要斩断尘缘重开人生吗？这将抹除您当前建立的整棵蝴蝶效应时空树！')) {
      initNewGame();
    }
  };

  // 适配能爬中转站模版自动补全
  DOM.aiPreset.onchange = (e) => {
    const val = e.target.value;
    if (val === 'free-gemini') {
      DOM.aiBaseUrl.value = '';
      DOM.aiApiKey.value = '';
      DOM.aiModel.value = 'gemini-2.5-flash-lite';
    } else if (val === 'nengpa') {
      DOM.aiBaseUrl.value = 'https://api.nengpa.com/anthropic';
      DOM.aiModel.value = 'MiniMax-M2.7';
    } else if (val === 'deepseek') {
      DOM.aiBaseUrl.value = 'https://api.deepseek.com/v1';
      DOM.aiModel.value = 'deepseek-chat';
    } else if (val === 'openai') {
      DOM.aiBaseUrl.value = 'https://api.openai.com/v1';
      DOM.aiModel.value = 'gpt-4o-mini';
    }
    updateAiConfigFieldVisibility();
  };
}

function updateAiConfigFieldVisibility() {
  const isFreeMode = DOM.aiPreset.value === 'free-gemini';
  [DOM.aiBaseUrl, DOM.aiApiKey].forEach(input => {
    const group = input.closest('.form-group');
    if (group) group.classList.toggle('hidden', isFreeMode);
  });
}

// 页面加载启动点
window.addEventListener('DOMContentLoaded', () => {
  loadAiConfig();
  setupEventListeners();
  registerServiceWorker();

  // 尝试恢复存档
  const hasSave = tryLoadGame();
  
  // 必须优先检测 API 授权
  const isApiReady = checkApiConfiguration();
  
  if (hasSave) {
    // 恢复先前状态
    renderStoryNode(gameData.currentNodeId);
    updateBranchTree();
  } else {
    // 如果没有存档，且 API Ready，直接开始新局
    if (isApiReady) {
      initNewGame();
    } else {
      // 没 API 也没存档：用初始节点作为离线预览
      gameData.nodes = {};
      gameData.nodes[INITIAL_STORY_NODE.id] = JSON.parse(JSON.stringify(INITIAL_STORY_NODE));
      renderStoryNode(INITIAL_STORY_NODE.id);
      updateBranchTree();
    }
  }

  // 必须保证 SpeechSynthesisVoice 加载就绪 (Chrome 等浏览器是异步的)
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
      // 仅用作触发就绪
    };
  }
});

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('PWA Service Worker 注册失败:', err);
    });
  });
}
