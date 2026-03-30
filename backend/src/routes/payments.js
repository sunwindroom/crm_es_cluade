const express = require('express');
const { getDb } = require('../db/connection');
const auth = require('../middleware/auth');
const perm = require('../middleware/permission');
const router = express.Router();
router.use(auth);

// 获取所有回款计划（带倒计时）
router.get('/plans', (req, res) => {
  const { status, overdue_only } = req.query;
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  let where = 'WHERE 1=1';
  const params = [];
  if (status) { where += ' AND pp.status = ?'; params.push(status); }
  if (overdue_only === 'true') { where += ' AND pp.planned_date < ? AND pp.status = ?'; params.push(today, 'pending'); }

  const plans = db.prepare(`
    SELECT pp.*, c.name as contract_name, c.customer_name, c.amount as contract_amount,
           u.real_name as owner_name
    FROM payment_plans pp
    LEFT JOIN contracts c ON pp.contract_id = c.id
    LEFT JOIN users u ON c.owner_id = u.id
    ${where} ORDER BY pp.planned_date ASC
  `).all(...params);

  const plansWithCountdown = plans.map(p => {
    const planDate = new Date(p.planned_date);
    const todayDate = new Date(today);
    const diffDays = Math.ceil((planDate - todayDate) / (1000 * 60 * 60 * 24));
    return {
      ...p,
      days_until: diffDays,
      is_overdue: diffDays < 0 && p.status === 'pending',
      countdown_label: p.status === 'paid' ? '已付款' : diffDays < 0 ? `逾期${Math.abs(diffDays)}天` : diffDays === 0 ? '今天到期' : `${diffDays}天后到期`,
      countdown_color: p.status === 'paid' ? 'green' : diffDays < 0 ? 'red' : diffDays <= 7 ? 'orange' : diffDays <= 30 ? 'yellow' : 'blue'
    };
  });

  res.json({ code: 200, data: plansWithCountdown });
});

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, status, payment_method, keyword, start_date, end_date } = req.query;
  const offset = (page - 1) * pageSize;
  const db = getDb();
  const { role_name, id: userId } = req.user;

  let conditions = ['1=1'];
  const params = [];

  // 权限控制：项目经理/销售只看自己参与项目的回款
  if (!perm.canViewAllProjects(role_name)) {
    conditions.push(`(p.creator_id = ? OR EXISTS (SELECT 1 FROM contracts c2 JOIN projects pj ON pj.contract_id = c2.id WHERE c2.id = p.contract_id AND (pj.manager_id = ? OR pj.sales_id = ? OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = pj.id AND pm.user_id = ?))))`);
    params.push(userId, userId, userId, userId);
  }

  if (status) { conditions.push('p.status = ?'); params.push(status); }
  if (payment_method) { conditions.push('p.payment_method = ?'); params.push(payment_method); }
  if (start_date) { conditions.push('p.payment_date >= ?'); params.push(start_date); }
  if (end_date) { conditions.push('p.payment_date <= ?'); params.push(end_date); }
  if (keyword) {
    conditions.push('(p.payment_no LIKE ? OR p.customer_name LIKE ? OR p.contract_name LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const where = 'WHERE ' + conditions.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM payments p ${where}`).get(...params).cnt;
  const stats = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN status='confirmed' THEN amount ELSE 0 END),0) as confirmed,
           COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END),0) as pending
    FROM payments p ${where}
  `).get(...params);
  const list = db.prepare(`
    SELECT p.*, u.real_name as creator_name FROM payments p
    LEFT JOIN users u ON p.creator_id = u.id
    ${where} ORDER BY p.payment_date DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  res.json({ code: 200, data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize), stats,
    canConfirm: perm.canConfirmPayment(role_name) } });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const payment = db.prepare(`
    SELECT p.*, u.real_name as creator_name, c.real_name as confirmer_name
    FROM payments p LEFT JOIN users u ON p.creator_id = u.id LEFT JOIN users c ON p.confirmer_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!payment) return res.status(404).json({ code: 404, message: '回款记录不存在' });
  res.json({ code: 200, data: payment });
});

router.post('/', (req, res) => {
  const { contract_id, contract_name, payment_plan_id, customer_id, customer_name, amount, payment_date, payment_method, bank_account, remark } = req.body;
  const db = getDb();
  const payment_no = `SK-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const result = db.prepare(`
    INSERT INTO payments (payment_no,contract_id,contract_name,payment_plan_id,customer_id,customer_name,amount,payment_date,payment_method,bank_account,creator_id,remark)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(payment_no, contract_id, contract_name, payment_plan_id || null, customer_id, customer_name, amount, payment_date, payment_method || 'transfer', bank_account, req.user.id, remark);

  // 如果关联了回款计划，更新计划状态
  if (payment_plan_id) {
    db.prepare('UPDATE payment_plans SET status=?, actual_payment_id=? WHERE id=?').run('paid', result.lastInsertRowid, payment_plan_id);
  }

  res.json({ code: 200, message: '回款记录创建成功', data: { id: result.lastInsertRowid, payment_no } });
});

router.put('/:id', (req, res) => {
  const { role_name } = req.user;
  if (!perm.canConfirmPayment(role_name) && !perm.canCreateContract(role_name)) {
    return res.status(403).json({ code: 403, message: '无权修改回款记录' });
  }
  const { contract_id, contract_name, customer_id, customer_name, amount, payment_date, payment_method, bank_account, remark } = req.body;
  const db = getDb();
  db.prepare(`UPDATE payments SET contract_id=?,contract_name=?,customer_id=?,customer_name=?,amount=?,payment_date=?,payment_method=?,bank_account=?,remark=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(contract_id, contract_name, customer_id, customer_name, amount, payment_date, payment_method, bank_account, remark, req.params.id);
  res.json({ code: 200, message: '回款记录更新成功' });
});

router.put('/:id/confirm', (req, res) => {
  if (!perm.canConfirmPayment(req.user.role_name)) {
    return res.status(403).json({ code: 403, message: '无权确认回款，需要财务人员权限' });
  }
  const db = getDb();
  db.prepare(`UPDATE payments SET status='confirmed', confirmer_id=?, confirmed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(req.user.id, req.params.id);
  res.json({ code: 200, message: '回款确认成功' });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
  res.json({ code: 200, message: '删除成功' });
});

module.exports = router;
