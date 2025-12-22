// src/engine/DeepScreeningEngine.js
export class DeepScreeningEngine {
  constructor() {
    this.questions = [];
    this.answers = {};
    this.history = []; // { index, answer }
    this.currentIndex = 0;
  }

  async loadQuestionBank(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load: ${url}`);
      const data = await res.json();
      this.questions = Object.entries(data).map(([id, q]) => ({
        id,
        ...q,
        stage: q.stage || 1 // 默认 stage 为 1
      }));

      // 按 stage 排序，同 stage 按 ID 排序
      this.questions.sort((a, b) => {
        if (a.stage !== b.stage) return a.stage - b.stage;
        return a.id.localeCompare(b.id);
      });

      console.log(`✅ 加载成功：共 ${this.questions.length} 题`);
    } catch (err) {
      console.error('❌ 加载题库失败:', err);
      throw err;
    }
  }

  getCurrentQuestion() {
    if (this.currentIndex >= this.questions.length) {
      console.warn('⚠️ 已达到题库末尾');
      return null;
    }
    return this.questions[this.currentIndex];
  }

  submitAnswer(optionIndex) {
    const q = this.getCurrentQuestion();
    if (!q) return;

    this.answers[q.id] = optionIndex;
    this.history.push({ index: this.currentIndex, answer: optionIndex });
    this.currentIndex++;

    console.log(`✅ 提交第 ${this.currentIndex} 题，剩余 ${this.questions.length - this.currentIndex} 题`);
  }

  goBack() {
    if (this.history.length === 0) return false;

    const last = this.history.pop();
    this.currentIndex = last.index;
    this.answers[last.index] = last.answer; // 回退答案
    return true;
  }

  canGoBack() {
    return this.history.length > 0;
  }

  isCompleted() {
    return this.currentIndex >= this.questions.length;
  }

  getAnswerCount() {
    return this.history.length;
  }

  getFinalAnswers() {
    return { ...this.answers };
  }
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
