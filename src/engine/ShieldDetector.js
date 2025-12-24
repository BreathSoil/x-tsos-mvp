// src/engine/ShieldDetector.js

/**
 * X-TSOS 伦理熔断检测器（质性模式匹配）
 * 
 * 严格依据《八炁玄基》《五觉光轮》《五息律环》《伦理熔断系统》设计
 * 
 * @module ShieldDetector
 * @version 1.2.0
 * @author X-TSOS Core Team
 */

// === 常量定义 ===
const QI_NAMES = [
  '厚载', '萌动', '炎明', '肃降',
  '通透', '刚健', '静守', '润下'
];

const LUMIN_WHEELS = [
  '如是轮', '破暗轮', '涓流轮', '映照轮', '无垠轮'
];

const BREATH_PHASES = ['生', '长', '化', '收', '藏'];

const VALID_SHIELDS = ['Shield_1', 'Shield_2', 'Shield_3', 'Shield_4'];

// === 熔断规则（来自《伦理熔断系统.md》）===

/**
 * 检测是否激活特定 Shield
 * 
 * @param {Object} qi - 八炁状态对象，键为 QI_NAMES，值为状态字符串
 * @param {Object} lumin - 五觉状态对象，键为 LUMIN_WHEELS，值为状态字符串
 * @param {string} breathPhase - 当前五息节律（必须为 BREATH_PHASES 之一）
 * @returns {string[]} 激活的 Shield ID 列表（去重、有序）
 */
export function detectShields(qi, lumin, breathPhase) {
  // === 安全校验 ===
  if (!qi || typeof qi !== 'object') throw new TypeError('qi 必须为对象');
  if (!lumin || typeof lumin !== 'object') throw new TypeError('lumin 必须为对象');
  if (!BREATH_PHASES.includes(breathPhase)) {
    console.warn(`⚠️ 无效 breathPhase: ${breathPhase}，默认使用 '藏'`);
    breathPhase = '藏';
  }

  // === 状态安全补全 ===
  const safeQi = {};
  for (const name of QI_NAMES) {
    safeQi[name] = qi[name] || '平衡'; // 默认“平衡”最安全
  }

  const safeLumin = {};
  for (const wheel of LUMIN_WHEELS) {
    safeLumin[wheel] = lumin[wheel] || '未亮';
  }

  const shields = new Set();

  // === Shield_1: 灵性逃避 ===
  // 条件：如是轮遮蔽 + 无垠轮闪烁/无界 + 厚载虚弱
  if (
    safeLumin.如是轮 === '遮蔽' &&
    ['闪烁', '无界'].includes(safeLumin.无垠轮) &&
    safeQi.厚载 === '虚弱'
  ) {
    shields.add('Shield_1');
  }

  // === Shield_2: 模式盲区 ===
  // 条件：破暗轮假亮 + 通透炁虚妄
  if (
    safeLumin.破暗轮 === '假亮' &&
    safeQi.通透 === '虚妄'
  ) {
    shields.add('Shield_2');
  }

  // === Shield_3: 边界耗竭 ===
  // 条件：映照轮吞噬 + (静守散乱 或 肃降耗散)
  if (
    safeLumin.映照轮 === '吞噬' &&
    (safeQi.静守 === '散乱' || safeQi.肃降 === '耗散')
  ) {
    shields.add('Shield_3');
  }

  // === Shield_4: 意义虚无 ===
  // 条件：如是轮未亮 + 无垠轮收缩 + 所有炁处于虚弱态
  const allQiWeak = QI_NAMES.every(name => {
    const state = safeQi[name];
    return ['虚弱', '冻结', '暗淡', '干涸', '阻塞', '涣散'].includes(state);
  });

  if (
    safeLumin.如是轮 === '未亮' &&
    safeLumin.无垠轮 === '收缩' &&
    allQiWeak
  ) {
    shields.add('Shield_4');
  }

  // 返回有效 Shield ID 列表
  return Array.from(shields).filter(id => VALID_SHIELDS.includes(id));
}

// === 工具函数 ===

/**
 * 获取当前五息节律（基于日期）
 * @returns {string} 当前五息阶段
 */
export function getCurrentBreathPhase() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
  const phaseIndex = Math.min(4, Math.max(0, Math.floor((dayOfYear % 365) / 73)));
  return BREATH_PHASES[phaseIndex];
}

/**
 * 验证 Shield 是否可解除
 * @param {string} shieldId
 * @param {Object} currentState
 * @param {Object} userActions
 * @returns {boolean}
 */
export function canReleaseShield(shieldId, currentState, userActions = {}) {
  const { qi, lumin } = currentState;

  switch (shieldId) {
    case 'Shield_1':
      return Boolean(
        userActions.groundingCompleted &&
        lumin.如是轮 === '微光' &&
        qi.厚载 !== '虚弱'
      );
    case 'Shield_2':
      return Boolean(
        userActions.patternJournalSubmitted &&
        lumin.破暗轮 === '敏锐'
      );
    case 'Shield_3':
      return Boolean(
        userActions.boundarySet &&
        lumin.映照轮 === '开放' &&
        qi.静守 === '专注'
      );
    case 'Shield_4': {
      const hasQiActivated = Object.values(qi).some(s =>
        ['激活', '萌芽', '涌动', '显化', '流通'].includes(s)
      );
      return Boolean(
        Array.isArray(userActions.concreteActions) &&
        userActions.concreteActions.length >= 2 &&
        lumin.如是轮 === '微光' &&
        hasQiActivated
      );
    }
    default:
      return true;
  }
}

// === 导出模块 ===
export default {
  detectShields,
  getCurrentBreathPhase,
  canReleaseShield
};

// === 测试用例（可在 tests/shield.detector.test.js 中调用）===
/*
describe('ShieldDetector', () => {
  test('应检测 Shield_1', () => {
    const qi = { 厚载: '虚弱' };
    const lumin = { 如是轮: '遮蔽', 无垠轮: '闪烁' };
    const bp = '生';
    expect(detectShields(qi, lumin, bp)).toEqual(['Shield_1']);
  });
});
*/
