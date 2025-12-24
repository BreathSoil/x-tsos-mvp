// src/engine/DeepScreeningEngine.js

/**
 * X-TSOS 深度筛查引擎（Deep Screening Engine）
 * 
 * 负责加载 data/DQ420.json 题库，管理用户答题流程，
 * 并输出结构化答案供 TriadicStateInferencer 使用。
 * 
 * 特性：
 * - 支持五觉轮次分阶段筛查（如是 → 破暗 → 涓流 → 映照 → 无垠）
 * - 自动进度追踪与完成状态判断
 * - 兼容浏览器 (fetch) 与 Node.js (fs) 环境
 * - 无网络上报，所有数据保留在本地
 * 
 * @author X-TSOS Core
 * @version 1.3.0
 */

const LUMIN_WHEELS = ['如是轮', '破暗轮', '涓流轮', '映照轮', '无垠轮'];
const DEFAULT_BANK_PATH = '/data/DQ420.json';

export class DeepScreeningEngine {
  /**
   * 构造函数
   * @param {Object} [options={}]
   * @param {string} [options.bankPath='/data/DQ420.json'] - 题库路径
   * @param {boolean} [options.autoLoad=true] - 是否自动加载题库
   */
  constructor(options = {}) {
    this.bankPath = options.bankPath || DEFAULT_BANK_PATH;
    this.questions = [];
    this.answers = {};
    this.isLoaded = false;
    this.phaseProgress = {};

    if (options.autoLoad !== false) {
      this.loadQuestionBank();
    }
  }

  /**
   * 加载题库（自动适配环境）
   * @returns {Promise<void>}
   */
  async loadQuestionBank() {
    let rawData;

    try {
      // 判断是否为浏览器环境
      if (typeof window !== 'undefined' && typeof fetch === 'function') {
        // 浏览器：使用 fetch
        const res = await fetch(this.bankPath);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        rawData = await res.json();
      } else {
        // Node.js：使用 fs
        const fs = await import('fs').catch(() => null);
        const path = await import('path').catch(() => null);
        if (!fs || !path) {
          throw new Error('无法在非浏览器环境中加载题库：缺少 fs/path 模块');
        }
        const resolvedPath = path.resolve(process.cwd(), this.bankPath.replace(/^\/+/, ''));
        const fileContent = fs.readFileSync(resolvedPath, 'utf8');
        rawData = JSON.parse(fileContent);
      }

      this._validateAndIndex(rawData);
      this.isLoaded = true;

      // 初始化五觉轮进度
      for (const wheel of LUMIN_WHEELS) {
        const total = this.questions.filter(q => q.luminWheel === wheel).length;
        this.phaseProgress[wheel] = {
          total,
          answered: 0,
          completed: total === 0 // 若某轮无题，则视为完成
        };
      }

      console.log(`✅ X-TSOS DQ420 题库加载成功（共 ${this.questions.length} 题）`);
    } catch (err) {
      console.error('❌ DeepScreeningEngine 加载失败:', err);
      throw new Error(`题库加载失败: ${err.message}`);
    }
  }

  /**
   * 验证并索引题库数据
   * @private
   */
  _validateAndIndex(data) {
    if (!data || !Array.isArray(data.questions)) {
      throw new Error('题库格式错误：根字段 "questions" 必须为数组');
    }

    const validQuestions = [];
    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];

      // 必填字段检查
      if (!q.id || !q.text || !q.luminWheel || !q.qiAffinity) {
        console.warn(`⚠️ 第 ${i + 1} 题缺失必要字段 (id/text/luminWheel/qiAffinity)，已跳过`);
        continue;
      }

      // 轮次合法性
      if (!LUMIN_WHEELS.includes(q.luminWheel)) {
        console.warn(`⚠️ 题目 ${q.id} 的 luminWheel "${q.luminWheel}" 无效，已跳过`);
        continue;
      }

      // qiAffinity 标准化为数组
      const qiAffinity = Array.isArray(q.qiAffinity) ? q.qiAffinity : [q.qiAffinity];

      validQuestions.push({
        id: String(q.id).trim(),
        text: String(q.text).trim(),
        luminWheel: q.luminWheel,
        qiAffinity,
        type: q.type || 'single',
        options: Array.isArray(q.options) ? q.options : [],
        required: q.required !== false
      });
    }

    this.questions = validQuestions;
  }

  /**
   * 设置用户对某题的回答
   * @param {string} questionId
   * @param {*} value - 回答值（根据题型可为 string/number/array）
   */
  setAnswer(questionId, value) {
    if (!this.isLoaded) {
      throw new Error('题库未加载，请先调用 loadQuestionBank()');
    }

    const question = this.questions.find(q => q.id === questionId);
    if (!question) {
      console.warn(`⚠️ 未找到题目 ID: "${questionId}"`);
      return;
    }

    // 处理空值（仅当题目非必答时允许清除）
    if (value == null || value === '') {
      if (question.required) {
        console.warn(`⚠️ 题目 ${questionId} 为必答，跳过空值设置`);
        return;
      } else {
        delete this.answers[questionId];
      }
    } else {
      this.answers[questionId] = value;
    }

    // 更新对应轮次进度
    this._updatePhaseProgress(question.luminWheel);
  }

  /**
   * 更新指定轮次的答题进度
   * @private
   */
  _updatePhaseProgress(wheel) {
    const total = this.phaseProgress[wheel].total;
    const answered = this.questions
      .filter(q => q.luminWheel === wheel)
      .filter(q => this.answers.hasOwnProperty(q.id))
      .length;

    this.phaseProgress[wheel].answered = answered;
    this.phaseProgress[wheel].completed = answered >= total;
  }

  /**
   * 获取指定五觉轮的问题列表
   * @param {string} wheel - 如 '如是轮'
   * @returns {Array}
   */
  getQuestionsByWheel(wheel) {
    if (!LUMIN_WHEELS.includes(wheel)) {
      throw new Error(`无效的五觉轮名称: ${wheel}`);
    }
    return this.questions.filter(q => q.luminWheel === wheel);
  }

  /**
   * 获取当前应进行的筛查轮次（按顺序）
   * @returns {string|null} 返回未完成的第一个轮次，若全部完成则返回 null
   */
  getCurrentPhase() {
    for (const wheel of LUMIN_WHEELS) {
      if (!this.phaseProgress[wheel].completed) {
        return wheel;
      }
    }
    return null;
  }

  /**
   * 检查整个筛查是否完成
   * @returns {boolean}
   */
  isComplete() {
    return LUMIN_WHEELS.every(wheel => this.phaseProgress[wheel].completed);
  }

  /**
   * 获取最终答案对象（用于状态推断）
   * @returns {Object} { [questionId]: answer }
   */
  getFinalAnswers() {
    return { ...this.answers };
  }

  /**
   * 获取进度摘要
   * @returns {Object}
   */
  getProgressSummary() {
    const total = this.questions.length;
    const answered = Object.keys(this.answers).length;
    return {
      total,
      answered,
      percent: total > 0 ? Math.round((answered / total) * 100) : 0,
      phases: { ...this.phaseProgress }
    };
  }

  /**
   * 重置答题状态（保留题库）
   */
  resetAnswers() {
    this.answers = {};
    for (const wheel of LUMIN_WHEELS) {
      this.phaseProgress[wheel].answered = 0;
      this.phaseProgress[wheel].completed = this.phaseProgress[wheel].total === 0;
    }
  }
}

// 默认导出
export default DeepScreeningEngine;
