// api/tsos.js —— X-TSOS 三元状态解析器 + 万象枢机 TSI 计算
export default async (req, res) => {
  // 仅允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const answers = req.body || {};

    // 🔑 检查 API 密钥（必须在 Vercel 环境变量中设置 BAI_LIAN_API_KEY）
    const API_KEY = process.env.BAI_LIAN_API_KEY;
    if (!API_KEY) {
      console.error('[TSOS] 缺失环境变量: BAI_LIAN_API_KEY');
      return res.status(500).json({ error: '服务器配置错误：缺少 AI 服务密钥' });
    }

    // 📅 动态计算当前五息律环（基于月份）
    const month = new Date().getMonth(); // 0 = Jan, 11 = Dec
    const rhythmMap = { 
      '显化': [2, 3, 4],     // Mar–May
      '涵育': [5, 6, 7],     // Jun–Aug
      '敛藏': [8, 9, 10],    // Sep–Nov
      '归元': [11, 0, 1]     // Dec, Jan, Feb
    };
    let currentRhythm = '归元';
    for (const [rhythm, months] of Object.entries(rhythmMap)) {
      if (months.includes(month)) {
        currentRhythm = rhythm;
        break;
      }
    }

    // 🧠 构造提示词（Prompt）
    const prompt = `
你是一个 X-TSOS 三元状态解析器。请根据用户回答，输出严格符合以下 JSON 格式的响应，不要任何额外文字、解释或 Markdown：

{
  "qi": {"厚载":number,"萌动":number,"炎明":number,"润下":number,"肃降":number,"刚健":number,"通透":number,"静守":number},
  "lumin": {"如是":number,"破暗":number,"涓流":number,"映照":number,"无垠":number},
  "rhythm": "${currentRhythm}"
}

要求：
- 所有数值必须为整数，范围在 30 到 80 之间（含）
- 基于心性逻辑推演，避免平均分配（例如：若用户焦虑，则“静守”偏低，“炎明”偏高）
- 不要添加任何字段、注释或说明
- 用户回答内容如下：
${JSON.stringify(answers, null, 2)}
`;

    // 🌐 调用百炼平台 Qwen-Max 模型
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
          seed: Math.floor(Math.random() * 10000) // 增加随机性但可控
        }
      })
    });

    // ❌ 处理百炼 API 错误
    if (!response.ok) {
      const text = await response.text();
      console.error('[TSOS] 百炼 API 调用失败:', response.status, text);
      return res.status(502).json({ error: 'AI 服务暂时不可用，请稍后再试' });
    }

    const data = await response.json();
    const content = data?.output?.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[TSOS] AI 返回内容为空:', data);
      return res.status(500).json({ error: 'AI 未生成有效结果' });
    }

    // 🔍 安全提取并解析 JSON（支持带 ```json 包裹的情况）
    let resultJson;
    try {
      // 尝试匹配 Markdown 代码块
      const match = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/i);
      const jsonStr = match ? match[1] : content.trim();
      resultJson = JSON.parse(jsonStr);
    } catch (e) {
      console.error('[TSOS] JSON 解析失败，原始内容:', content);
      return res.status(500).json({ error: 'AI 返回格式无效，无法解析' });
    }

    // ✅ 验证返回结构完整性
    const qiKeys = ['厚载','萌动','炎明','润下','肃降','刚健','通透','静守'];
    const luminKeys = ['如是','破暗','涓流','映照','无垠'];

    const hasQi = resultJson.qi && qiKeys.every(k => typeof resultJson.qi[k] === 'number');
    const hasLumin = resultJson.lumin && luminKeys.every(k => typeof resultJson.lumin[k] === 'number');
    const hasCorrectRhythm = resultJson.rhythm === currentRhythm;

    if (!hasQi || !hasLumin || !hasCorrectRhythm) {
      console.error('[TSOS] 数据结构校验失败:', resultJson);
      return res.status(500).json({ error: 'AI 返回数据结构不完整或节律不符' });
    }

    // ===== 🌀 新增：万象枢机 TSI 计算（X-TSOS 官方逻辑）=====
    function computeTSIFromAI(qi, lumin, rhythm, expectedRhythm) {
      // 1. 心象枢（心理安全）—— 权重 0.4
      const ruShi = lumin['如是'] || 0;
      const mindSafety = ruShi < 30 
        ? 0.2 
        : Math.min(1.0, 0.8 + (ruShi - 50) * 0.01); // 50→0.8, 80→1.1→clamp to 1.0

      // 2. 时象枢（节律对齐）—— 权重 0.3
      const rhythmFit = rhythm === expectedRhythm ? 1.0 : 0.6;

      // 3. 卦象枢（文化共鸣）—— 权重 0.2（固定值，后续可扩展）
      const hexagramFit = 0.7;

      // 4. 地象枢（空间适配）—— 权重 0.1（默认值）
      const geoFit = 0.85;

      // 加权合成 TSI
      const TSI = 
        mindSafety * 0.4 +
        rhythmFit * 0.3 +
        hexagramFit * 0.2 +
        geoFit * 0.1;

      // 决策卡逻辑
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

    // 执行 TSI 计算
    const tsiResult = computeTSIFromAI(
      resultJson.qi,
      resultJson.lumin,
      resultJson.rhythm,
      currentRhythm
    );

    // 📤 合并响应
    const finalResponse = {
      ...resultJson,
      TSI: tsiResult.TSI,
      subScores: tsiResult.subScores,
      decisionCard: tsiResult.decisionCard
    };

    // 返回成功结果
    res.status(200).json(finalResponse);

  } catch (error) {
    console.error('[TSOS] 服务端异常:', error);
    res.status(500).json({ error: '内部服务器错误，请联系管理员' });
  }
};
