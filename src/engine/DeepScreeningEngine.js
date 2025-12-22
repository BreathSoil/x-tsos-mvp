// src/engine/DeepScreeningEngine.js

export class DeepScreeningEngine {
  constructor() {
    // ⚠️ 注意：rhythm 不再是答题累积项！由系统时间决定
    this.qi = { 厚载: 0, 萌动: 0, 炎明: 0, 润下: 0, 肃降: 0, 刚健: 0, 通透: 0, 静守: 0 };
    this.lumin = { 如是: 0, 破暗: 0, 涓流: 0, 映照: 0, 无垠: 0 };

    this.currentId = null;
    this.questionMap = null;
    this.answerHistory = [];
    this.completed = false;

    this.MIN_QUESTIONS = 42; // 深度筛查最小题数
    this.MAX_QUESTIONS = 60; // 安全上限
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
    return q && typeof q.text === 'string' && Array.isArray(q.options) ? q : null;
  }

  getAnswerCount() {
    return this.answerHistory.length;
  }

  submitAnswer(optionIndex) {
    const q = this.getCurrentQuestion();
    if (!q || optionIndex == null || !q.options[optionIndex]) {
      console.warn('⚠️ 无效题目或选项，尝试恢复...');
      this.recoverFromInvalidState();
      return;
    }

    // 记录答案
    this.answerHistory.push({ id: this.currentId, option: optionIndex });

    // 应用 effects（仅 qi 和 lumin）
    const effects = q.options[optionIndex].effects || {};
    this.applyEffects(this.qi, effects.qi);
    this.applyEffects(this.lumin, effects.lumin);

    // 解析下一题
    let nextId = null;
    if (Array.isArray(q.next_map)) {
      nextId = q.next_map[optionIndex];
    } else if (q.next_map && typeof q.next_map === 'object') {
      nextId = q.next_map[String(optionIndex)];
    }

    const shouldEnd = (nextId === 'END' || !nextId || !this.questionMap?.[nextId]);

    if (shouldEnd) {
      if (this.answerHistory.length >= this.MIN_QUESTIONS) {
        this.completed = true;
        console.log('✅ 筛查完成，共答题:', this.answerHistory.length);
      } else {
        // 未达42题，兜底跳转
        const fallbackId = this.findFallbackQuestion(q);
        if (fallbackId && this.questionMap[fallbackId]) {
          this.currentId = fallbackId;
        } else {
          this.fallbackBySequential();
        }
      }
    } else {
      this.currentId = nextId;
    }
  }

  recoverFromInvalidState() {
    if (!this.questionMap) return;
    const allIds = Object.keys(this.questionMap);
    if (allIds.length === 0) return;

    for (let i = this.answerHistory.length - 1; i >= 0; i--) {
      const prevId = this.answerHistory[i].id;
      const idx = allIds.indexOf(prevId);
      if (idx !== -1 && idx + 1 < allIds.length) {
        this.currentId = allIds[idx + 1];
        return;
      }
    }
    this.currentId = allIds[Math.min(this.answerHistory.length, allIds.length - 1)];
  }

  fallbackBySequential() {
    const allIds = Object.keys(this.questionMap || {});
    if (allIds.length === 0) {
      this.completed = true;
      return;
    }
    const currentIndex = allIds.indexOf(this.currentId);
    const nextIndex = Math.min(currentIndex + 1, allIds.length - 1);
    this.currentId = allIds[nextIndex];
  }

  findFallbackQuestion(currentQuestion) {
    if (!this.questionMap) return null;
    const stage = currentQuestion.stage || 1;
    const allIds = Object.keys(this.questionMap);

    const sameStage = allIds.filter(id => {
      const q = this.questionMap[id];
      return q && q.stage === stage;
    });

    if (sameStage.length > 0) {
      const sorted = sameStage.sort();
      const currentIndex = sorted.indexOf(this.currentId);
      if (currentIndex !== -1 && currentIndex + 1 < sorted.length) {
        return sorted[currentIndex + 1];
      }
      return sorted[0];
    }

    return allIds[Math.min(this.answerHistory.length, allIds.length - 1)];
  }

  applyEffects(target, source) {
    if (!source || typeof source !== 'object') return;
    for (const key in source) {
      if (target.hasOwnProperty(key)) {
        target[key] += Number(source[key]) || 0;
      }
    }
  }

  undoEffects(target, source) {
    if (!source || typeof source !== 'object') return;
    for (const key in source) {
      if (target.hasOwnProperty(key)) {
        target[key] -= Number(source[key]) || 0;
      }
    }
  }

  isCompleted() {
    return this.completed || this.answerHistory.length >= this.MAX_QUESTIONS;
  }

  // 📤 提交给 tsos.js 的原始 answers 对象（用于 extractEffectsFromAnswers）
  getRawAnswers() {
    const answers = {};
    for (const { id, option } of this.answerHistory) {
      answers[id] = option;
    }
    return answers;
  }

  // 📊 供前端预览用（可选），但注意：tsos.js 不使用此归一化结果！
  getPreviewResult() {
    const normalizeToRange = (obj, min = 30, max = 80) => {
      const values = Object.values(obj);
      const total = Math.max(1, values.reduce((a, b) => a + Math.abs(b), 0));
      const result = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const ratio = Math.abs(obj[key]) / total;
          result[key] = Math.round(min + ratio * (max - min));
        }
      }
      return result;
    };

    return {
      qi: normalizeToRange(this.qi),
      lumin: normalizeToRange(this.lumin)
    };
  }

  // ===== 回退功能 =====

  canGoBack() {
    return this.answerHistory.length > 0 && !this.completed;
  }

  goBack() {
    if (!this.canGoBack()) return false;

    const lastAnswer = this.answerHistory.pop();
    const q = this.questionMap?.[lastAnswer.id];
    if (!q) return false;

    const effects = q.options[lastAnswer.option]?.effects || {};
    this.undoEffects(this.qi, effects.qi);
    this.undoEffects(this.lumin, effects.lumin);

    this.currentId = lastAnswer.id;
    this.completed = false;
    return true;
  }
}
