// 通知/提醒路由
//   POST /api/notifications/test-reminder  给当前登录用户发送一条「未归还提醒」测试（验证模板是否生效，无需等待 8/20）
//   GET  /api/notifications/config         返回订阅消息配置状态（前端展示用）
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { readDB, nowCST } = require('./db');
const { pushReturnReminder, TPL_CLAIM, TPL_REMIND } = require('../lib/wechatNotify');
const { nextFireDate } = require('../lib/scheduler');

const router = express.Router();

// 配置状态（前端可据此提示用户去公众平台配置模板）
router.get('/config', authenticate, (req, res) => {
  res.json({
    wx_appid_set: !!process.env.WX_APPID,
    tpl_claim_set: !!TPL_CLAIM,
    tpl_remind_set: !!TPL_REMIND,
    next_fire_at: nextFireDate().toISOString()
  });
});

// 测试提醒：给当前用户推一条「未归还提醒」（用其最新一条未归还工单；若无则构造测试工单）
router.post('/test-reminder', authenticate, async (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.user_id === req.user.user_id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  if (!user.wx_openid) {
    return res.status(400).json({ message: '当前账号未绑定微信，无法接收推送（请先用微信手机号登录一次以绑定 openid）' });
  }

  // 取该用户最新的未归还工单；没有则构造一条测试工单
  const ownUnreturned = (db.orders || [])
    .filter((o) => (o.status === 'borrowed' || o.status === 'approved') && o.borrower_id === user.user_id)
    .sort((a, b) => (b.borrow_time || '').localeCompare(a.borrow_time || ''));
  const testOrder = ownUnreturned[0] || {
    order_id: 0,
    order_no: 'TEST' + Date.now(),
    borrower_id: user.user_id,
    status: 'borrowed',
    items: [{ tool_name: '测试物品' }],
    borrow_time: nowCST()
  };

  try {
    const result = await pushReturnReminder(testOrder);
    res.json({ message: '已尝试发送测试提醒', result });
  } catch (err) {
    res.status(500).json({ message: '发送失败: ' + err.message });
  }
});

module.exports = router;
