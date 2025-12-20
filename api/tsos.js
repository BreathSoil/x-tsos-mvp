// api/tsos.js
import { getBailianClient } from './bailian-client';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const answers = req.body;
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Invalid input' });
  }

  // 构建用户画像描述（用于 AI Prompt）
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

  // 获取当前五息律环（服务端计算，避免客户端伪造）
  const now = new Date();
  const month = now.getMonth();
  let rhythm;
  if (month >= 2 && month <= 4) rhythm = "显化";
  else if (month >= 5 && month <= 7) rhythm = "涵育";
  else if (month >= 8 && month <= 10) rhythm = "敛藏";
  else rhythm = "归元";

  const prompt = `
你是一个息壤·X-TSOS 三元状态解析器。请根据以下用户特征，在${rhythm}相位下，生成：
1. 八炁玄基（8维）：炎明、潜幽、萌动、敦厚、通感、澄澈、归藏、和合（每项 30-80 分）
2. 五觉光轮（5维）：视、听、触、味、嗅（每项 30-80 分）
3. rhythm 字段必须为 "${rhythm}"

用户特征：${profile}

输出严格为 JSON 格式，不要任何解释，例如：
{
  "qi": {"炎明":65,"潜幽":45,...},
  "lumin": {"视":70,"听":55,"触":50,"味":40,"嗅":45},
  "rhythm": "${rhythm}"
}
`;

  try {
    const client = getBailianClient();
    const response = await client.chat({
      model: 'qwen-max',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const resultText = response.output.text.trim();
    // 尝试提取 JSON（兼容可能的 Markdown 包裹）
    const jsonMatch = resultText.match(/```json\s*({[\s\S]*?})\s*```/) || resultText.match(/({[\s\S]*})/);
    const data = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(resultText);

    // 验证结构
    if (!data.qi || !data.lumin || !data.rhythm) {
      throw new Error('AI 返回格式错误');
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('AI 调用失败:', error);
    res.status(500).json({ error: '生成失败，请重试' });
  }
};
