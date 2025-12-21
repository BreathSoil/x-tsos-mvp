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

  // ✅ 智能兜底跳转：基于 stage / qi / lumin 特征
  findFallbackQuestion(currentQuestion) {
    const stage = currentQuestion.stage || 1;

    // 获取当前 Qi 和 Lumin 的主导维度
    const dominantQi = this.getDominantKey(this.qi);
    const dominantLumin = this.getDominantKey(this.lumin);

    // 根据阶段和主导特征选择兜底题
    const fallbackMap = {
      1: {
        // Stage 1: 聚焦基础能量模式
        刚健: 'T102',   // "你是否觉得‘独处’比‘社交’更消耗能量？"
        静守: 'T114',   // "你是否常在清晨冥想或静坐？"
        厚载: 'T157',   // "你是否常在自然中恢复能量？"
        萌动: 'T139',   // "你是否常在行走中获得灵感？"
        default: 'T120' // "你是否认为“休息不是懒惰”？"
      },
      2: {
        // Stage 2: 关系与情绪
        映照: 'T141',   // "你是否常因“过度共情”而疲惫？"
        如是: 'T102',
        破暗: 'T088',   // "你是否相信“梦是潜意识的语言”？"
        default: 'T128' // "你是否认为“边界感是爱的前提”？"
      },
      3: {
        // Stage 3: 存在与节奏
        归元: 'T193',   // "你是否常在冥想中获得清晰指引？"
        涵育: 'T168',   // "你是否相信“万物皆有其时”？"
        显化: 'T135',   // "你是否常在写作或绘画时进入心流？"
        default: 'T182' // "你是否相信“内在节奏比外部日程更重要”？"
      }
    };

    const stageMap = fallbackMap[stage] || fallbackMap[1];
    return stageMap[dominantQi] || stageMap[dominantLumin] || stageMap.default;
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
