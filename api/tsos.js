// api/tsos.js
export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const answers = req.body;
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Invalid input format' });
  }

  // 构建用户画像
  const traits = [
    answers.q1 ? "炎明显著" : "",
    answers.q2 ? "潜幽倾向" : "",
    answers.q3 ? "萌动活跃" : "",
    answers.q4 ? "敦厚稳定" : "",
    answers.q5 ? "通感敏锐" : "",
    answers.q6 ? "澄澈理性" : "",
    answers.q7 ? "归藏同步" : "",
    answers.q8 ? "和合协调" : "",
    answers.q9 ? "视觉主导" : "",
    answers.q10 ? "听觉敏感" : ""
  ].filter(Boolean);

  const profile = traits.length > 0 ? traits.join("，") : "无显著特征";

  // 计算五息律环（服务端）
  const month = new Date().getMonth();
  const rhythm = (month >= 2 && month <= 4) ? "显化"
               : (month >= 5 && month <= 7) ? "涵育"
               : (month >= 8 && month <= 10) ? "敛藏"
               : "归元";

  // 获取 API Key
  const BAILIAN_API_KEY = process.env.BAILIAN_API_KEY;
  if (!BAILIAN_API_KEY) {
    console.error('Missing BAILIAN_API_KEY in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const prompt = `
你是一个息壤·X-TSOS 三元状态解析器。请根据以下用户特征，在${rhythm}相位下，生成：
1. 八炁玄基（8维）：炎明、潜幽、萌动、敦厚、通感、澄澈、归藏、和合（每项 30-80 分）
2. 五觉光轮（5维）：视、听、触、味、嗅（每项 30-80 分）
3. rhythm 字段必须为 "${rhythm}"

用户特征：${profile}

输出严格为纯 JSON 格式，不要任何解释、注释或 Markdown，例如：
{"qi":{"炎明":65,"潜幽":45,"萌动":70,"敦厚":55,"通感":60,"澄澈":50,"归藏":40,"和合":62},"lumin":{"视":70,"听":55,"触":50,"味":40,"嗅":45},"rhythm":"${rhythm}"}
`;

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BAILIAN_API_KEY}`
      },
      body: JSON.stringify({
        model: 'qwen-max',
        input: { messages: [{ role: 'user', content: prompt }] },
        parameters: { temperature: 0.7 }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Bailian API error:', result);
      return res.status(502).json({ error: 'AI 服务暂时不可用' });
    }

    const text = result.output?.text?.trim();
    if (!text) {
      throw new Error('Empty AI response');
    }

    // 尝试提取 JSON（兼容各种格式）
    let parsed;
    try {
      // 先尝试直接解析
      parsed = JSON.parse(text);
    } catch {
      // 尝试从 ```json ... ``` 中提取
      const match = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
      if (match) {
        parsed = JSON.parse(match[1]);
      } else {
        // 尝试查找第一个 { ... }
        const jsonMatch = text.match(/({[\s\S]*})/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error('No valid JSON found in AI response');
        }
      }
    }

    // 验证结构
    const requiredQi = ['炎明','潜幽','萌动','敦厚','通感','澄澈','归藏','和合'];
    const requiredLumin = ['视','听','触','味','嗅'];

    if (!parsed.qi || !parsed.lumin || parsed.rhythm !== rhythm) {
      throw new Error('Missing required fields');
    }

    for (const key of requiredQi) {
      if (!(key in parsed.qi) || typeof parsed.qi[key] !== 'number') {
        throw new Error(`Missing or invalid qi.${key}`);
      }
    }
    for (const key of requiredLumin) {
      if (!(key in parsed.lumin) || typeof parsed.lumin[key] !== 'number') {
        throw new Error(`Missing or invalid lumin.${key}`);
      }
    }

    res.status(200).json(parsed);
  } catch (error) {
    console.error('AI Generation Error:', error);
    res.status(500).json({ error: '生成失败，请刷新页面重试' });
  }
};
