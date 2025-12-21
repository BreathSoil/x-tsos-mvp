// src/engine/DeepScreeningEngine.js

export class DeepScreeningEngine {
  constructor() {
    // 初始化三元向量
    this.qi = { 厚载: 0, 萌动: 0, 炎明: 0, 润下: 0, 肃降: 0, 刚健: 0, 通透: 0, 静守: 0 };
    this.lumin = { 如是: 0, 破暗: 0, 涓流: 0, 映照: 0, 无垠: 0 };
    this.rhythm = { 显化: 0, 涵育: 0, 敛藏: 0, 归元: 0, 止观: 0 };
    this.currentId = null;
    this.questionMap = null;
    this.answerHistory = []; // ✅ 使用 answerHistory 替代 answerCount（更准确）
    this.completed = false;

    // ✅ 定义最小筛查题数
    this.MIN_QUESTIONS = 42;
  }

  // ✅ 支持传入题库 URL（推荐），默认回退到 './data/DQ420.json'
  async loadQuestionBank(url = './data/DQ420.json') {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`题库加载失败：${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      const { metadata, ...questions } = data;
      this.questionMap = questions;
      if (!this.currentId || !this.questionMap[this.currentId]) {
        this.currentId = Object.keys(this.questionMap)[0];
      }
    } catch (err) {
      console.error('❌ DeepScreeningEngine.loadQuestionBank 错误:', err);
      throw err;
    }
  }

  getCurrentQuestion() {
    return this.questionMap?.[this.currentId] || null;
  }

  // ✅ 增强版 submitAnswer：含最小题数守卫 + 智能兜底
  submitAnswer(optionIndex) {
    const q = this.getCurrentQuestion();
    if (!q || optionIndex == null || !q.options[optionIndex]) return;

    // 记录答案历史
    this.answerHistory.push({ id: this.currentId, option: optionIndex });

    // 应用效果
    const effects = q.options[optionIndex].effects || {};
    this.applyEffects(this.qi, effects.qi);
    this.applyEffects(this.lumin, effects.lumin);
    this.applyEffects(this.rhythm, effects.rhythm);

    // ✅ 兼容 next_map 的数组或对象格式
    let nextId;
    if (Array.isArray(q.next_map)) {
      nextId = q.next_map[optionIndex];
    } else if (q.next_map && typeof q.next_map === 'object') {
      nextId = q.next_map[String(optionIndex)];
    } else {
      nextId = null;
    }

    // ✅ 核心逻辑：是否真正结束？
    if (nextId === 'END' || !nextId || !this.questionMap[nextId]) {
      // 尝试兜底跳转（若未达最小题数）
      if (this.answerHistory.length < this.MIN_QUESTIONS) {
        const fallbackId = this.findFallbackQuestion(q);
        if (fallbackId && this.questionMap[fallbackId]) {
          this.currentId = fallbackId;
          return;
        }
        // 最终兜底：按 ID 顺序走（确保不卡死）
        const allIds = Object.keys(this.questionMap).sort();
        const currentIndex = allIds.indexOf(this.currentId);
        if (currentIndex !== -1 && currentIndex + 1 < allIds.length) {
          this.currentId = allIds[currentIndex + 1];
          return;
        }
      }
      // 真正结束
      this.completed = true;
    } else {
      this.currentId = nextId;
    }
  }

  // ✅ 智能兜底跳转：基于 stage 动态选择有效题（永不返回无效 ID）
  findFallbackQuestion(currentQuestion) {
    const stage = currentQuestion.stage || 1;
    const dominantQi = this.getDominantKey(this.qi);
    const dominantLumin = this.getDominantKey(this.lumin);

    // ✅ 获取所有有效题 ID
    const allIds = Object.keys(this.questionMap || {});
    if (allIds.length === 0) return null;

    // 定义候选池（确保 ID 存在）
    const candidates = allIds.filter(id => {
      const q = this.questionMap[id];
      return q && q.stage === stage;
    });

    if (candidates.length > 0) {
      // 按主导特征排序（示例：优先静守/厚载）
      const priority = ['静守', '厚载', '归元', '涵育'];
      const sorted = candidates.sort((a, b) => {
        const qa = this.questionMap[a];
        const qb = this.questionMap[b];
        // 简化：选靠前的题
        return a.localeCompare(b);
      });
      return sorted[0];
    }

    // 最终 fallback：任选一题
    return allIds[Math.min(this.answerHistory.length, allIds.length - 1)];
  }

  // 辅助：获取对象中值最大的 key
  getDominantKey(obj) {
    let maxKey = '';
    let maxValue = -Infinity;
    for (const [key, value] of Object.entries(obj)) {
      if (value > maxValue) {
        maxValue = value;
        maxKey = key;
      }
    }
    return maxKey;
  }

  applyEffects(target, source) {
    if (!source) return;
    for (const [key, value] of Object.entries(source)) {
      target[key] = (target[key] || 0) + value;
    }
  }

  isCompleted() {
    return this.completed || this.answerHistory.length >= 60; // 保留原上限
  }

  getNormalizedResult() {
    const normalize = (obj) => {
      const values = Object.values(obj);
      const max = Math.max(...values, 0.1);
      const result = {};
      for (const key in obj) {
        result[key] = Math.round((obj[key] / max) * 100);
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
