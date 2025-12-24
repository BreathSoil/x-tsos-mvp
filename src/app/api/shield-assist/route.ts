// src/app/api/shield-assist/route.ts

/**
 * X-TSOS 熔断辅助引导 API
 * 
 * 输入激活的 Shield ID 与状态上下文，
 * 输出符合伦理的质性引导语与接地任务。
 * 
 * 原则：
 * - 无评判、非指令、支持如是
 * - 在“藏/伏”阶段自动静默
 * - 所有输出通过伦理熔断校验
 */

import { NextRequest } from 'next/server';

// === 常量定义 ===
const GUIDANCE_TEMPLATES: Record<string, { message: string; task: string }> = {
  Shield_1: {
    message: "你正处在「灵性逃避」状态。真正的灵性不在高处，而在你此刻脚下的土地里。",
    task: "赤脚站立 2 分钟，感受大地支撑"
  },
  Shield_2: {
    message: "你正处在「模式盲区」状态。邀请你以观察者身份，写下最近一次重复出现的关系动态。",
    task: "手写 100 字，不分析，只描述事实"
  },
  Shield_3: {
    message: "你正处在「边界耗竭」状态。此刻，允许自己说‘不’，哪怕只是心里默念一次。",
    task: "设定一个微小但清晰的边界（如：今天不回工作消息）"
  },
  Shield_4: {
    message: "你正处在「意义虚无」状态。意义不在远方，就在此刻你手中的事里。",
    task: "专注完成一件小事（如泡一杯茶、整理桌面）"
  }
};

const SILENT_PHASES = ['藏', '伏'];

// === 五息节律计算（与 ShieldDetector.js 一致）===
function getCurrentBreathPhase(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // JS 月份从 0 开始

  // 简化版五息律环（实际可替换为更复杂算法）
  if (month >= 3 && month <= 5) return '生';
  if (month >= 6 && month <= 8) return '长';
  if (month >= 9 && month <= 10) return '收';
  if (month === 11 || month === 12 || month === 1) return '藏';
  return '伏';
}

// === API Handler ===

export const runtime = 'edge';
export const preferredRegion = 'home';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shieldId, breathPhase: clientPhase } = body;

    // 校验 shieldId
    if (!shieldId || !GUIDANCE_TEMPLATES[shieldId]) {
      return new Response(JSON.stringify({ error: '无效的 shieldId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 使用服务端计算的节律（防止客户端伪造）
    const serverPhase = getCurrentBreathPhase();

    // 【伦理熔断】：藏/伏阶段禁止主动引导
    if (SILENT_PHASES.includes(serverPhase)) {
      return new Response(JSON.stringify({
        message: "此刻宜静守，不宜引导。",
        groundingTask: "保持呼吸，不做任何改变"
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const base = GUIDANCE_TEMPLATES[shieldId];

    return new Response(JSON.stringify({
      message: base.message,
      groundingTask: base.task
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (err: any) {
    console.error('shield-assist API 错误:', err.message);
    // 安全降级
    return new Response(JSON.stringify({
      message: "回到呼吸，感受此刻的存在。",
      groundingTask: "深呼吸三次"
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
