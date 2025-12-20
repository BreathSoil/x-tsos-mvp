// 文件路径: api/tsos.js
// 功能：安全调用百炼智能体，返回 X-TSOS 三元结构

export default async (req, res) => {
  // 仅允许 POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const answers = req.body || {};

    // 1. 从环境变量读取 API Key（安全！）
    const API_KEY = process.env.BAI_LIAN_API_KEY;
    if (!API_KEY) {
      console.error('缺失 BAI_LIAN_API_KEY 环境变量');
      return res.status(500).json({ error: '服务器配置错误' });
    }

    // 2. 构建 X-TSOS 专用 Prompt
    const prompt = `
你是一个 X-TSOS 三元状态解析器。请根据用户回答，输出严格符合以下 JSON 格式的响应，不要任何额外文字、解释或 Markdown：

{
  "qi": {"厚载":number,"萌动":number,"炎明":number,"润下":number,"肃降":number,"刚健":number,"通透":number,"静守":number},
  "lumin": {"如是":number,"破暗":number,"涓流":number,"映照":number,"无垠":number},
  "rhythm": "显化|涵育|敛藏|归元|止观"
}

要求：
- 所有数值必须在 30–80 之间
- rhythm 必须是五息律环之一（根据当前季节或用户状态推断）
- 基于心性逻辑推演，避免随机或平均分配
- 用户回答：${JSON.stringify(answers)}
`;

    // 3. 调用百炼 API
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-max', // 或你的专属智能体模型ID
        input: {
          messages: [{ role: 'user', content: prompt }]
        },
        parameters: {
          result_format: 'message'
        }
      })
    });

    // 4. 处理百炼响应
    if (!response.ok) {
      const errorText = await response.text();
      console.error('百炼 API 错误:', response.status, errorText);
      return res.status(500).json({ error: `AI 服务异常 (${response.status})` });
    }

    const data = await response.json();
    const content = data?.output?.choices?.[0]?.message?.content;

    if (!content) {
      console.error('百炼返回内容为空:', data);
      return res.status(500).json({ error: 'AI 未返回有效内容' });
    }

    // 5. 提取并解析 JSON（兼容带 ```json 的情况）
    let resultJson;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      resultJson = JSON.parse(jsonString.trim());
    } catch (parseErr) {
      console.error('JSON 解析失败:', content);
      return res.status(500).json({ error: 'AI 返回格式错误' });
    }

    // 6. 验证结构
    const requiredQi = ['厚载','萌动','炎明','润下','肃降','刚健','通透','静守'];
    const requiredLumin = ['如是','破暗','涓流','映照','无垠'];

    if (
      !resultJson.qi ||
      !resultJson.lumin ||
      !resultJson.rhythm ||
      requiredQi.some(k => !(k in resultJson.qi)) ||
      requiredLumin.some(k => !(k in resultJson.lumin))
    ) {
      console.error('响应结构不完整:', resultJson);
      return res.status(500).json({ error: 'AI 返回数据不完整' });
    }

    // 7. 返回成功结果
    res.status(200).json(resultJson);

  } catch (error) {
    console.error('Serverless 函数异常:', error);
    res.status(500).json({ error: '内部服务器错误' });
  }
};
