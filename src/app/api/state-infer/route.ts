// src/app/api/state-infer/route.ts

/**
 * X-TSOS 三元状态推理 API（服务端增强）
 * 
 * 接收用户答案，返回结构化三元状态：
 * - 八炁玄基（qi）
 * - 五觉光轮（lumin）
 * - 五息律环（breathPhase）
 * 
 * 特性：
 * - 不存储、不记录、不追踪任何用户数据
 * - 复用与前端完全一致的本地推理规则
 * - 自动对齐当前五息节律
 * - 支持 Edge Runtime 部署
 */

import { NextRequest } from 'next/server';
import { getCurrentBreathPhase } from '@/engine/ShieldDetector';

// === 常量定义（与前端 TriadicStateInferencer.js 严格一致）===
const QI_NAMES = [
  '厚载', '萌动', '炎明', '肃降',
  '通透', '刚健', '静守', '润下'
];

const LUMIN_WHEELS = [
  '如是轮', '破暗轮', '涓流轮', '映照轮', '无垠轮'
];

// === 本地推理函数（内联，避免模块循环依赖）===

function inferQiLocally(answers: Record<string, any>, questions: any[]): Record<string, string> {
  const qiScores: Record<string, { total: number; weight: number }> = {};
  for (const name of QI_NAMES) {
    qiScores[name] = { total: 0, weight: 0 };
  }

  for (const [qid, answer] of Object.entries(answers)) {
    const q = questions.find((q: any) => q.id === qid);
    if (!q || !q.qiAffinity) continue;

    let activation = 0;
    if (q.type === 'scale') {
      const val = Number(answer);
      if (!isNaN(val)) {
        activation = Math.min(1, Math.max(0, val / 3));
      }
    } else if (q.type === 'single' && Array.isArray(q.options)) {
      const idx = q.options.indexOf(answer);
      if (idx >= 0) {
        activation = idx / (q.options.length - 1 || 1);
      }
    } else {
      activation = 0.5;
    }

    for (const qi of q.qiAffinity) {
      if (QI_NAMES.includes(qi)) {
        qiScores[qi].total += activation;
        qiScores[qi].weight += 1;
      }
    }
  }

  const qiStates: Record<string, string> = {};
  for (const name of QI_NAMES) {
    const avg = qiScores[name].weight > 0 ? qiScores[name].total / qiScores[name].weight : 0;
    qiStates[name] = mapActivationToQiState(avg, name);
  }
  return qiStates;
}

function mapActivationToQiState(avg: number, qiName: string): string {
  const isStableQi = ['厚载', '静守', '刚健'];
  const isFlowQi = ['萌动', '炎明', '润下', '通透'];
  const isReleaseQi = ['肃降'];

  if (avg >= 0.8) {
    if (isStableQi.includes(qiName)) return '稳固';
    if (isFlowQi.includes(qiName)) return '涌动';
    if (isReleaseQi.includes(qiName)) return '收敛';
  } else if (avg >= 0.6) {
    if (isStableQi.includes(qiName)) return '平衡';
    if (isFlowQi.includes(qiName)) return '萌芽';
    if (isReleaseQi.includes(qiName)) return '有序';
  } else if (avg >= 0.3) {
    return '平衡';
  } else if (avg >= 0.1) {
    if (isStableQi.includes(qiName)) return '动摇';
    if (isFlowQi.includes(qiName)) return '阻滞';
    if (isReleaseQi.includes(qiName)) return '紊乱';
  } else {
    if (isStableQi.includes(qiName)) return '虚弱';
    if (isFlowQi.includes(qiName)) return '冻结';
    if (isReleaseQi.includes(qiName)) return '耗散';
  }
  return '失衡';
}

function inferLuminLocally(answers: Record<string, any>, questions: any[]): Record<string, string> {
  const luminStates: Record<string, string> = {};

  for (const wheel of LUMIN_WHEELS) {
    const relevantQuestions = questions.filter((q: any) => q.luminWheel === wheel);
    const answered = relevantQuestions.filter((q: any) => answers.hasOwnProperty(q.id));

    if (answered.length === 0) {
      luminStates[wheel] = '未亮';
      continue;
    }

    let hasDeepInsight = false;
    let hasAvoidance = false;

    for (const q of answered) {
      const ans = answers[q.id];
      if (q.type === 'scale') {
        const val = Number(ans);
        if (val >= 2) hasDeepInsight = true;
        if (val <= 1) hasAvoidance = true;
      } else if (typeof ans === 'string') {
        if (ans.includes('逃避') || ans.includes('否认')) hasAvoidance = true;
        if (ans.includes('看见') || ans.includes('接纳') || ans.includes('转化')) hasDeepInsight = true;
      }
    }

    if (hasDeepInsight && !hasAvoidance) {
      luminStates[wheel] = '明亮';
    } else if (hasDeepInsight && hasAvoidance) {
      luminStates[wheel] = '闪烁';
    } else if (hasAvoidance) {
      luminStates[wheel] = '遮蔽';
    } else {
      luminStates[wheel] = '微光';
    }
  }

  return luminStates;
}

// === API Handler ===

export const runtime = 'edge';
export const preferredRegion = 'home'; // Vercel Edge 最近节点

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { answers } = body;

    if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
      return new Response(JSON.stringify({ error: '缺少有效的 answers 字段' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取题库（必须为 public 下静态资源）
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const bankUrl = `${siteUrl}/data/DQ420.json`;

    const bankRes = await fetch(bankUrl, { next: { revalidate: 3600 } }); // 缓存 1 小时
    if (!bankRes.ok) {
      console.error(`题库加载失败: ${bankRes.status} ${bankRes.statusText}`);
      return new Response(JSON.stringify({ error: '题库不可用' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const bankData = await bankRes.json();
    if (!Array.isArray(bankData.questions)) {
      throw new Error('题库格式无效');
    }

    const questions = bankData.questions;

    // 执行推理
    const qi = inferQiLocally(answers, questions);
    const lumin = inferLuminLocally(answers, questions);
    const breathPhase = getCurrentBreathPhase();

    return new Response(JSON.stringify({
      qi,
      lumin,
      breathPhase
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store' // 禁止缓存用户相关响应
      }
    });

  } catch (err: any) {
    console.error('state-infer API 错误:', err.message);
    return new Response(JSON.stringify({ error: '内部推理失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
