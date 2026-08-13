// 每日定时提醒调度（自包含，无第三方依赖）
// 每天 8:00 与 20:00 触发一次「未归还工单提醒」微信订阅消息推送。
//
// 实现说明：
//   - 不引入 node-cron，避免新增依赖与沙箱安装风险。
//   - 用 setTimeout 递归计算"下一次目标时刻"并触发，每次触发后重新计算，天然规避进程跨时区/DST 误差。
//   - 目标时刻列表可配置（默认 [8, 20]）。

const { pushAllReturnReminders } = require('./wechatNotify');

const TARGET_HOURS = (process.env.REMIND_HOURS || '8,20')
  .split(',')
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => Number.isInteger(n) && n >= 0 && n <= 23)
  .sort((a, b) => a - b);

let timer = null;
let running = false;

/** 计算下一次触发时刻（相对当前） */
function nextFireDate(from = new Date()) {
  const candidates = [];
  for (const h of TARGET_HOURS) {
    const d = new Date(from);
    d.setHours(h, 0, 0, 0);
    if (d > from) candidates.push(d);
  }
  if (candidates.length === 0) {
    // 今天的都已过，取明天第一个目标时刻
    const d = new Date(from);
    d.setDate(d.getDate() + 1);
    d.setHours(TARGET_HOURS[0], 0, 0, 0);
    return d;
  }
  return candidates[0];
}

async function fire() {
  if (running) return; // 防重入
  running = true;
  try {
    console.log(`[Scheduler] 触发未归还提醒推送 @ ${new Date().toLocaleString()}`);
    const summary = await pushAllReturnReminders();
    console.log('[Scheduler] 推送汇总:', JSON.stringify({ scanned: summary.scanned, totalSent: summary.totalSent }));
  } catch (err) {
    console.error('[Scheduler] 推送异常:', err.message);
  } finally {
    running = false;
  }
}

function scheduleNext() {
  const now = new Date();
  const next = nextFireDate(now);
  const delay = next - now;
  console.log(`[Scheduler] 下次提醒推送计划于 ${next.toLocaleString()}（${Math.round(delay / 1000)}s 后）`);
  timer = setTimeout(async () => {
    await fire();
    scheduleNext(); // 递归安排下一轮
  }, delay);
}

/** 启动调度器 */
function startScheduler() {
  if (!TARGET_HOURS.length) {
    console.warn('[Scheduler] REMIND_HOURS 为空，定时提醒未启用');
    return;
  }
  console.log(`[Scheduler] 已启用，目标时刻(小时): [${TARGET_HOURS.join(', ')}]`);
  scheduleNext();
}

/** 停止调度器（用于优雅退出，可选） */
function stopScheduler() {
  if (timer) clearTimeout(timer);
  timer = null;
}

/** 手动立即触发一次（供测试 / 管理接口调用） */
async function runNow() {
  return fire();
}

module.exports = { startScheduler, stopScheduler, runNow, nextFireDate };
