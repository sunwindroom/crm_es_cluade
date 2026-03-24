const express = require('express');
const { getDb } = require('../db/connection');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, status, payment_method, keyword, start_date, end_date } = req.query;
  const offset = (page - 1) * pageSize;
  const db = getDb();
  let where = 'WHERE 1=1';
  const params = [];

  if (status) { where += ' AND p.status = ?'; params.push(status); }
  if (payment_method) { where += ' AND p.payment_method = ?'; params.push(payment_method); }
  if (start_date) { where += ' AND p.payment_date >= ?'; params.push(start_date); }
  if (end_date) { where += ' AND p.payment_date <= ?'; params.push(end_date); }
  if (keyword) {
    where += ' AND (p.payment_no LIKE ? OR p.customer_name LIKE ? OR p.contract_name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM payments p ${where}`).get(...params).cnt;
  const stats = db.prepare(`SELECT COALESCE(SUM(CASE WHEN status='confirmed' THEN amount ELSE 0 END),0) as confirmed, COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END),0) as pending FROM payments p ${where}`).get(...params);
  const list = db.prepare(`
    SELECT p.*, u.real_name as creator_name FROM payments p
    LEFT JOIN users u ON p.creator_id = u.id
    ${where} ORDER BY p.payment_date DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  res.json({ code: 200, data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize), stats } });
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
  const { contract_id, contract_name, customer_id, customer_name, amount, payment_date, payment_method, bank_account, remark } = req.body;
  const db = getDb();
  const payment_no = `SK-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const result = db.prepare(`
    INSERT INTO payments (payment_no,contract_id,contract_name,customer_id,customer_name,amount,payment_date,payment_method,bank_account,creator_id,remark)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(payment_no, contract_id, contract_name, customer_id, customer_name, amount, payment_date, payment_method || 'transfer', bank_account, req.user.id, remark);
  res.json({ code: 200, message: '回款记录创建成功', data: { id: result.lastInsertRowid, payment_no } });
});

router.put('/:id', (req, res) => {
  const { contract_id, contract_name, customer_id, customer_name, amount, payment_date, payment_method, bank_account, remark } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE payments SET contract_id=?,contract_name=?,customer_id=?,customer_name=?,amount=?,payment_date=?,payment_method=?,bank_account=?,remark=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(contract_id, contract_name, customer_id, customer_name, amount, payment_date, payment_method, bank_account, remark, req.params.id);
  res.json({ code: 200, message: '回款记录更新成功' });
});

router.put('/:id/confirm', (req, res) => {
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
