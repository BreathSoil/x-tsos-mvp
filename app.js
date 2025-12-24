// app.js —— X-TSOS Web 主入口（适配 GitHub + Vercel 结构）
import { DeepScreeningEngine } from './src/engine/DeepScreeningEngine.js';
import { generateGuidanceFromResult } from './src/guidance/GuidanceEngine.js';

let engine = null;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

async function startTest() {
  engine = new DeepScreeningEngine();
  try {
    await engine.loadQuestionBank('./data/DQ420.json'); // ✅ 新路径
    renderQuestion();
    showScreen('quiz');
  } catch (err) {
    console.error('题库加载失败:', err);
    alert('题库加载失败，请刷新重试');
  }
}

function renderQuestion() {
  const q = engine.getCurrentQuestion();
  if (!q) {
    finishTest();
    return;
  }

  document.getElementById('question-text').textContent = q.text;
  const optionsDiv = document.getElementById('options');
  optionsDiv.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.textContent = opt;
    btn.onclick = () => submitAnswer(idx);
    optionsDiv.appendChild(btn);
  });

  document.getElementById('back-btn').disabled = !engine.canGoBack();
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
  if (engine.goBack()) {
    renderQuestion();
  }
}

async function finishTest() {
  const result = engine.getNormalizedResult();
  window.xtsosResult = result;

  // 生成行为指引（本地规则）
  const guidance = generateGuidanceFromResult(result, { maxCount: 3 });

  let html = `<div class="result-item"><strong>主导节奏：</strong>${result.rhythm}</div>`;
  html += `<div class="result-item"><strong>八炁玄基（Qi）：</strong></div>`;
  Object.entries(result.qi).forEach(([k, v]) => {
    html += `<div>• ${k}: ${(v * 100).toFixed(1)}%</div>`;
  });
  html += `<div class="result-item"><strong>五觉光轮（Lumin）：</strong></div>`;
  Object.entries(result.lumin).forEach(([k, v]) => {
    html += `<div>• ${k}: ${(v * 100).toFixed(1)}%</div>`;
  });
  html += `<div class="result-item"><strong>行为指引：</strong></div>`;
  html += `<div class="guidance-list">`;
  guidance.suggestions.forEach(s => {
    html += `<div class="guidance-item">→ ${s.forward}`;
    if (s.reverse) {
      html += `<div class="reverse-hint">（若不适：${s.reverse}）</div>`;
    }
    html += `</div>`;
  });
  html += `</div>`;

  document.getElementById('result-content').innerHTML = html;
  showScreen('result');
}

async function showYearbook() {
  const result = window.xtsosResult;
  try {
    const res = await fetch('/api/yearbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    document.getElementById('yearbook-content').textContent = data.yearbook;
    showScreen('yearbook');
  } catch (err) {
    console.error('年鉴生成失败:', err);
    alert('年鉴生成失败：' + err.message);
  }
}

function showResult() {
  showScreen('result');
}

function restart() {
  showScreen('welcome');
}
