// 微信订阅消息推送模块
// 职责：
//   1) 提供 getWxAccessToken()（自带缓存，与 auth.js 逻辑一致，互不干扰）
//   2) sendSubscribeMessage() 调用 cgi-bin/message/subscribe/send
//   3) pushClaimSuccess()   领用成功通知（原则3：领取物料/工具后推送）
//   4) pushReturnReminder()  未归还提醒（原则4：每天 8/20 定时调用）
//   5) pushAllReturnReminders() 扫描未归还工单，按"部门隔离"批量推送
//
// 重要约束（微信平台规则）：
//   订阅消息是「一次性」授权——用户必须先在客户端 wx.requestSubscribeMessage 点「允许」，
//   服务端才能向该 openid 推「一条」，推完即消耗。没有永久订阅。
//   因此每日 8/20 提醒能否送达，取决于用户近期是否重新授权（小程序 onLaunch / 领用 / 归还时会自动请求）。
//   发送失败时（如 errcode 43101 用户未授权）静默跳过，不影响主流程。

const https = require('https');
const { readDB } = require('../routes/db');

// ============ access_token 缓存 ============
let wxAccessToken = null;
let wxAccessTokenExpireAt = 0;

function getWxAccessToken() {
  return new Promise((resolve, reject) => {
    if (wxAccessToken && Date.now() < wxAccessTokenExpireAt) return resolve(wxAccessToken);
    const appid = process.env.WX_APPID;
    const secret = process.env.WX_SECRET;
    if (!appid || !secret) return reject(new Error('WX_APPID/WX_SECRET 未配置'));
    const url =
      `https://api.weixin.qq.com/cgi-bin/token` +
      `?grant_type=client_credential` +
      `&appid=${encodeURIComponent(appid)}` +
      `&secret=${encodeURIComponent(secret)}`;
    const req = https.get(url, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (data.errcode) return reject(new Error(`微信 token 获取失败 errcode=${data.errcode} ${data.errmsg || ''}`));
          wxAccessToken = data.access_token;
          wxAccessTokenExpireAt = Date.now() + (Number(data.expires_in) - 300) * 1000;
          resolve(wxAccessToken);
        } catch (err) {
          reject(new Error(`微信 token 接口返回非 JSON: ${raw.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('微信 token 接口请求超时')));
  });
}

// ============ 订阅消息发送 ============
/**
 * 发送一条订阅消息。
 * @param {Object} opts
 * @param {string} opts.touser     接收者 openid
 * @param {string} opts.templateId 订阅消息模板 ID
 * @param {Object} opts.data       模板字段，形如 { thing1: { value: 'xxx' }, ... }
 * @param {string} [opts.page]     点击消息跳转的小程序页面（如 'pages/orders/OrderDetail?id=123'）
 * @returns {Promise<{ok:boolean, errcode?:number, errmsg?:string}>}
 */
function sendSubscribeMessage({ touser, templateId, data, page }) {
  return new Promise(async (resolve) => {
    if (!touser) return resolve({ ok: false, errcode: -1, errmsg: 'touser(openid) 为空' });
    if (!templateId) return resolve({ ok: false, errcode: -1, errmsg: 'templateId 未配置' });
    let accessToken;
    try {
      accessToken = await getWxAccessToken();
    } catch (err) {
      console.error('[WxNotify] 获取 access_token 失败:', err.message);
      return resolve({ ok: false, errcode: -2, errmsg: err.message });
    }
    const body = JSON.stringify({
      touser,
      template_id: templateId,
      data,
      ...(page ? { page } : {})
    });
    const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(accessToken)}`;
    const req = https.request(
      url,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            if (data.errcode === 0) return resolve({ ok: true });
            // 43101=用户拒绝/未授权；47003=模板参数不正确；其他按失败处理
            console.warn(`[WxNotify] 发送失败 touser=${touser} errcode=${data.errcode} errmsg=${data.errmsg || ''}`);
            resolve({ ok: false, errcode: data.errcode, errmsg: data.errmsg || '' });
          } catch (err) {
            resolve({ ok: false, errcode: -3, errmsg: `微信返回非 JSON: ${raw.slice(0, 200)}` });
          }
        });
      }
    );
    req.on('error', (err) => resolve({ ok: false, errcode: -4, errmsg: err.message }));
    req.setTimeout(8000, () => req.destroy(new Error('微信订阅消息接口超时')));
    req.write(body);
    req.end();
  });
}

// ============ 模板字段映射（可配置，避免关键词顺序与写死不一致） ============
// 微信订阅消息的字段名（thing1 / character_string2 / time3 …）由你在公众平台创建模板时平台分配。
// 默认按推荐顺序：thing1=名称, character_string2=编号, time3=时间, thing4=备注。
// 若你的模板关键词顺序不同，设置环境变量（逗号分隔、顺序固定为：名称,编号,时间,备注）：
//   WX_TPL_CLAIM_KEYS=thing2,character_string1,time3,thing4
//   WX_TPL_REMIND_KEYS=thing1,character_string3,time2,thing4
// 不设置则用默认顺序。详见「我的」页消息提醒区 / 部署说明。
const TPL_CLAIM = process.env.WX_TPL_CLAIM || '';
const TPL_REMIND = process.env.WX_TPL_REMIND || '';
const DEFAULT_KEYS = ['thing1', 'character_string2', 'time3', 'thing4'];

function parseKeys(envVal) {
  if (!envVal) return DEFAULT_KEYS;
  const arr = envVal.split(',').map((s) => s.trim()).filter(Boolean);
  return arr.length === 4 ? arr : DEFAULT_KEYS;
}
const CLAIM_KEYS = parseKeys(process.env.WX_TPL_CLAIM_KEYS);
const REMIND_KEYS = parseKeys(process.env.WX_TPL_REMIND_KEYS);

function claimTemplateData(order, itemsSummary) {
  const [kName, kNo, kTime, kRemark] = CLAIM_KEYS;
  return {
    [kName]: { value: truncate(itemsSummary, 20) },             // 物品名称
    [kNo]: { value: truncate(order.order_no, 32) },             // 工单编号
    [kTime]: { value: formatWxTime(order.borrow_time) },        // 领取时间
    [kRemark]: { value: '领用成功，请按时归还' }                // 备注
  };
}

function remindTemplateData(order, itemsSummary, daysOut) {
  const [kName, kNo, kTime, kRemark] = REMIND_KEYS;
  return {
    [kName]: { value: truncate(itemsSummary, 20) },             // 借用物品
    [kNo]: { value: truncate(order.order_no, 32) },             // 工单编号
    [kTime]: { value: formatWxTime(order.borrow_time) },        // 借出时间
    [kRemark]: { value: daysOut > 0 ? `已借出 ${daysOut} 天，请尽快归还` : '该工单尚未归还，请及时处理' }
  };
}

// ============ 工单摘要 / 工具函数 ============
function orderItemsSummary(order) {
  const items = order.items || [];
  if (!items.length) return '工器具';
  const names = items.slice(0, 3).map((i) => i.tool_name || i.spare_name || '物品');
  let s = names.join('、');
  if (items.length > 3) s += ` 等${items.length}项`;
  return s;
}

function daysOutSince(borrowTime) {
  if (!borrowTime) return 0;
  const t = new Date(borrowTime).getTime();
  if (isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / (24 * 3600 * 1000)));
}

function formatWxTime(s) {
  if (!s) return '';
  // 微信 time 类型要求 YYYY-MM-DD HH:mm:ss
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s).slice(0, 19);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function truncate(str, max) {
  str = String(str || '');
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

// ============ 部门隔离的接收人解析 ============
// 返回该工单应收到「未归还提醒」的接收人列表（去重）：
//   - 借用人本人（必须有 wx_openid）
//   - 借用人所在部门的 team_leader / material_manager（"本部门负责人"，严格部门隔离，不含 admin 全局）
function resolveReminderRecipients(db, order) {
  const borrowers = db.users.filter((u) => u.user_id === order.borrower_id);
  const borrower = borrowers[0];
  const recipients = [];
  const seen = new Set();

  const pushUser = (u) => {
    if (!u || !u.wx_openid) return; // 无 openid 无法推送
    if (seen.has(u.wx_openid)) return;
    seen.add(u.wx_openid);
    recipients.push({ openid: u.wx_openid, user: u, isBorrower: u.user_id === order.borrower_id });
  };

  // 1) 借用人本人
  pushUser(borrower);

  // 2) 本部门负责人（team_leader / material_manager），严格按 dept_id 隔离
  const deptId = borrower ? borrower.dept_id : null;
  if (deptId != null) {
    db.users
      .filter((u) => u.dept_id === deptId && (u.role === 'team_leader' || u.role === 'material_manager'))
      .forEach(pushUser);
  }

  return recipients;
}

// ============ 对外推送函数 ============
/**
 * 领用成功通知（原则3）：领取物料/工具后推送。
 * 在后端 approve / claim 把工单置为 borrowed 后调用。
 * @param {Object} order 工单对象（需含 order_no / borrower_id / items / borrow_time）
 */
async function pushClaimSuccess(order) {
  const tpl = TPL_CLAIM;
  if (!tpl) {
    console.warn('[WxNotify] WX_TPL_CLAIM 未配置，跳过领用成功推送');
    return { ok: false, skipped: true };
  }
  const db = readDB();
  const borrower = db.users.find((u) => u.user_id === order.borrower_id);
  if (!borrower || !borrower.wx_openid) {
    console.warn(`[WxNotify] 借用人无 openid，跳过领用成功推送 order=${order.order_no}`);
    return { ok: false, skipped: true };
  }
  const data = claimTemplateData(order, orderItemsSummary(order));
  const res = await sendSubscribeMessage({
    touser: borrower.wx_openid,
    templateId: tpl,
    data,
    page: `pages/orders/OrderDetail?id=${order.order_id}`
  });
  console.log(`[WxNotify] 领用成功推送 order=${order.order_no} -> ${borrower.wx_openid} ok=${res.ok}`);
  return res;
}

/**
 * 未归还提醒（原则4）：推送给借用人 + 本部门负责人（部门隔离）。
 * @param {Object} order 工单对象
 * @returns {Promise<{order_no:string, sent:number, skipped:number, details:Array}>}
 */
async function pushReturnReminder(order) {
  const tpl = TPL_REMIND;
  if (!tpl) {
    return { order_no: order.order_no, sent: 0, skipped: 1, details: [{ error: 'WX_TPL_REMIND 未配置' }] };
  }
  const db = readDB();
  const recipients = resolveReminderRecipients(db, order);
  const daysOut = daysOutSince(order.borrow_time);
  const data = remindTemplateData(order, orderItemsSummary(order), daysOut);
  const details = [];
  let sent = 0;
  for (const r of recipients) {
    const res = await sendSubscribeMessage({
      touser: r.openid,
      templateId: tpl,
      data,
      page: `pages/orders/OrderDetail?id=${order.order_id}`
    });
    if (res.ok) sent++;
    details.push({ openid: r.openid, isBorrower: r.isBorrower, ok: res.ok, errcode: res.errcode });
  }
  return { order_no: order.order_no, sent, skipped: recipients.length - sent, details };
}

/**
 * 批量推送未归还提醒（供定时任务调用）。
 * 未归还 = 状态 borrowed / approved；跳过 guest(borrower_id=0) 与无借用人。
 * @returns {Promise<Object>} 汇总
 */
async function pushAllReturnReminders() {
  const db = readDB();
  const orders = db.orders || [];
  const unreturned = orders.filter(
    (o) => (o.status === 'borrowed' || o.status === 'approved') && o.borrower_id && o.borrower_id !== 0
  );
  const results = [];
  let totalSent = 0;
  for (const o of unreturned) {
    try {
      const r = await pushReturnReminder(o);
      totalSent += r.sent;
      results.push(r);
    } catch (err) {
      console.error(`[WxNotify] 提醒推送异常 order=${o.order_no}:`, err.message);
    }
  }
  console.log(`[WxNotify] 定时提醒完成：未归还工单 ${unreturned.length} 单，成功推送 ${totalSent} 条`);
  return { scanned: unreturned.length, totalSent, results };
}

module.exports = {
  getWxAccessToken,
  sendSubscribeMessage,
  pushClaimSuccess,
  pushReturnReminder,
  pushAllReturnReminders,
  resolveReminderRecipients,
  TPL_CLAIM,
  TPL_REMIND
};
