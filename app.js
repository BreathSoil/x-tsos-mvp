// app.js —— X-TSOS Web 版核心逻辑（含伦理熔断系统）
import { DeepScreeningEngine } from './src/engine/DeepScreeningEngine.js';
import { generateGuidanceFromResult } from './src/guidance/GuidanceEngine.js';
import {
  detectShields,
  computeBreathFromQiAndLumin,
  canReleaseShield
} from './src/engine/ShieldDetector.js';

let engine = null;
let currentShield = null; // 当前激活的熔断类型

// ========== UI 控制函数 ==========
function showDynamicContent() {
  document.querySelector('.compass-section').style.display = 'none';
  document.querySelector('.modules-section').style.display = 'none';
  document.getElementById('dynamic-content').style.display = 'block';
}

function showHomePage() {
  // 仅当无熔断或已解除时允许返回首页
  if (currentShield) {
    alert('请先完成当前指引任务');
    return;
  }
  document.querySelector('.compass-section').style.display = 'block';
  document.querySelector('.modules-section').style.display = 'flex';
  document.getElementById('dynamic-content').style.display = 'none';
  currentShield = null;
}

function setInputBarVisible(visible) {
  document.querySelector('.input-bar').style.display = visible ? 'block' : 'none';
}

// ========== 熔断干预界面渲染 ==========
function showShieldIntervention(shieldId, breath) {
  const shieldNames = {
    Shield_1: '赤足归地',
    Shield_2: '模式日记',
    Shield_3: '边界呼吸',
    Shield_4: '存在锚定'
  };

  const instructions = {
    Shield_1: `
      <p>你正经历<strong>灵性逃避</strong>倾向：抽象思维过强，身体感知减弱。</p>
      <p>请完成以下任意两项接地练习：</p>
      <ol>
        <li>写下此刻你身体感受到的三种触觉（如：脚踩地板、风吹皮肤）</li>
        <li>记录一件今天已完成的小事</li>
        <li>澄清一个当前真实需求（非愿望）</li>
      </ol>
    `,
    Shield_2: `
      <p>你可能陷入<strong>模式盲区</strong>：用熟悉解释代替真实看见。</p>
      <p>请完成填空：</p>
      <blockquote style="margin: 1rem 0; padding: 0.8rem; background: var(--bg-card); border-left: 3px solid var(--gold-medium);">
        “我用 ______ 合理化了 ______。”
      </blockquote>
    `,
    Shield_3: `
      <p>你处于<strong>共情过载</strong>状态：他人情绪淹没自我边界。</p>
      <p>请：</p>
      <ol>
        <li>设定一条今日人际边界（如：“我不回应非紧急消息”）</li>
        <li>默念三次：“我在 / 我有权”</li>
      </ol>
    `,
    Shield_4: `
      <p>你正滑向<strong>存在虚无</strong>：高抽象 + 低能量 + 无现实锚点。</p>
      <p>请完成：</p>
      <ol>
        <li>触摸一件实体物品，默念“我在”</li>
        <li>列出两件今天已完成的具体小事</li>
      </ol>
      <p style="color: var(--gold-deep); font-size: 0.9rem;">⚠️ 禁用词：宇宙 / 维度 / 觉醒 / 高维</p>
    `
  };

  const container = document.getElementById('quiz-container');
  container.innerHTML = `
    <div class="module-card" style="min-height: 420px; display: flex; flex-direction: column;">
      <div class="module-title">🛡️ 伦理熔断：${shieldNames[shieldId]}</div>
      <div style="margin: 1.2rem 0; line-height: 1.6;">${instructions[shieldId]}</div>
      
      <!-- 动态输入区域 -->
      <div id="shield-input-area" style="margin: 1.2rem 0;"></div>

      <button class="send-button" style="margin-top: 1rem;" onclick="window.submitShieldTask('${shieldId}')">
        提交并尝试恢复
      </button>
    </div>
  `;

  // 渲染输入控件
  const inputArea = document.getElementById('shield-input-area');
  if (shieldId === 'Shield_1' || shieldId === 'Shield_4') {
    inputArea.innerHTML = `
      <textarea id="shield-text" rows="4" placeholder="请输入你的回答（每项一行）" 
                style="width: 100%; padding: 0.8rem; border: 1px solid var(--border-color); border-radius: var(--radius-md);"></textarea>
    `;
  } else if (shieldId === 'Shield_2') {
    inputArea.innerHTML = `
      <input type="text" id="shield-text" placeholder="我用 ______ 合理化了 ______。" 
             style="width: 100%; padding: 0.8rem; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
    `;
  } else if (shieldId === 'Shield_3') {
    inputArea.innerHTML = `
      <label><input type="checkbox" id="shield-checkbox"> 我已设定边界并默念“我在 / 我有权”</label>
    `;
  }

  showDynamicContent();
  setInputBarVisible(false);
  currentShield = shieldId;
}

// ========== 提交熔断任务（✅ 启用真实验证） ==========
window.submitShieldTask = function(shieldId) {
  const breath = window.xtsosBreath; // 在 finishTest 中已保存
  if (!breath) {
    alert('系统状态异常，请刷新页面重试');
    return;
  }

  let userActions = {};

  if (shieldId === 'Shield_1' || shieldId === 'Shield_4') {
    const text = document.getElementById('shield-text')?.value.trim() || '';
    const answers = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    if (shieldId === 'Shield_1') {
      userActions.groundingAnswers = answers;
    }
    if (shieldId === 'Shield_4') {
      userActions.concreteActions = answers;
    }
  } else if (shieldId === 'Shield_2') {
    userActions.patternStatement = document.getElementById('shield-text')?.value.trim() || '';
  } else if (shieldId === 'Shield_3') {
    userActions.boundarySet = !!document.getElementById('shield-checkbox')?.checked;
  }

  // ✅ 调用 ShieldDetector 的验证逻辑
  const canRelease = canReleaseShield(shieldId, breath, userActions);

  if (canRelease) {
    currentShield = null;
    alert('熔断已解除，正在恢复...');
    finishTest(); // 重新进入结果页（此时应无熔断）
  } else {
    alert('尚未满足恢复条件，请按指引完成任务');
  }
};

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
  if (currentShield) {
    alert('请先完成熔断指引任务');
    return;
  }
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

// ========== 完成测试并显示结果（含熔断检测）==========
function finishTest() {
  // 若当前处于熔断干预中，不重复触发
  if (currentShield && document.getElementById('shield-input-area')) {
    return;
  }

  const result = engine.getNormalizedResult();
  window.xtsosResult = result;

  // === 新增：熔断检测 ===
  const qi = Object.values(result.qi); // [Q0~Q7]
  const lumin = result.lumin;         // {视,听,触,味,嗅}
  const breath = computeBreathFromQiAndLumin(qi, lumin);
  window.xtsosBreath = breath;        // 供 submitShieldTask 使用

  const shields = detectShields(breath, qi);
  if (shields.length > 0) {
    // 按优先级取首项（Shield_1 > Shield_4 > Shield_2 > Shield_3）
    const priorityOrder = ['Shield_1', 'Shield_4', 'Shield_2', 'Shield_3'];
    const activeShield = priorityOrder.find(s => shields.includes(s)) || shields[0];
    showShieldIntervention(activeShield, breath);
    return; // ⚠️ 拦截结果页
  }

  // === 无熔断：正常显示结果 ===
  const guidance = generateGuidanceFromResult(result, { maxCount: 3 });

  let html = `<div class="module-card" style="min-height: 420px; display: flex; flex-direction: column;">`;
  html += `<div class="module-title">三元状态解析</div>`;
  
  html += `<div style="margin: 1.2rem 0;"><strong>主导节奏：</strong><span style="color: var(--gold-deep);">${result.rhythm}</span></div>`;
  
  html += `<div style="margin: 1.2rem 0;"><strong>八炁玄基（Qi）：</strong></div>`;
  Object.entries(result.qi).forEach(([k, v]) => {
    html += `<div style="margin: 0.4rem 0;">• ${k}: ${(v * 100).toFixed(1)}%</div>`;
  });
  
  html += `<div style="margin: 1.2rem 0;"><strong>五觉光轮（Lumin）：</strong></div>`;
  Object.entries(result.lumin).forEach(([k, v]) => {
    html += `<div style="margin: 0.4rem 0;">• ${k}: ${(v * 100).toFixed(1)}%</div>`;
  });
  
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

// ========== 全局函数绑定 ==========
window.startTest = startTest;
window.submitAnswer = submitAnswer;
window.goBack = goBack;
window.showHomePage = showHomePage;
window.showYearbook = showYearbook;
window.submitShieldTask = window.submitShieldTask;

// ========== 启动入口 ==========
document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.module-card');
  if (cards[0]) {
    cards[0].onclick = startTest;
  }
  if (cards[4]) {
    cards[4].onclick = () => {
      if (window.xtsosResult) {
        showYearbook();
      } else {
        alert('请先完成“观象入微”深度筛查');
      }
    };
  }

  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
  }
});

// ========== 核心交互逻辑 ==========
async function startTest() {
  // 重置熔断状态
  currentShield = null;
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
