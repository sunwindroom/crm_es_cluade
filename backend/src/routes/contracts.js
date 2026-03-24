const express = require('express');
const { getDb } = require('../db/connection');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, status, type, keyword, owner_id } = req.query;
  const offset = (page - 1) * pageSize;
  const db = getDb();
  let where = 'WHERE 1=1';
  const params = [];

  if (status) { where += ' AND c.status = ?'; params.push(status); }
  if (type) { where += ' AND c.type = ?'; params.push(type); }
  if (owner_id) { where += ' AND c.owner_id = ?'; params.push(owner_id); }
  if (keyword) {
    where += ' AND (c.name LIKE ? OR c.contract_no LIKE ? OR c.customer_name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM contracts c ${where}`).get(...params).cnt;
  const list = db.prepare(`
    SELECT c.*, u.real_name as owner_name FROM contracts c
    LEFT JOIN users u ON c.owner_id = u.id
    ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  // 附加回款统计
  const listWithPayments = list.map(c => {
    const paid = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE contract_id = ? AND status = 'confirmed'`).get(c.id);
    return { ...c, paid_amount: paid.total, unpaid_amount: c.amount - paid.total };
  });

  res.json({ code: 200, data: { list: listWithPayments, total, page: parseInt(page), pageSize: parseInt(pageSize) } });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const contract = db.prepare(`
    SELECT c.*, u.real_name as owner_name FROM contracts c
    LEFT JOIN users u ON c.owner_id = u.id WHERE c.id = ?
  `).get(req.params.id);
  if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });

  const plans = db.prepare('SELECT * FROM payment_plans WHERE contract_id = ? ORDER BY plan_no').all(req.params.id);
  const payments = db.prepare('SELECT * FROM payments WHERE contract_id = ? ORDER BY payment_date DESC').all(req.params.id);
  const paid = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE contract_id = ? AND status = 'confirmed'`).get(req.params.id);

  res.json({ code: 200, data: { ...contract, payment_plans: plans, payments, paid_amount: paid.total, unpaid_amount: contract.amount - paid.total } });
});

router.post('/', (req, res) => {
  const { name, customer_id, customer_name, opportunity_id, type, amount, sign_date, start_date, end_date, payment_terms, owner_id, remark } = req.body;
  const db = getDb();
  const contract_no = `HT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const result = db.prepare(`
    INSERT INTO contracts (name,contract_no,customer_id,customer_name,opportunity_id,type,amount,sign_date,start_date,end_date,payment_terms,owner_id,remark)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(name, contract_no, customer_id, customer_name, opportunity_id, type || 'sales', amount || 0, sign_date, start_date, end_date, payment_terms, owner_id || req.user.id, remark);
  res.json({ code: 200, message: '合同创建成功', data: { id: result.lastInsertRowid, contract_no } });
});

router.put('/:id', (req, res) => {
  const { name, customer_id, customer_name, opportunity_id, type, amount, sign_date, start_date, end_date, status, payment_terms, owner_id, remark } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE contracts SET name=?,customer_id=?,customer_name=?,opportunity_id=?,type=?,amount=?,sign_date=?,start_date=?,end_date=?,status=?,payment_terms=?,owner_id=?,remark=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(name, customer_id, customer_name, opportunity_id, type, amount, sign_date, start_date, end_date, status, payment_terms, owner_id, remark, req.params.id);
  res.json({ code: 200, message: '合同更新成功' });
});

router.put('/:id/approve', (req, res) => {
  const { action } = req.body; // approve or reject
  const db = getDb();
  const status = action === 'approve' ? 'signed' : 'rejected';
  db.prepare(`UPDATE contracts SET status=?,approver_id=?,approved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(status, req.user.id, req.params.id);
  res.json({ code: 200, message: action === 'approve' ? '合同审批通过' : '合同已驳回' });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM contracts WHERE id = ?').run(req.params.id);
  res.json({ code: 200, message: '删除成功' });
});

// 回款计划
router.post('/:id/payment-plans', (req, res) => {
  const { plans } = req.body; // [{amount, planned_date, remark}]
  const db = getDb();
  db.prepare('DELETE FROM payment_plans WHERE contract_id = ?').run(req.params.id);
  const stmt = db.prepare(`INSERT INTO payment_plans (contract_id,plan_no,amount,planned_date,remark) VALUES (?,?,?,?,?)`);
  plans.forEach((p, i) => stmt.run(req.params.id, i + 1, p.amount, p.planned_date, p.remark));
  res.json({ code: 200, message: '回款计划保存成功' });
});

module.exports = router;
