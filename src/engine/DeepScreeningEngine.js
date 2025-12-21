// src/engine/DeepScreeningEngine.js

export class DeepScreeningEngine {
  constructor() {
    // 初始化三元向量
    this.qi = {
      厚载: 0, 萌动: 0, 炎明: 0, 润下: 0,
      肃降: 0, 刚健: 0, 通透: 0, 静守: 0
    };
    this.lumin = {
      如是: 0, 破暗: 0, 涓流: 0, 映照: 0, 无垠: 0
    };
    this.rhythm = {
      显化: 0, 涵育: 0, 敛藏: 0, 归元: 0, 止观: 0
    };

    this.currentId = null; // 不硬编码
    this.questionMap = null;
    this.answerCount = 0;
    this.completed = false;
  }

  // 加载问题库
  async loadQuestionBank() {
    const res = await fetch('/public/data/DQ420.json');
    if (!res.ok) throw new Error('题库加载失败：' + res.status);
    const data = await res.json();

    // 剥离 metadata，其余为题目
    const { metadata, ...questions } = data;
    this.questionMap = questions;

    // 设置起始题（优先用已有 currentId，否则取第一个）
    if (!this.currentId || !this.questionMap[this.currentId]) {
      this.currentId = Object.keys(this.questionMap)[0];
    }
  }

  // 获取当前问题
  getCurrentQuestion() {
    return this.questionMap?.[this.currentId] || null;
  }

  // 提交答案
  submitAnswer(optionIndex) {
    const q = this.getCurrentQuestion();
    if (!q || optionIndex == null || !q.options[optionIndex]) return;

    // 累加 effects
    const effects = q.options[optionIndex].effects || {};
    this.applyEffects(this.qi, effects.qi);
    this.applyEffects(this.lumin, effects.lumin);
    this.applyEffects(this.rhythm, effects.rhythm);

    this.answerCount++;

    // 跳转下一题
    const nextId = q.next_map?.[String(optionIndex)];
    if (nextId && this.questionMap[nextId]) {
      this.currentId = nextId;
    } else {
      this.completed = true;
    }
  }

  // 应用效果
  applyEffects(target, source) {
    if (!source) return;
    for (const [key, value] of Object.entries(source)) {
      target[key] = (target[key] || 0) + value;
    }
  }

  // 是否完成
  isCompleted() {
    return this.completed || this.answerCount >= 60;
  }

  // 获取归一化结果
  getNormalizedResult() {
    const normalize = (obj) => {
      const values = Object.values(obj);
      const max = Math.max(...values, 0.1); // 避免除以零
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
