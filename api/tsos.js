// api/tsos.js —— 使用 module.exports，不是 export default
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const answers = req.body;
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const profile = [
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
  ].filter(Boolean).join("，") || "无显著特征";

  const month = new Date().getMonth();
  const rhythm = (month >= 2 && month <= 4) ? "显化"
               : (month >= 5 && month <= 7) ? "涵育"
               : (month >= 8 && month <= 10) ? "敛藏"
               : "归元";

  const BAILIAN_API_KEY = process.env.BAILIAN_API_KEY;
  if (!BAILIAN_API_KEY) {
    console.error('Missing BAILIAN_API_KEY');
    return res.status(500).json({ error: 'Server config error' });
  }

  const prompt = `
你是一个息壤·X-TSOS 解析器。只输出一个纯 JSON 对象，不要任何其他文字、解释、注释或 Markdown。
JSON 必须包含：qi（8维）、lumin（5维）、rhythm（值为 "${rhythm}"）。
qi 维度：炎明、潜幽、萌动、敦厚、通感、澄澈、归藏、和合（值 30-80）
lumin 维度：视、听、触、味、嗅（值 30-80）

用户特征：${profile}
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
        input: {
          messages: [{ role: 'user', content: prompt }]
        },
        parameters: { temperature: 0.7 }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Bailian API Error:', result);
      return res.status(502).json({ error: 'AI 服务暂时不可用' });
    }

    let text = result.output?.text?.trim();
    if (!text) {
      throw new Error('Empty AI response');
    }

    // 安全提取 JSON：找第一个 { 到最后一个 }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || start > end) {
      console.error('No JSON found in:', text);
      throw new Error('AI did not return valid JSON');
    }
    const jsonStr = text.slice(start, end + 1);
    const data = JSON.parse(jsonStr);

    // 最小验证
    if (!data.qi || !data.lumin || data.rhythm !== rhythm) {
      throw new Error('Missing required fields');
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Handler Error:', error.message);
    res.status(500).json({ error: '生成失败，请刷新重试' });
  }
};
