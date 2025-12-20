// api/yearbook.js
// 生成 X-TSOS 三元年鉴（自然语言版）

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { qi, lumin, rhythm } = req.body;

  // 验证输入
  if (!qi || !lumin || !rhythm) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const requiredQi = ['厚载','萌动','炎明','润下','肃降','刚健','通透','静守'];
  const requiredLumin = ['如是','破暗','涓流','映照','无垠'];

  if (
    requiredQi.some(k => !(k in qi) || typeof qi[k] !== 'number') ||
    requiredLumin.some(k => !(k in lumin) || typeof lumin[k] !== 'number')
  ) {
    return res.status(400).json({ error: '数据格式错误' });
  }

  // 获取 API Key（与 tsos 一致）
  const API_KEY = process.env.BAI_LIAN_API_KEY;
  if (!API_KEY) {
    console.error('缺失 BAI_LIAN_API_KEY');
    return res.status(500).json({ error: '服务器配置错误' });
  }

  // 构建年鉴 Prompt
  const prompt = `
你是一位息壤·X-TSOS 年鉴撰写者，精通东方心性哲学。请根据以下三元状态，生成一段 200–300 字的「三元年鉴」：

【当前五息律环】${rhythm}
【八炁玄基】${JSON.stringify(qi)}
【五觉光轮】${JSON stringify(lumin)}

要求：
1. 以“君之三元，当如……”开篇
2. 解读炁机强弱（如“炎明炽盛，宜配润下以济其燥”）
3. 揭示感知天赋（如“破暗之觉锐利，可烛照幽微”）
4. 给出心性调和建议（如“厚载与刚健并显，当守中道，勿过执”）
5. 语言风格：融合《庄子》之逸、《内经》之和、《周易》之变，但用现代白话
6. 不使用“你将……”“你会……”等预测性语言，只作映照与启发
7. 不要标题、不要列表、不要解释，只输出正文

现在开始撰写：
`;

  try {
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
          temperature: 0.85  // 稍高以增强文采
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('百炼年鉴生成失败:', response.status, text);
      return res.status(502).json({ error: '年鉴生成服务暂时不可用' });
    }

    const data = await response.json();
    const content = data?.output?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('AI 未返回年鉴内容');
    }

    // 清理可能的 ``` 或多余说明
    const cleanText = content
      .replace(/^```(?:\w+)?\s*/, '')
      .replace(/\s*```$/, '')
      .trim();

    res.status(200).json({ yearbook: cleanText });

  } catch (error) {
    console.error('年鉴生成异常:', error);
    res.status(500).json({ error: '年鉴生成失败，请稍后重试' });
  }
};
