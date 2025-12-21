// src/engine/DeepScreeningEngine.js

export class DeepScreeningEngine {
  constructor() {
    this.qi = { 厚载: 0, 萌动: 0, 炎明: 0, 润下: 0, 肃降: 0, 刚健: 0, 通透: 0, 静守: 0 };
    this.lumin = { 如是: 0, 破暗: 0, 涓流: 0, 映照: 0, 无垠: 0 };
    this.rhythm = { 显化: 0, 涵育: 0, 敛藏: 0, 归元: 0, 止观: 0 };
    this.currentId = null;
    this.questionMap = null;
    this.answerHistory = [];
    this.completed = false;
    this.MIN_QUESTIONS = 42; // 深度筛查最小题数
  }

  async loadQuestionBank(url = './data/DQ420.json') {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      const { metadata, ...questions } = data;
      this.questionMap = questions;
      const allIds = Object.keys(questions);
      this.currentId = allIds.length > 0 ? allIds[0] : null;
    } catch (err) {
      console.error('❌ 题库加载失败:', err);
      throw err;
    }
  }

  getCurrentQuestion() {
    if (!this.questionMap || !this.currentId) return null;
    const q = this.questionMap[this.currentId];
    return q && q.text && Array.isArray(q.options) ? q : null;
  }

  submitAnswer(optionIndex) {
    // 🔒 第一层防护：确保当前题有效
    let q = this.getCurrentQuestion();
    if (!q || optionIndex == null || !q.options[optionIndex]) {
      console.warn('⚠️ 无效题目或选项，尝试恢复...');
      this.recoverFromInvalidState();
      return;
    }

    // 记录答案
    this.answerHistory.push({ id: this.currentId, option: optionIndex });

    // 应用效果
    const effects = q.options[optionIndex].effects || {};
    this.applyEffects(this.qi, effects.qi);
    this.applyEffects(this.lumin, effects.lumin);
    this.applyEffects(this.rhythm, effects.rhythm);

    // 解析 nextId（兼容数组和对象）
    let nextId = null;
    if (Array.isArray(q.next_map)) {
      nextId = q.next_map[optionIndex];
    } else if (q.next_map && typeof q.next_map === 'object') {
      nextId = q.next_map[String(optionIndex)];
    }

    // 判断是否应结束
    const shouldEnd = (nextId === 'END' || !nextId || !this.questionMap?.[nextId]);

    if (shouldEnd) {
      if (this.answerHistory.length >= this.MIN_QUESTIONS) {
        // ✅ 达到最小题数，允许结束
        this.completed = true;
        console.log('✅ 筛查完成，共答题:', this.answerHistory.length);
      } else {
        // ❌ 未达42题，强制兜底跳转
        const fallbackId = this.findFallbackQuestion(q);
        if (fallbackId && this.questionMap?.[fallbackId]) {
          this.currentId = fallbackId;
          console.log('🔄 未满42题，兜底跳转至:', fallbackId);
        } else {
          // 最终兜底：按ID顺序走
          this.fallbackBySequential();
        }
      }
    } else {
      this.currentId = nextId;
    }
  }

  // 🔁 安全恢复机制
  recoverFromInvalidState() {
    if (!this.questionMap) return;
    const allIds = Object.keys(this.questionMap);
    if (allIds.length === 0) return;

    // 优先尝试回到最近答过的有效题之后
    for (let i = this.answerHistory.length - 1; i >= 0; i--) {
      const prevId = this.answerHistory[i].id;
      const idx = allIds.indexOf(prevId);
      if (idx !== -1 && idx + 1 < allIds.length) {
        this.currentId = allIds[idx + 1];
        console.log('🔄 从历史恢复到:', this.currentId);
        return;
      }
    }

    // 否则从头开始
    this.currentId = allIds[Math.min(this.answerHistory.length, allIds.length - 1)];
    console.log('🔄 重置到默认题:', this.currentId);
  }

  // 🔄 按ID顺序兜底（最后手段）
  fallbackBySequential() {
    const allIds = Object.keys(this.questionMap || {});
    if (allIds.length === 0) {
      this.completed = true;
      return;
    }
    const currentIndex = allIds.indexOf(this.currentId);
    const nextIndex = Math.min(currentIndex + 1, allIds.length - 1);
    this.currentId = allIds[nextIndex];
    console.log('⏭️ 顺序兜底至:', this.currentId);
  }

  // ✅ 安全兜底：只返回存在的题
  findFallbackQuestion(currentQuestion) {
    if (!this.questionMap) return null;

    const stage = currentQuestion.stage || 1;
    const allIds = Object.keys(this.questionMap);
    
    // 优先同 stage 的题
    const sameStage = allIds.filter(id => {
      const q = this.questionMap[id];
      return q && q.stage === stage;
    });

    if (sameStage.length > 0) {
      // 按题号排序，选下一个（避免随机跳）
      const sorted = sameStage.sort();
      const currentIndex = sorted.indexOf(this.currentId);
      if (currentIndex !== -1 && currentIndex + 1 < sorted.length) {
        return sorted[currentIndex + 1];
      }
      return sorted[0]; // 循环回开头
    }

    // 退而求其次：任意题
    const nextIndex = Math.min(this.answerHistory.length, allIds.length - 1);
    return allIds[nextIndex];
  }

  applyEffects(target, source) {
    if (!source) return;
    for (const [key, value] of Object.entries(source)) {
      target[key] = (target[key] || 0) + (value || 0);
    }
  }

  isCompleted() {
    return this.completed || this.answerHistory.length >= 60;
  }

  getNormalizedResult() {
    const normalize = (obj) => {
      const values = Object.values(obj).map(v => Math.abs(v));
      const max = Math.max(...values, 0.1);
      const result = {};
      for (const key in obj) {
        result[key] = Math.round((Math.abs(obj[key]) / max) * 100);
      }
      return result;
    };

    let dominantRhythm = '涵育';
    let maxRhythm = -Infinity;
    for (const [key, val] of Object.entries(this.rhythm)) {
      if (val > maxRhythm) {
        maxRhythm = val;
        dominantRhythm = key;
      }
    }

    return {
      qi: normalize(this.qi),
      lumin: normalize(this.lumin),
      rhythm: dominantRhythm
    };
  }
}
