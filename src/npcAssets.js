/**
 * 时光回溯沙盒：NPC 预设资产、情感立绘生成与 Prompt 模板
 */

// 1. 玩家性格初始属性
export const INITIAL_PLAYER_STATS = {
  courage: 50,  // 勇气
  honesty: 50,  // 诚实
  empathy: 50   // 共情
};

// 2. 初始 NPC 信息与好感
export const INITIAL_NPCS = {
  mother: {
    id: 'mother',
    name: '林素琴',
    relation: '母亲',
    affection: 50,
    trust: 50,
    emotion: 'neutral',
    memory: ['带你在小卖部打酱油的碎碎念', '每天放学催你写作业']
  },
  classmate: {
    id: 'classmate',
    name: '苏清婉',
    relation: '同桌',
    affection: 50,
    trust: 50,
    emotion: 'neutral',
    memory: ['曾借给你一块沾满铅笔灰的橡皮', '每天都把三八线画得很清晰']
  },
  friend: {
    id: 'friend',
    name: '张小胖',
    relation: '发小',
    affection: 50,
    trust: 50,
    emotion: 'neutral',
    memory: ['总是把辣条分你一半', '曾帮你背过一次黑锅']
  }
};

// 3. 初始剧情数据 (分支树根节点 Root)
export const INITIAL_STORY_NODE = {
  id: 'root_node',
  parentId: null,
  age: 9,
  title: '九岁·三年级放学',
  playerAction: '开启这段注定不凡的童年旅程',
  storyText: `今天放学时下了一场温润的微雨，空气里弥漫着湿润的泥土香和街角爆米花的甜气。你背着洗得有些发白的双肩书包，红领巾歪歪斜斜地系在脖子上。

林素琴（母亲）正在巷子口收衣服，远远地看你没撑伞，拉长了声调喊着：“跑快点！天天在外面晃，衣服全淋湿了！”
苏清婉（同桌）背着粉红色的精美皮书包从你身边走过，她轻轻地看了你一眼，犹豫着要不要把她那把格子花小伞借给你。
张小胖（发小）正蹲在墙根，嘴里塞着半包五毛钱的卫龙辣条，兴奋地朝你招手：“哥们！快来，我刚才在泥坑里抠出个特别溜圆的玻璃弹珠！”

这一刻，你站在潮湿的十字街口。看着熟悉的童年小巷，你深吸了一口气。这一次，一切都会有不同吗？`,
  npcStates: JSON.parse(JSON.stringify(INITIAL_NPCS)),
  playerStats: JSON.parse(JSON.stringify(INITIAL_PLAYER_STATS)),
  children: []
};

// 4. 大模型 System Prompt 提示词模板
export const SYSTEM_PROMPT = `你是一个充满哲理、细腻情感与怀旧气息的童年成长RPG游戏主持人(DM)。
玩家将在你的引导下进行一场“时光回溯平行人生”的探索。
请仔细阅读以下游戏规则，并严格按要求生成回复。

【世界设定】
- 玩家当前处于“9岁·小学三年级”的时光，所处环境是2000年代初充满回忆的中国城镇（红领巾、小卖部辣条、黑白电视、泥巴路、玻璃弹珠等）。
- 游戏里有三位核心NPC：
  1. 林素琴 (母亲)：传统而严厉，心里极度关爱孩子，嘴上常有碎碎念，情绪容易因玩家的调皮或懂事而波动。
  2. 苏清婉 (同桌)：内敛、细腻、自尊心强，性格有些孤傲但渴望友情，对玩家的善意十分敏感。
  3. 张小胖 (发小)：调皮、仗义、贪吃，有点胆小但关键时刻能为朋友出头。

【互动逻辑】
- 玩家每做一次抉择（可能来自你给出的3个选项，也可能是玩家在文本框自由输入的行为），你都需要推演这个抉择引发的“蝴蝶效应”。
- 抉择会引起玩家自身性格属性（勇气、诚实、共情）的改变（每次改变范围为 -10 到 +10）。
- 抉择会引起NPC的好感度(affection)与信任度(trust)的增减，同时触发其情绪转换(emotion)。情绪必须为以下五种之一：'neutral' (平静), 'happy' (高兴), 'angry' (生气), 'sad' (悲伤), 'surprised' (惊讶)。
- 如果NPC的好感或信任大幅度改变，请在回复的剧情中细腻地写出他们语气、眼神或动作的微妙变化。

【重要：严格的输出格式】
你必须返回一个符合以下严格JSON格式的字符串，不要带有任何markdown标记（如 \`\`\`json），直接以 { 开始。确保JSON格式完全正确且能够被解析。

JSON 字段定义：
1. "storyText": "（300字左右的高品质童年剧情推演，重点描写当前行动的结果、环境细节，以及NPC的具体台词和神态。如果触发了NPC对话，请以『NPC名字：“对话内容”』的形式写在段落中，使文字显得温润细腻。）",
2. "playerStatsChange": {
     "courage": 数字,  // 勇气值改变量（如 3 或 -2）
     "honesty": 数字,  // 诚实值改变量
     "empathy": 数字   // 共情力改变量
   },
3. "npcStatusChanges": {
     "mother": { "affection": 数字, "trust": 数字, "emotion": "emotion_key" },
     "classmate": { "affection": 数字, "trust": 数字, "emotion": "emotion_key" },
     "friend": { "affection": 数字, "trust": 数字, "emotion": "emotion_key" }
   },
4. "options": [
     "下一步选项A内容...",
     "下一步选项B内容...",
     "下一步选项C内容..."
   ]

注意：所有的数值变化必须合理且温和，NPC的 emotion 必须严格是 'neutral'、'happy'、'angry'、'sad'、'surprised' 之一。
你的故事推演要逻辑连贯，能够敏锐捕捉玩家选择中隐藏的心态，并让其在童年轨迹中泛起涟漪。`;

// 5. 动态 SVG 角色表情渲染器 (用纯 SVG 绘制高颜值复古角色立绘)
export function getAvatarSvg(npcId, emotion) {
  // 根据 NPC ID 决定配色
  let skinColor = '#fbe5d6';
  let hairColor = '#2b2924';
  let clothColor = '#5c8001';
  let primaryName = '妈妈';

  if (npcId === 'mother') {
    hairColor = '#2d2d2a';
    clothColor = '#6b4f70'; // 妈妈的紫色外衣
  } else if (npcId === 'classmate') {
    hairColor = '#3a3a30';
    clothColor = '#d97d91'; // 苏清婉的粉粉女校服
  } else if (npcId === 'friend') {
    hairColor = '#4a3b32';
    clothColor = '#4c956c'; // 张小胖的绿条纹T恤
  }

  // 根据表情生成五官
  let eyeLeft = `<ellipse cx="40" cy="45" rx="3" ry="5" fill="#2b2924"/>`;
  let eyeRight = `<ellipse cx="60" cy="45" rx="3" ry="5" fill="#2b2924"/>`;
  let mouth = `<path d="M 45 62 Q 50 65 55 62" stroke="#2b2924" stroke-width="2.5" stroke-linecap="round" fill="none"/>`;
  let browLeft = `<path d="M 35 38 Q 40 37 45 39" stroke="#2b2924" stroke-width="2" stroke-linecap="round" fill="none"/>`;
  let browRight = `<path d="M 55 39 Q 60 37 65 38" stroke="#2b2924" stroke-width="2" stroke-linecap="round" fill="none"/>`;
  let blush = '';

  switch (emotion) {
    case 'happy':
      // 弯弯的月牙眼，上扬的嘴巴，可爱的红晕
      eyeLeft = `<path d="M 36 46 Q 40 41 44 46" stroke="#2b2924" stroke-width="3" stroke-linecap="round" fill="none"/>`;
      eyeRight = `<path d="M 56 46 Q 60 41 64 46" stroke="#2b2924" stroke-width="3" stroke-linecap="round" fill="none"/>`;
      mouth = `<path d="M 44 60 Q 50 68 56 60" stroke="#2b2924" stroke-width="2.5" stroke-linecap="round" fill="#e76f51"/>`;
      blush = `<circle cx="35" cy="52" r="4" fill="#e76f51" opacity="0.4"/><circle cx="65" cy="52" r="4" fill="#e76f51" opacity="0.4"/>`;
      break;
    case 'angry':
      // 倒八字眉，严厉直视的眼睛，往下扁的嘴
      browLeft = `<path d="M 34 36 Q 40 39 46 41" stroke="#2b2924" stroke-width="2.5" stroke-linecap="round" fill="none"/>`;
      browRight = `<path d="M 54 41 Q 60 39 66 36" stroke="#2b2924" stroke-width="2.5" stroke-linecap="round" fill="none"/>`;
      eyeLeft = `<circle cx="40" cy="45" r="3.5" fill="#2b2924"/>`;
      eyeRight = `<circle cx="60" cy="45" r="3.5" fill="#2b2924"/>`;
      mouth = `<path d="M 44 64 Q 50 58 56 64" stroke="#2b2924" stroke-width="3" stroke-linecap="round" fill="none"/>`;
      break;
    case 'sad':
      // 八字眉，下垂眼/流泪，撇嘴
      browLeft = `<path d="M 34 38 Q 40 36 46 35" stroke="#2b2924" stroke-width="2.5" stroke-linecap="round" fill="none"/>`;
      browRight = `<path d="M 54 35 Q 60 36 66 38" stroke="#2b2924" stroke-width="2.5" stroke-linecap="round" fill="none"/>`;
      eyeLeft = `<path d="M 37 43 Q 40 47 43 43" stroke="#2b2924" stroke-width="2.5" stroke-linecap="round" fill="none"/>`;
      eyeRight = `<path d="M 57 43 Q 60 47 63 43" stroke="#2b2924" stroke-width="2.5" stroke-linecap="round" fill="none"/>`;
      mouth = `<path d="M 45 64 Q 50 60 55 64" stroke="#2b2924" stroke-width="2.5" stroke-linecap="round" fill="none"/>`;
      blush = `<path d="M 40 50 L 40 56 M 60 50 L 60 56" stroke="#a9c6e2" stroke-width="2" stroke-linecap="round" fill="none"/>`; // 泪痕
      break;
    case 'surprised':
      // 挑高的弯眉，睁得极圆的眼睛，圆圆的嘴巴
      browLeft = `<path d="M 33 35 Q 40 33 46 36" stroke="#2b2924" stroke-width="2" stroke-linecap="round" fill="none"/>`;
      browRight = `<path d="M 54 36 Q 60 33 67 35" stroke="#2b2924" stroke-width="2" stroke-linecap="round" fill="none"/>`;
      eyeLeft = `<circle cx="40" cy="45" r="5" fill="#2b2924"/><circle cx="39" cy="43" r="1.5" fill="#fff"/>`;
      eyeRight = `<circle cx="60" cy="45" r="5" fill="#2b2924"/><circle cx="59" cy="43" r="1.5" fill="#fff"/>`;
      mouth = `<circle cx="50" cy="62" r="5.5" stroke="#2b2924" stroke-width="2.5" fill="none"/>`;
      break;
    case 'neutral':
    default:
      // 平常的表情
      break;
  }

  // 角色五官细节特色（如妈妈的卷发、苏清婉的双马尾、张小胖的圆脸）
  let hairStyle = '';
  let glassDeco = '';
  let headShape = `<circle cx="50" cy="50" r="28" fill="${skinColor}" stroke="#2b2924" stroke-width="2.5"/>`;

  if (npcId === 'mother') {
    // 妈妈：波浪中短发
    hairStyle = `
      <path d="M 18 50 C 12 35, 12 18, 30 18 C 40 18, 45 22, 50 24 C 55 22, 60 18, 70 18 C 88 18, 88 35, 82 50 C 85 58, 80 66, 75 70 C 72 58, 76 46, 74 40 C 72 32, 28 32, 26 40 C 24 46, 28 58, 25 70 C 20 66, 15 58, 18 50 Z" fill="${hairColor}" stroke="#2b2924" stroke-width="2"/>
      <ellipse cx="50" cy="18" rx="8" ry="3" fill="#40403c"/>
    `;
  } else if (npcId === 'classmate') {
    // 同桌：清秀双马尾，加红色蝴蝶结
    hairStyle = `
      <path d="M 23 23 Q 10 30 8 48 Q 15 52 20 42" fill="${hairColor}" stroke="#2b2924" stroke-width="2"/>
      <path d="M 77 23 Q 90 30 92 48 Q 85 52 80 42" fill="${hairColor}" stroke="#2b2924" stroke-width="2"/>
      <circle cx="21" cy="30" r="3.5" fill="#e76f51"/>
      <circle cx="79" cy="30" r="3.5" fill="#e76f51"/>
      <path d="M 22 28 C 30 15, 70 15, 78 28 C 72 20, 28 20, 22 28 Z" fill="${hairColor}" stroke="#2b2924" stroke-width="2"/>
    `;
  } else if (npcId === 'friend') {
    // 张小胖：西瓜皮平头，圆润大耳朵
    headShape = `<circle cx="50" cy="52" r="31" fill="${skinColor}" stroke="#2b2924" stroke-width="2.5"/>`;
    hairStyle = `
      <path d="M 18 42 C 18 20, 82 20, 82 42 C 70 32, 30 32, 18 42 Z" fill="${hairColor}" stroke="#2b2924" stroke-width="2"/>
      <circle cx="16" cy="54" r="7" fill="${skinColor}" stroke="#2b2924" stroke-width="2.5"/>
      <circle cx="84" cy="54" r="7" fill="${skinColor}" stroke="#2b2924" stroke-width="2.5"/>
    `;
  }

  // 组装最终 SVG 字符串
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="100%" height="100%">
      <!-- 阴影 -->
      <ellipse cx="50" cy="114" rx="28" ry="4" fill="#000" opacity="0.12"/>
      
      <!-- 头发后侧 -->
      ${npcId === 'classmate' ? hairStyle : ''}
      
      <!-- 脖子 -->
      <rect x="45" y="72" width="10" height="15" fill="${skinColor}" stroke="#2b2924" stroke-width="2.5" rx="3"/>
      
      <!-- 身体衣着 -->
      <path d="M 25 110 C 25 90, 35 80, 50 80 C 65 80, 75 90, 75 110 Z" fill="${clothColor}" stroke="#2b2924" stroke-width="2.5"/>
      <!-- 红领巾（仅限同桌和发小） -->
      ${npcId !== 'mother' ? `<path d="M 46 80 L 50 94 L 54 80 L 50 82 Z" fill="#e76f51"/><path d="M 50 94 L 46 112 L 50 116 L 54 112 Z" fill="#e76f51"/>` : ''}

      <!-- 头部 -->
      ${headShape}
      
      <!-- 头发前侧/发型特色 -->
      ${npcId !== 'classmate' ? hairStyle : ''}

      <!-- 眉毛 -->
      ${browLeft}
      ${browRight}

      <!-- 眼睛 -->
      ${eyeLeft}
      ${eyeRight}

      <!-- 腮红与特技效果 -->
      ${blush}

      <!-- 嘴巴 -->
      ${mouth}
    </svg>
  `;
}
