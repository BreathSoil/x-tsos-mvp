// src/engine/GuidanceEngine.js

/**
 * X-TSOS 引导引擎（Guidance Engine）
 * 
 * 负责：
 * - 协调 DeepScreeningEngine 获取用户答案
 * - 调用 TriadicStateInferencer 推断三元状态
 * - 使用 ShieldDetector 检测熔断模式
 * - 在必要时安全调用 /api/shield-assist 获取 AI 辅助引导
 * - 输出符合伦理的质性引导语（无评判、非指令性、支持如是轮点亮）
 * 
 * 设计原则：
 * - 隐私优先：所有敏感数据仅在本地处理
 * - 伦理熔断：仅当检测到 Shield 且用户授权时才调用 API
 * - 节律对齐：引导内容适配当前五息阶段
 * 
 * @author X-TSOS Core
 * @version 1.4.0
 */

import DeepScreeningEngine from './DeepScreeningEngine.js';
import { inferTriadicState } from './TriadicStateInferencer.js';
import { detectShields, canReleaseShield } from './ShieldDetector.js';

// === 常量 ===
const SHIELD_LABELS = {
  'Shield_1': '灵性逃避',
  'Shield_2': '模式盲区',
  'Shield_3': '边界耗竭',
  'Shield_4': '意义虚无'
};

const DEFAULT_API_ENDPOINT = '/api/shield-assist';
const MAX_ASSIST_CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

/**
 * 引导引擎主类
 */
export class GuidanceEngine {
  /**
   * 构造函数
   * @param {Object} options
   * @param {string} [options.bankPath='/data/DQ420.json']
   * @param {string} [options.apiEndpoint='/api/shield-assist']
   * @param {boolean} [options.enableAIAssist=true] - 是否允许调用 AI 辅助
   */
  constructor(options = {}) {
    this.bankPath = options.bankPath || '/data/DQ420.json';
    this.apiEndpoint = options.apiEndpoint || DEFAULT_API_ENDPOINT;
    this.enableAIAssist = options.enableAIAssist !== false;

    this.screeningEngine = new DeepScreeningEngine({
      bankPath: this.bankPath,
      autoLoad: false
    });

    this.triadicState = null;
    this.activeShields = [];
    this.assistCache = new Map(); // { shieldId: { response, timestamp } }
  }

  /**
   * 初始化：加载题库
   * @returns {Promise<void>}
   */
  async init() {
    await this.screeningEngine.loadQuestionBank();
  }

  /**
   * 设置用户答案（代理到 screening engine）
   */
  setAnswer(questionId, value) {
    this.screeningEngine.setAnswer(questionId, value);
    this.triadicState = null; // 标记状态过期
    this.activeShields = [];   // 清除旧熔断
  }

  /**
   * 获取当前三元状态（惰性计算）
   * @returns {Object|null}
   */
  getTriadicState() {
    if (!this.triadicState && this.screeningEngine.isComplete()) {
      const answers = this.screeningEngine.getFinalAnswers();
      this.triadicState = inferTriadicState({ answers });
    }
    return this.triadicState;
  }

  /**
   * 检测当前激活的熔断模式
   * @returns {string[]}
   */
  detectActiveShields() {
    if (this.activeShields.length > 0) return this.activeShields;

    const state = this.getTriadicState();
    if (!state) return [];

    this.activeShields = detectShields(state.qi, state.lumin, state.breathPhase);
    return this.activeShields;
  }

  /**
   * 判断某 Shield 是否可解除
   * @param {string} shieldId
   * @param {Object} userActions - 用户已执行的行动
   * @returns {boolean}
   */
  canReleaseShield(shieldId, userActions) {
    const state = this.getTriadicState();
    if (!state) return false;
    return canReleaseShield(shieldId, state, userActions);
  }

  /**
   * 获取引导内容（核心方法）
   * @param {string} shieldId - 必须为已激活的 Shield
   * @param {Object} [options={}]
   * @param {boolean} [options.forceRefresh=false] - 忽略缓存
   * @returns {Promise<{ message: string, groundingTask: string, source: 'local' | 'ai' }>}
   */
  async getGuidanceForShield(shieldId, options = {}) {
    if (!this.detectActiveShields().includes(shieldId)) {
      throw new Error(`Shield ${shieldId} 未激活，无法提供引导`);
    }

    const now = Date.now();

    // 尝试从缓存读取
    if (!options.forceRefresh && this.assistCache.has(shieldId)) {
      const cached = this.assistCache.get(shieldId);
      if (now - cached.timestamp < MAX_ASSIST_CACHE_TTL) {
        return {
          ...cached.response,
          source: 'cache'
        };
      }
    }

    // 优先使用本地规则（保障离线可用）
    const localGuidance = this._getLocalGuidance(shieldId);
    if (!this.enableAIAssist) {
      return { ...localGuidance, source: 'local' };
    }

    // 尝试调用 AI 辅助（带降级）
    try {
      const aiResponse = await this._fetchAIGuidance(shieldId);
      if (aiResponse && aiResponse.message) {
        const result = {
          message: aiResponse.message,
          groundingTask: aiResponse.groundingTask || localGuidance.groundingTask,
          source: 'ai'
        };
        this.assistCache.set(shieldId, {
          response: result,
          timestamp: now
        });
        return result;
      }
    } catch (err) {
      console.warn('AI 辅助失败，降级到本地引导:', err.message);
    }

    // 降级到本地
    return { ...localGuidance, source: 'local' };
  }

  /**
   * 本地引导规则（基于 X-TSOS 伦理文档）
   * @private
   */
  _getLocalGuidance(shieldId) {
    const state = this.getTriadicState();
    const phase = state?.breathPhase || '藏';

    switch (shieldId) {
      case 'Shield_1':
        return {
          message: `你正处在「${SHIELD_LABELS[shieldId]}」状态。请回到大地，感受双脚与地面的接触。`,
          groundingTask: '赤脚站立 2 分钟，注意呼吸与重心'
        };
      case 'Shield_2':
        return {
          message: `你正处在「${SHIELD_LABELS[shieldId]}」状态。邀请你写下最近一次重复出现的困境模式。`,
          groundingTask: '手写 100 字日记，不评判，只观察'
        };
      case 'Shield_3':
        return {
          message: `你正处在「${SHIELD_LABELS[shieldId]}」状态。此刻，允许自己说“不”。`,
          groundingTask: '设定一个微小但清晰的边界（如：今天不回工作消息）'
        };
      case 'Shield_4':
        return {
          message: `你正处在「${SHIELD_LABELS[shieldId]}」状态。意义不在远方，就在此刻你手中的事里。`,
          groundingTask: '专注完成一件小事（如泡一杯茶、整理桌面）'
        };
      default:
        return {
          message: '回到呼吸，感受此刻的存在。',
          groundingTask: '深呼吸三次'
        };
    }
  }

  /**
   * 调用后端 AI 辅助接口
   * @private
   */
  async _fetchAIGuidance(shieldId) {
    const state = this.getTriadicState();
    if (!state) throw new Error('状态未就绪');

    const qiSummary = Object.entries(state.qi)
      .map(([k, v]) => `${k}:${v}`)
      .join('; ');

    const luminSummary = Object.entries(state.lumin)
      .map(([k, v]) => `${k}:${v}`)
      .join('; ');

    const payload = {
      shieldId,
      qiSummary,
      luminSummary,
      breathPhase: state.breathPhase
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s 超时

    try {
      const res = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      return {
        message: data.message || '',
        groundingTask: data.groundingTask || ''
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('请求超时');
      }
      throw err;
    }
  }

  /**
   * 获取整体筛查进度
   */
  getProgressSummary() {
    return this.screeningEngine.getProgressSummary();
  }

  /**
   * 重置所有状态
   */
  reset() {
    this.screeningEngine.resetAnswers();
    this.triadicState = null;
    this.activeShields = [];
    this.assistCache.clear();
  }
}

// 默认导出
export default GuidanceEngine;
