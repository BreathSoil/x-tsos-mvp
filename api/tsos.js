// api/tsos.js —— 兼容你的实际部署环境（含万象枢机 TSI 计算）
export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const answers = req.body || {};

    // 🔑 环境变量名必须与 Vercel 设置一致！
    const API_KEY = process.env.BAI_LIAN_API_KEY; // 注意：带下划线
    if (!API_KEY) {
      console.error('缺失 BAI_LIAN_API_KEY 环境变量');
      return res.status(500).json({ error: '服务器配置错误' });
    }

    // 📅 计算五息律环（用于节律对齐判断）
    const month = new Date().getMonth();
    const rhythmMap = { 
      '显化': [2,3,4], '涵育': [5,6,7], 
      '敛藏': [8,9,10], '归元': [11,0,1] 
    };
    let currentRhythm = '归元';
    for (const [r, months] of Object.entries(rhythmMap)) {
      if (months.includes(month)) {
        currentRhythm = r;
        break;
      }
    }

    const prompt = `
你是一个 X-TSOS 三元状态解析器。请根据用户回答，输出严格符合以下 JSON 格式的响应，不要任何额外文字：

{
  "qi": {"厚载":number,"萌动":number,"炎明":number,"润下":number,"肃降":number,"刚健":number,"通透":number,"静守":number},
  "lumin": {"如是":number,"破暗":number,"涓流":number,"映照":number,"无垠":number},
  "rhythm": "${currentRhythm}"
}

要求：
- 所有数值在 30–80 之间
- 基于心性逻辑推演，避免平均
- 用户回答：${JSON.stringify(answers)}
`;

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
          result_format: 'message', // ⚠️ 必须！
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('百炼 API 错误:', response.status, text);
      return res.status(502).json({ error: 'AI 服务暂时不可用' });
    }

    const data = await response.json();
    const content = data?.output?.choices?.[0]?.message?.content;

    if (!content) {
      console.error('AI 返回内容为空:', data);
      return res.status(500).json({ error: 'AI 未返回有效内容' });
    }

    // 安全解析 JSON
    let resultJson;
    try {
      const match = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
      const jsonStr = match ? match[1] : content.trim();
      resultJson = JSON.parse(jsonStr);
    } catch (e) {
      console.error('JSON 解析失败:', content);
      return res.status(500).json({ error: 'AI 返回格式错误' });
    }

    // 验证结构
    const qiKeys = ['厚载','萌动','炎明','润下','肃降','刚健','通透','静守'];
    const luminKeys = ['如是','破暗','涓流','映照','无垠'];

    if (
      !resultJson.qi ||
      !resultJson.lumin ||
      resultJson.rhythm !== currentRhythm ||
      qiKeys.some(k => !(k in resultJson.qi)) ||
      luminKeys.some(k => !(k in resultJson.lumin))
    ) {
      console.error('数据结构不完整:', resultJson);
      return res.status(500).json({ error: 'AI 返回数据不完整' });
    }

    // ===== 新增：万象枢机 TSI 计算（基于 X-TSOS 官方文档）=====
    function computeTSIFromAI(qi, lumin, rhythm, expectedRhythm) {
      // 1. 心象枢（心理安全）—— 权重 0.4
      const ruShi = lumin['如是'] || 0;
      const mindSafety = ruShi < 30 ? 0.2 : Math.min(1.0, 0.8 + (ruShi - 50) * 0.01);

      // 2. 时象枢（节律对齐）—— 权重 0.3
      const rhythmFit = rhythm === expectedRhythm ? 1.0 : 0.6;

      // 3. 卦象枢（文化共鸣）—— 权重 0.2
      const hexagramFit = 0.7;

      // 4. 地象枢（空间适配）—— 权重 0.1
      const geoFit = 0.85;

      const TSI = 
        mindSafety * 0.4 +
        rhythmFit * 0.3 +
        hexagramFit * 0.2 +
        geoFit * 0.1;

      return {
        TSI: parseFloat(Math.min(1.0, Math.max(0.0, TSI)).toFixed(3)),
        subScores: {
          心象枢: parseFloat(mindSafety.toFixed(2)),
          时象枢: rhythmFit,
          卦象枢: hexagramFit,
          地象枢: geoFit
        },
        decisionCard: {
          reason: `如是轮=${ruShi}%（${ruShi < 30 ? '低于安全阈值' : '稳定'}），节律=${rhythm}（${rhythm === expectedRhythm ? '对齐' : '偏移'}）`,
          action: TSI < 0.4 ? '启动一级熔断：仅推送基础呼吸练习' : '正常引导'
        }
      };
    }

    // 调用 TSI 计算
    const tsiResult = computeTSIFromAI(resultJson.qi, resultJson.lumin, resultJson.rhythm, currentRhythm);

    // 合并 TSI 到最终响应
    const finalResponse = {
      ...resultJson,
      TSI: tsiResult.TSI,
      subScores: tsiResult.subScores,
      decisionCard: tsiResult.decisionCard
    };
    // ===== 结束新增 =====

    res.status(200).json(finalResponse);

  } catch (error) {
    console.error('函数异常:', error);
    res.status(500).json({ error: '内部服务器错误' });
  }
};
