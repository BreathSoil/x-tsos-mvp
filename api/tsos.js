// api/tsos.js —— X-TSOS 三元状态解析器（Vercel Serverless Function - CommonJS）
// 使用 require，不使用 import/export
const fs = require('fs');
const path = require('path');

// 🌾 自包含节气计算（避免依赖 solar-term 包）
function getSolarTerm(date) {
  const terms = [
    '小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨',
    '立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑',
    '白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'
  ];
  const offsets = [5,20,39,54,70,85,101,116,132,147,163,178,194,209,225,240,256,271,287,302,318,333,349,364];
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date - startOfYear) / (1000 * 60 * 60 * 24)) + 1;

  for (let i = 0; i < 24; i++) {
    const currentOffset = offsets[i];
    const nextOffset = i < 23 ? offsets[i + 1] : offsets[0] + 365;
    if (dayOfYear >= currentOffset && dayOfYear < nextOffset) {
      return terms[i];
    }
  }
  return '小寒';
}

// 🌀 万象枢机 TSI 计算（基于题库结果 + AI 输出）
function computeTSIFromAI(qi, lumin, rhythm, expectedRhythm) {
  const ruShi = lumin['如是'] || 0;
  const mindSafety = ruShi < 30 
    ? 0.2 
    : Math.min(1.0, 0.8 + (ruShi - 50) * 0.01);

  const rhythmFit = rhythm === expectedRhythm ? 1.0 : 0.6;
  const hexagramFit = 0.7;
  const geoFit = 0.85;

  const TSI = 
    mindSafety * 0.4 +
    rhythmFit * 0.3 +
    hexagramFit * 0.2 +
    geoFit * 0.1;

  const decisionCard = {
    reason: `如是轮=${ruShi}%（${ruShi < 30 ? '低于安全阈值' : '稳定'}），节律=${rhythm}（${rhythm === expectedRhythm ? '对齐' : '偏移'}）`,
    action: TSI < 0.4 
      ? '启动一级熔断：仅推送基础呼吸练习' 
      : '正常引导'
  };

  return {
    TSI: parseFloat(Math.min(1.0, Math.max(0.0, TSI)).toFixed(3)),
    subScores: {
      心象枢: parseFloat(mindSafety.toFixed(2)),
      时象枢: rhythmFit,
      卦象枢: hexagramFit,
      地象枢: geoFit
    },
    decisionCard
  };
}

// 🧠 从 DQ420 题库中提取用户反馈的 qi/lumin 效应（核心新功能）
async function extractEffectsFromAnswers(answers, questionMap) {
  // 初始化计数器
  const qiEffects = {
    '厚载': 0, '萌动': 0, '炎明': 0, '润下': 0,
    '肃降': 0, '刚健': 0, '通透': 0, '静守': 0
  };
  const luminEffects = {
    '如是': 0, '破暗': 0, '涓流': 0, '映照': 0, '无垠': 0
  };

  let totalWeight = 0;

  // 遍历每个题目答案
  for (const [qid, answerIndex] of Object.entries(answers)) {
    const question = questionMap[qid];
    if (!question || !question.options || answerIndex < 0 || answerIndex >= question.options.length) continue;

    const option = question.options[answerIndex];
    const effects = option.effects || {};

    // 加权累加（假设每道题权重为1）
    Object.keys(qiEffects).forEach(key => {
      if (effects.qi && effects.qi[key] !== undefined) {
        qiEffects[key] += effects.qi[key];
      }
    });

    Object.keys(luminEffects).forEach(key => {
      if (effects.lumin && effects.lumin[key] !== undefined) {
        luminEffects[key] += effects.lumin[key];
      }
    });

    totalWeight++;
  }

  // 归一化到 30~80 范围内
  const normalizeToRange = (value, min = 30, max = 80) => {
    const normalized = value / (totalWeight || 1);
    return Math.max(min, Math.min(max, Math.round(normalized * 100) / 100));
  };

  return {
    qi: Object.fromEntries(Object.entries(qiEffects).map(([k, v]) => [k, normalizeToRange(v)])),
    lumin: Object.fromEntries(Object.entries(luminEffects).map(([k, v]) => [k, normalizeToRange(v)]))
  };
}

// ✅ 主函数（Vercel Serverless Handler）
module.exports = async (req, res) => {
  // 设置 CORS（开发友好）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const answers = req.body || {};
    const API_KEY = process.env.BAI_LIAN_API_KEY;

    if (!API_KEY) {
      console.error('[TSOS] 缺失环境变量: BAI_LIAN_API_KEY');
      return res.status(500).json({ error: '服务器配置错误：缺少 AI 服务密钥' });
    }

    // 🕰️ 获取东八区时间
    const beijingTime = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })
    );
    const month = beijingTime.getMonth();

    const rhythmMap = { 
      '显化': [2, 3, 4],
      '涵育': [5, 6, 7],
      '敛藏': [8, 9, 10],
      '归元': [11, 0, 1]
    };
    let currentRhythm = '归元';
    for (const [rhythm, months] of Object.entries(rhythmMap)) {
      if (months.includes(month)) {
        currentRhythm = rhythm;
        break;
      }
    }

    const solarTerm = getSolarTerm(beijingTime);

    // 🔍 加载 DQ420 题库
    const dqPath = path.join(process.cwd(), 'data', 'DQ420.json');
    let questionMap = {};
    try {
      const data = fs.readFileSync(dqPath, 'utf8');
      questionMap = JSON.parse(data);
    } catch (err) {
      console.error('[TSOS] 无法加载 DQ420.json:', err.message);
      return res.status(500).json({ error: '题库加载失败，请检查数据文件' });
    }

    // 🧠 从用户答案中提取 qi/lumin 效应（基于题库）
    const baseEffects = await extractEffectsFromAnswers(answers, questionMap);

    // 👇 构造 AI Prompt（现在包含用户实际选择的数据）
    const prompt = `
你是一个 X-TSOS 三元状态解析器。请根据用户回答和当前节气，输出严格符合以下 JSON 格式的响应，不要任何额外文字、解释或 Markdown：

{
  "qi": {"厚载":number,"萌动":number,"炎明":number,"润下":number,"肃降":number,"刚健":number,"通透":number,"静守":number},
  "lumin": {"如是":number,"破暗":number,"涓流":number,"映照":number,"无垠":number},
  "rhythm": "${currentRhythm}"
}

要求：
- 所有数值必须为整数，范围在 30 到 80 之间（含）
- 基于心性逻辑推演，避免平均分配
- 当前节气为：${solarTerm}
- 用户已选答案的情绪效应如下：
${JSON.stringify(baseEffects, null, 2)}
`;

    // 🔗 调用百炼 API
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-max',
        input: {
          messages: [{ role: 'user', content: prompt }]
        },
        parameters: {
          result_format: 'message',
          temperature: 0.7,
          seed: Math.floor(Math.random() * 10000)
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[TSOS] 百炼 API 错误:', response.status, text);
      return res.status(502).json({ error: 'AI 服务暂时不可用，请稍后再试' });
    }

    const data = await response.json();
    const content = data?.output?.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[TSOS] AI 返回为空:', data);
      return res.status(500).json({ error: 'AI 未生成有效结果' });
    }

    let resultJson;
    try {
      const match = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/i);
      const jsonStr = match ? match[1] : content.trim();
      resultJson = JSON.parse(jsonStr);
    } catch (e) {
      console.error('[TSOS] JSON 解析失败:', e.message, '| 原始内容:', content);
      return res.status(500).json({ error: 'AI 返回格式无效，无法解析' });
    }

    // ✅ 验证结构
    const qiKeys = ['厚载','萌动','炎明','润下','肃降','刚健','通透','静守'];
    const luminKeys = ['如是','破暗','涓流','映照','无垠'];

    const hasQi = resultJson.qi && qiKeys.every(k => typeof resultJson.qi[k] === 'number');
    const hasLumin = resultJson.lumin && luminKeys.every(k => typeof resultJson.lumin[k] === 'number');
    const hasCorrectRhythm = resultJson.rhythm === currentRhythm;

    if (!hasQi || !hasLumin || !hasCorrectRhythm) {
      console.error('[TSOS] 数据校验失败:', resultJson);
      return res.status(500).json({ error: 'AI 返回数据结构不完整或节律不符' });
    }

    // 💡 结合 AI 结果与原始题库效果（可选增强）
    const finalQi = { ...resultJson.qi };
    const finalLumin = { ...resultJson.lumin };

    // 可选：融合 AI 和题库结果（例如加权平均）
    // 此处暂保留 AI 输出为主，题库作为输入上下文

    const tsiResult = computeTSIFromAI(finalQi, finalLumin, finalLumin.rhythm, currentRhythm);

    const finalResponse = {
      qi: finalQi,
      lumin: finalLumin,
      rhythm: finalLumin.rhythm,
      TSI: tsiResult.TSI,
      subScores: tsiResult.subScores,
      decisionCard: tsiResult.decisionCard,
      metadata: {
        solarTerm: solarTerm,
        dominantQi: Object.entries(finalQi)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || '未知'
      },
      timestamp: beijingTime.toISOString()
    };

    res.status(200).json(finalResponse);

  } catch (error) {
    console.error('[TSOS] 严重错误:', error);
    res.status(500).json({ error: '内部服务器错误，请联系管理员' });
  }
};
