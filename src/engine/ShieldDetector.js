// src/engine/ShieldDetector.js
// X-TSOS 伦理熔断系统 · 核心检测模块
// 严格遵循《三元一枢架构体系》与《伦理熔断系统.md》
// 算法透明 · 无外部依赖 · 可跨端复用

/**
 * 由八炁（Qi）与五觉（Lumin）计算五息（Breath）
 * 依据：三元一枢 §2.3, §3.2, §4.1
 * 
 * @param {number[]} qi - 八炁向量 [Q0~Q7]，值域 [0, 1]
 *        Q0: 生发, Q1: 浮跃, Q2: 共感, Q3: 洞明,
 *        Q4: 沉降, Q5: 内守, Q6: 回响, Q7: 归寂
 * @param {Object} lumin - 五觉对象 {视, 听, 触, 味, 嗅}，值域 [0, 1]
 * @returns {Object} breath - 五息对象 {如是, 无垠, 破暗, 涓流, 映照}
 */
export function computeBreathFromQiAndLumin(qi, lumin) {
  // 输入校验
  if (!Array.isArray(qi) || qi.length !== 8) {
    throw new Error('Invalid qi: expected array of length 8');
  }
  if (typeof lumin !== 'object' || !lumin.hasOwnProperty('触')) {
    throw new Error('Invalid lumin: expected object with key "触"');
  }

  // 如是轮 = 触觉（直接映射）—— 三元一枢 §2.3
  const 如是 = lumin.触;

  // 无垠轮 = max(八炁) —— 表征灵性抽象强度，三元一枢 §3.2
  const 无垠 = Math.max(...qi);

  // 破暗轮 = 模式觉察力
  // = (视听觉平均) × (1 - |生发 - 沉降|)
  const patternAwareness = (
    (lumin.视 + lumin.听) / 2
  ) * (1 - Math.abs(qi[0] - qi[4]));

  // 涓流轮 = 行动能量
  // = 平均炁 × (0.5 + 0.5 × 触觉)
  const avgQi = qi.reduce((sum, val) => sum + val, 0) / qi.length;
  const 涓流 = avgQi * (0.5 + 0.5 * lumin.触);

  // 映照轮 = 共情响应
  // = (味嗅觉平均) × max(共感(Q2), 回响(Q6))
  const 映照 = (
    (lumin.味 + lumin.嗅) / 2
  ) * Math.max(qi[2], qi[6]);

  // 安全裁剪至 [0, 1]
  const clamp = x => Math.min(1, Math.max(0, x));

  return {
    如是: clamp(如是),
    无垠: clamp(无垠),
    破暗: clamp(patternAwareness),
    涓流: clamp(涓流),
    映照: clamp(映照)
  };
}

/**
 * 检测是否触发伦理熔断（Shield_1 ~ Shield_4）
 * 依据：《伦理熔断系统.md》第3节
 * 
 * @param {Object} breath - 五息状态
 * @param {number[]} qi - 八炁向量（用于 Shield_4 判断）
 * @returns {string[]} 激活的熔断ID列表，如 ['Shield_1']
 */
export function detectShields(breath, qi) {
  const { 如是, 无垠, 破暗, 涓流, 映照 } = breath;
  const qiMax = Math.max(...qi);
  const shields = [];

  // Shield_1: 灵性逃避
  if (如是 < 0.25 && 无垠 > 0.60) {
    shields.push('Shield_1');
  }

  // Shield_2: 模式盲区
  if (破暗 < 0.15) {
    shields.push('Shield_2');
  }

  // Shield_3: 边界耗竭
  if (映照 > 0.75 && 涓流 < 0.20) {
    shields.push('Shield_3');
  }

  // Shield_4: 意义虚无
  if (无垠 > 0.70 && 如是 < 0.25 && qiMax < 0.30) {
    shields.push('Shield_4');
  }

  return shields;
}

/**
 * 验证用户是否满足熔断解除条件
 * 要求：行为完成 + 状态回归
 * 
 * @param {string} shieldId - 熔断类型 ('Shield_1' ~ 'Shield_4')
 * @param {Object} breath - 当前五息状态
 * @param {Object} userActions - 用户提交的任务数据
 * @returns {boolean}
 */
export function canReleaseShield(shieldId, breath, userActions = {}) {
  const { 如是, 无垠, 破暗, 涓流, 映照 } = breath;

  switch (shieldId) {
    case 'Shield_1': // 赤足归地
      return (
        Array.isArray(userActions.groundingAnswers) &&
        userActions.groundingAnswers.length >= 2 &&
        如是 >= 0.30 &&
        无垠 <= 0.65
      );

    case 'Shield_2': // 模式日记
      return (
        typeof userActions.patternStatement === 'string' &&
        userActions.patternStatement.trim().length >= 6 &&
        破暗 >= 0.20
      );

    case 'Shield_3': // 边界呼吸
      return (
        userActions.boundarySet === true &&
        映照 <= 0.70 &&
        涓流 >= 0.25
      );

    case 'Shield_4': // 存在锚定
      return (
        Array.isArray(userActions.concreteActions) &&
        userActions.concreteActions.length >= 2 &&
        如是 >= 0.30 &&
        无垠 <= 0.65
      );

    default:
      return true; // 未知熔断默认可释放
  }
}

// ✅ 模块统一导出（兼容 ES Module）
export default {
  computeBreathFromQiAndLumin,
  detectShields,
  canReleaseShield
};
