// 文件路径: api/tsos/route.js
// 功能：安全代理百炼智能体 API，返回 X-TSOS 三元结构

export const dynamic = 'force-dynamic'; // 每次请求都执行

export async function POST(request) {
  try {
    const answers = await request.json();

    // 从 Vercel 环境变量读取 API Key（安全！）
    const API_KEY = process.env.BAI_LIAN_API_KEY;
    if (!API_KEY) {
      return Response.json({ error: "缺少 API 密钥" }, { status: 500 });
    }

    // 构建符合 X-TSOS 架构的 Prompt
    const prompt = `
你是一个 X-TSOS 三元状态解析器。请根据用户回答，输出严格符合以下 JSON 格式的响应，不要任何额外文字：

{
  "qi": {"厚载":number,"萌动":number,"炎明":number,"润下":number,"肃降":number,"刚健":number,"通透":number,"静守":number},
  "lumin": {"如是":number,"破暗":number,"涓流":number,"映照":number,"无垠":number},
  "rhythm": "显化|涵育|敛藏|归元|止观"
}

要求：
- 数值范围：30–80
- rhythm 必须是五息律环之一
- 基于心性逻辑推断，而非随机

用户回答：${JSON.stringify(answers)}
`;

    // 调用百炼 API
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-max', // 或你的智能体模型ID
        input: {
          messages: [{ role: 'user', content: prompt }]
        }
      })
    });

    if (!response.ok) {
      throw new Error(`百炼 API 错误: ${response.status}`);
    }

    const data = await response.json();
    const content = data.output.choices[0].message.content;

    // 提取 JSON（兼容 Markdown 代码块）
    const jsonMatch = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
    const result = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(content);

    // 验证结构
    if (!result.qi || !result.lumin || !result.rhythm) {
      throw new Error("响应格式不符合 X-TSOS 架构");
    }

    return Response.json(result);

  } catch (error) {
    console.error("API 代理错误:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
