const express = require('express');
const { getDb } = require('../db/connection');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// 获取客户列表
router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, status, level, industry, keyword, owner_id } = req.query;
  const offset = (page - 1) * pageSize;
  const db = getDb();
  let where = 'WHERE 1=1';
  const params = [];

  if (status) { where += ' AND c.status = ?'; params.push(status); }
  if (level) { where += ' AND c.level = ?'; params.push(level); }
  if (industry) { where += ' AND c.industry = ?'; params.push(industry); }
  if (owner_id) { where += ' AND c.owner_id = ?'; params.push(owner_id); }
  if (keyword) {
    where += ' AND (c.name LIKE ? OR c.contact_name LIKE ? OR c.phone LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM customers c ${where}`).get(...params).cnt;
  const list = db.prepare(`
    SELECT c.*, u.real_name as owner_name FROM customers c
    LEFT JOIN users u ON c.owner_id = u.id
    ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  res.json({ code: 200, data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize) } });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const customer = db.prepare(`
    SELECT c.*, u.real_name as owner_name FROM customers c
    LEFT JOIN users u ON c.owner_id = u.id WHERE c.id = ?
  `).get(req.params.id);
  if (!customer) return res.status(404).json({ code: 404, message: '客户不存在' });

  const contacts = db.prepare('SELECT * FROM customer_contacts WHERE customer_id = ?').all(req.params.id);
  const followups = db.prepare(`
    SELECT f.*, u.real_name as creator_name FROM customer_followups f
    LEFT JOIN users u ON f.creator_id = u.id WHERE f.customer_id = ? ORDER BY f.followup_time DESC LIMIT 20
  `).all(req.params.id);

  res.json({ code: 200, data: { ...customer, contacts, followups } });
});

router.post('/', (req, res) => {
  const { name, type, industry, level, status, region, address, website, phone, email, contact_name, contact_phone, contact_email, source, owner_id, remark } = req.body;
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO customers (name,type,industry,level,status,region,address,website,phone,email,contact_name,contact_phone,contact_email,source,owner_id,remark)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(name, type || 'company', industry, level || 'normal', status || 'active', region, address, website, phone, email, contact_name, contact_phone, contact_email, source, owner_id || req.user.id, remark);
  res.json({ code: 200, message: '客户创建成功', data: { id: result.lastInsertRowid } });
});

router.put('/:id', (req, res) => {
  const { name, type, industry, level, status, region, address, website, phone, email, contact_name, contact_phone, contact_email, source, owner_id, remark } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE customers SET name=?,type=?,industry=?,level=?,status=?,region=?,address=?,website=?,phone=?,email=?,contact_name=?,contact_phone=?,contact_email=?,source=?,owner_id=?,remark=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(name, type, industry, level, status, region, address, website, phone, email, contact_name, contact_phone, contact_email, source, owner_id, remark, req.params.id);
  res.json({ code: 200, message: '客户更新成功' });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.json({ code: 200, message: '删除成功' });
});

// 添加联系人
router.post('/:id/contacts', (req, res) => {
  const { name, position, phone, email, is_primary, remark } = req.body;
  const db = getDb();
  if (is_primary) db.prepare('UPDATE customer_contacts SET is_primary=0 WHERE customer_id=?').run(req.params.id);
  const result = db.prepare(`
    INSERT INTO customer_contacts (customer_id,name,position,phone,email,is_primary,remark)
    VALUES (?,?,?,?,?,?,?)
  `).run(req.params.id, name, position, phone, email, is_primary ? 1 : 0, remark);
  res.json({ code: 200, message: '联系人添加成功', data: { id: result.lastInsertRowid } });
});

// 添加跟进记录
router.post('/:id/followups', (req, res) => {
  const { content, followup_type, followup_time, next_followup_time } = req.body;
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO customer_followups (customer_id,content,followup_type,followup_time,next_followup_time,creator_id)
    VALUES (?,?,?,?,?,?)
  `).run(req.params.id, content, followup_type || 'call', followup_time || new Date().toISOString(), next_followup_time, req.user.id);
  res.json({ code: 200, message: '跟进记录添加成功', data: { id: result.lastInsertRowid } });
});

module.exports = router;
