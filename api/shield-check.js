// api/shield-check.js
// X-TSOS 熔断系统 · Vercel Serverless Function（非 Next.js 项目）
// 输入：经差分隐私处理的 breath + qiMax
// 输出：熔断建议（与前端 ShieldDetector 逻辑严格一致）

/**
 * 内联核心熔断逻辑（同步自 src/engine/ShieldDetector.js）
 */
function detectShields(breath, qi) {
  const { 如是, 无垠, 破暗, 涓流, 映照 } = breath;
  const qiMax = Math.max(...qi);
  const shields = [];

  // Shield_1: 灵性逃避（如是低 + 无垠高）
  if (如是 < 0.25 && 无垠 > 0.60) shields.push('Shield_1');

  // Shield_2: 模式盲区（破暗极低）
  if (破暗 < 0.15) shields.push('Shield_2');

  // Shield_3: 共情过载（映照高 + 涓流低）
  if (映照 > 0.75 && 涓流 < 0.20) shields.push('Shield_3');

  // Shield_4: 存在虚无（无垠高 + 如是低 + Qi 整体低）
  if (无垠 > 0.70 && 如是 < 0.25 && qiMax < 0.30) shields.push('Shield_4');

  return shields;
}

/**
 * 从 qiMax 重建最小合法 qi 向量（仅用于 Math.max）
 */
function reconstructQiFromMax(qiMax) {
  return [0, 0, 0, 0, 0, 0, 0, qiMax];
}

module.exports = (req, res) => {
  // 仅允许 POST（兼容预检 OPTIONS）
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body;

    // 输入校验
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const { breath, qiMax, hasRiskInput, version = '1.0' } = body;

    if (!breath || typeof breath !== 'object' || typeof qiMax !== 'number') {
      return res.status(400).json({ error: 'Missing breath or qiMax' });
    }

    // 验证五息字段
    const requiredBreathKeys = ['如是', '无垠', '破暗', '涓流', '映照'];
    for (const key of requiredBreathKeys) {
      if (typeof breath[key] !== 'number' || breath[key] < 0 || breath[key] > 1) {
        return res.status(400).json({ error: `Invalid breath.${key}` });
      }
    }

    // 执行熔断检测
    const qi = reconstructQiFromMax(qiMax);
    const shields = detectShields(breath, qi);

    // 返回结果
    res.status(200).json({
      success: true,
      action: shields.length > 0 ? 'intervene' : 'proceed',
      shieldType: shields.length > 0 ? shields[0] : null,
      detectedShields: shields,
      version: 'shield-check-v1'
    });
  } catch (error) {
    console.error('Shield check error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
