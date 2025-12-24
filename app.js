// app.js —— X-TSOS Web 版核心逻辑
import { DeepScreeningEngine } from './src/engine/DeepScreeningEngine.js';
import { generateGuidanceFromResult } from './src/guidance/GuidanceEngine.js';

let engine = null;

// ========== UI 控制函数 ==========
function showDynamicContent() {
  document.querySelector('.compass-section').style.display = 'none';
  document.querySelector('.modules-section').style.display = 'none';
  document.getElementById('dynamic-content').style.display = 'block';
}

function showHomePage() {
  document.querySelector('.compass-section').style.display = 'block';
  document.querySelector('.modules-section').style.display = 'flex';
  document.getElementById('dynamic-content').style.display = 'none';
}

function setInputBarVisible(visible) {
  document.querySelector('.input-bar').style.display = visible ? 'block' : 'none';
}

// ========== 渲染题目 ==========
function renderQuestion() {
  const q = engine.getCurrentQuestion();
  if (!q) {
    finishTest();
    return;
  }

  const container = document.getElementById('quiz-container');
  container.innerHTML = `
    <div class="module-card" style="height: auto; min-height: 320px; display: flex; flex-direction: column;">
      <div class="module-title">${q.text}</div>
      <div class="options-grid" style="margin-top: 1.5rem; display: grid; gap: 0.9rem;">
        ${q.options.map((opt, idx) => `
          <button class="send-button" style="width: 100%; padding: 0.9rem; font-size: 1.05rem;"
                  onclick="window.submitAnswer(${idx})">${opt}</button>
        `).join('')}
      </div>
      <button class="back-btn" style="
        margin-top: 1.2rem; background: transparent; color: var(--gold-deep); border: 1px solid var(--gold-medium);
        box-shadow: none; width: fit-content; align-self: flex-start; font-family: 'Noto Serif SC', serif;
        border-radius: var(--radius-md); padding: 0.6rem 1rem;
      " onclick="window.goBack()" ${engine.canGoBack() ? '' : 'disabled'}>↩ 上一题</button>
    </div>
  `;
  showDynamicContent();
  setInputBarVisible(false);
}

// ========== 渲染年鉴 ==========
async function showYearbook() {
  if (!window.xtsosResult) {
    alert('请先完成深度筛查');
    return;
  }

  try {
    const response = await fetch('/api/yearbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: window.xtsosResult })
    });

    if (!response.ok) throw new Error('年鉴生成失败');

    const data = await response.json();
    document.getElementById('yearbook-text').textContent = data.yearbook || '暂无年鉴内容';

    // 显示年鉴区域
    document.getElementById('quiz-container').style.display = 'none';
    document.getElementById('result-container').style.display = 'none';
    document.getElementById('yearbook-container').style.display = 'block';
    showDynamicContent();
    setInputBarVisible(false);
  } catch (err) {
    console.error('年鉴加载错误:', err);
    alert('年鉴生成异常，请稍后重试');
  }
}

// ========== 完成测试并显示结果 ==========
function finishTest() {
  const result = engine.getNormalizedResult();
  window.xtsosResult = result;
  const guidance = generateGuidanceFromResult(result, { maxCount: 3 });

  let html = `<div class="module-card" style="min-height: 420px; display: flex; flex-direction: column;">`;
  html += `<div class="module-title">三元状态解析</div>`;
  
  // Rhythm
  html += `<div style="margin: 1.2rem 0;"><strong>主导节奏：</strong><span style="color: var(--gold-deep);">${result.rhythm}</span></div>`;
  
  // Qi
  html += `<div style="margin: 1.2rem 0;"><strong>八炁玄基（Qi）：</strong></div>`;
  Object.entries(result.qi).forEach(([k, v]) => {
    html += `<div style="margin: 0.4rem 0;">• ${k}: ${(v * 100).toFixed(1)}%</div>`;
  });
  
  // Lumin
  html += `<div style="margin: 1.2rem 0;"><strong>五觉光轮（Lumin）：</strong></div>`;
  Object.entries(result.lumin).forEach(([k, v]) => {
    html += `<div style="margin: 0.4rem 0;">• ${k}: ${(v * 100).toFixed(1)}%</div>`;
  });
  
  // Guidance
  html += `<div style="margin: 1.5rem 0;"><strong>行为指引：</strong></div>`;
  guidance.suggestions.forEach(s => {
    html += `<div style="margin: 0.8rem 0; line-height: 1.6;">→ ${s.forward}`;
    if (s.reverse) html += `<div style="font-size: 0.88rem; color: var(--color-text-secondary); margin-top: 0.3rem;">（若不适：${s.reverse}）</div>`;
    html += `</div>`;
  });

  html += `
    <div style="margin-top: 1.5rem; display: flex; gap: 0.8rem;">
      <button class="send-button" style="flex: 1;" onclick="window.showHomePage()">返回首页</button>
      <button class="send-button" style="flex: 1; background: var(--gold-gradient-secondary);" 
              onclick="window.showYearbook()">生成年鉴</button>
    </div>
  </div>`;

  document.getElementById('result-container').innerHTML = html;
  document.getElementById('quiz-container').style.display = 'none';
  document.getElementById('result-container').style.display = 'block';
  document.getElementById('yearbook-container').style.display = 'none';
  showDynamicContent();
  setInputBarVisible(false);
}

// ========== 全局函数绑定（供 HTML 调用）==========
window.startTest = startTest;
window.submitAnswer = submitAnswer;
window.goBack = goBack;
window.showHomePage = showHomePage;
window.showYearbook = showYearbook;

// ========== 启动入口 ==========
document.addEventListener('DOMContentLoaded', () => {
  // 绑定“观象入微”为开始测试
  const cards = document.querySelectorAll('.module-card');
  if (cards[0]) {
    cards[0].onclick = startTest;
  }
  // “三元年鉴”卡片点击触发年鉴（如有结果）
  if (cards[4]) {
    cards[4].onclick = () => {
      if (window.xtsosResult) {
        showYearbook();
      } else {
        alert('请先完成“观象入微”深度筛查');
      }
    };
  }

  // 初始化主题（与原 HTML 逻辑一致，避免冲突）
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
  }
});

// ========== 核心交互逻辑 ==========
async function startTest() {
  engine = new DeepScreeningEngine();
  try {
    await engine.loadQuestionBank('./data/DQ420.json');
    renderQuestion();
  } catch (err) {
    console.error('题库加载失败:', err);
    alert('初始化失败，请检查网络或刷新页面');
  }
}

function submitAnswer(optionIndex) {
  engine.submitAnswer(optionIndex);
  if (engine.isCompleted()) {
    finishTest();
  } else {
    renderQuestion();
  }
}

function goBack() {
  if (engine && engine.canGoBack()) {
    engine.goBack();
    renderQuestion();
  }
}
