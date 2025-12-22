// src/guidance/GuidanceEngine.js
// 息壤·X-TSOS 行为指引生成引擎 —— 与 tsos.js + DeepScreeningEngine 对齐版

import { GuidanceRules_zh } from './rules/zh.js';

/**
 * 从向量中提取前 N 个最高分维度名称
 * @param {Object} vector - 如 { 厚载: 85, 萌动: 42, ... }
 * @param {number} topN - 返回数量
 * @returns {string[]}
 */
function getTopDimensions(vector, topN = 2) {
  return Object.entries(vector)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([key]) => key);
}

/**
 * 生成结构化行为指引（基于 X-TSOS 测试结果）
 *
 * @param {Object} dimensions - qi 和 lumin 维度得分（原始或归一化均可）
 *   {
 *     qi: { 厚载: 85, 萌动: 42, ... },
 *     lumin: { 如是: 100, 破暗: 67, ... }
 *   }
 * @param {string} rhythm - 当前节律（由系统时间决定，如 "涵育"）
 * @param {Object} [options]
 *   @param {number} [options.maxCount=3] - 最大建议数
 *   @param {string[]} [options.includeTags] - 仅返回包含这些标签的建议（如 ['生活']）
 * @returns {{
 *   rhythm: string,
 *   suggestions: Array<{
 *     forward: string,
 *     reverse: string,
 *     tags: string[]
 *   }>
 * }}
 */
export function generateGuidanceFromResult(dimensions, rhythm, options = {}) {
  const { maxCount = 3, includeTags = null } = options;
  const { qi, lumin } = dimensions;

  if (!rhythm || typeof rhythm !== 'string') {
    throw new Error('[GuidanceEngine] Missing or invalid "rhythm" (must be string)');
  }
  if (!qi || !lumin || typeof qi !== 'object' || typeof lumin !== 'object') {
    throw new Error('[GuidanceEngine] Invalid "dimensions": must contain qi and lumin objects');
  }

  const topQi = getTopDimensions(qi, 2);
  const topLumin = getTopDimensions(lumin, 1)[0];
  const rules = GuidanceRules_zh[rhythm] || [];

  // 打分匹配：lumin 完全匹配 (+2)，qi 每命中一个 (+1)
  const scored = rules.map(rule => {
    const qiMatches = rule.qi.filter(k => topQi.includes(k));
    const score = (rule.lumin === topLumin ? 2 : 0) + qiMatches.length;
    return { ...rule, score };
  }).filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);

  // 按标签过滤（若指定）
  let filtered = scored;
  if (includeTags && Array.isArray(includeTags) && includeTags.length > 0) {
    filtered = scored.filter(r =>
      r.tags.some(tag => includeTags.includes(tag))
    );
    if (filtered.length === 0) filtered = scored; // 回退到全部匹配项
  }

  // 构建输出（仅保留必要字段）
  const suggestions = filtered.slice(0, maxCount).map(rule => ({
    forward: rule.forward,
    reverse: rule.reverse || '',
    tags: [...rule.tags]
  }));

  // Fallback：若无匹配，提供通用建议
  if (suggestions.length === 0) {
    suggestions.push({
      forward: `当前主导节奏为【${rhythm}】，建议顺应此势，缓步而行，静待自显。`,
      reverse: '',
      tags: ['通用']
    });
  }

  return {
    rhythm,
    suggestions
  };
}

// 默认导出（便于 import）
export default generateGuidanceFromResult;
