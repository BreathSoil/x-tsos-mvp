// api/tsos.js
export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST' });
  }

  try {
    const answers = req.body || {};
    const API_KEY = process.env.BAI_LIAN_API_KEY;

    // === 临时返回 Mock（先确保通路）===
    return res.status(200).json({
      qi: { 厚载: 60, 萌动: 55, 炎明: 65, 润下: 50, 肃降: 58, 刚健: 70, 通透: 52, 静守: 45 },
      lumin: { 如是: 60, 破暗: 50, 涓流: 55, 映照: 68, 无垠: 62 },
      rhythm: "涵育"
    });

    // 后续再替换为真实 API 调用
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
