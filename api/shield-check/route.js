// api/shield-check/route.js
// X-TSOS 云端熔断增强接口（可选）
// 输入：经差分隐私处理的 breath 片段 + 风险标记
// 输出：是否建议触发熔断（与前端逻辑一致，用于交叉验证或高级策略）

import { detectShields } from '../../../src/engine/ShieldDetector.js';

/**
 * 辅助函数：从上报载荷中重建最小 qi 向量（仅用于 Shield_4 判断）
 * 注意：前端不传完整 qi，仅传 qiMax；此处用 qiMax 填充模拟向量
 */
function reconstructQiFromMax(qiMax) {
  // 为满足 detectShields 的输入要求，构造一个 max=qiMax 的合法 qi 向量
  // 实际仅使用 Math.max(...qi)，故任意位置设为 qiMax 即可
  return [0, 0, 0, 0, 0, 0, 0, qiMax];
}

export async function POST(request) {
  try {
    const body = await request.json();

    // === 输入校验（最小字段集）===
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { breath, qiMax, hasRiskInput, version = '1.0' } = body;

    // 必需字段检查
    if (!breath || typeof breath !== 'object' || typeof qiMax !== 'number') {
      return new Response(JSON.stringify({ error: 'Missing breath or qiMax' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证 breath 结构（五息）
    const requiredBreathKeys = ['如是', '无垠', '破暗', '涓流', '映照'];
    for (const key of requiredBreathKeys) {
      if (typeof breath[key] !== 'number' || breath[key] < 0 || breath[key] > 1) {
        return new Response(JSON.stringify({ error: `Invalid breath.${key}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // === 熔断检测（与前端完全一致）===
    const qi = reconstructQiFromMax(qiMax);
    const shields = detectShields(breath, qi);

    // 可选：若存在高风险关键词且未触发熔断，可提升敏感度（未来扩展点）
    // 当前保持与前端逻辑严格一致

    // === 响应 ===
    return new Response(
      JSON.stringify({
        success: true,
        action: shields.length > 0 ? 'intervene' : 'proceed',
        shieldType: shields.length > 0 ? shields[0] : null,
        detectedShields: shields,
        version: 'shield-check-v1'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
          // 可选：添加 CORS（若需跨域）
          // 'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error) {
    console.error('Shield check error:', error.message);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// 支持 OPTIONS 预检（若启用 CORS）
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
