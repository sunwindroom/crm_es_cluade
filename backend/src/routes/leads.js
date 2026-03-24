const express = require('express');
const { getDb } = require('../db/connection');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// 获取线索列表
router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, status, source, keyword, owner_id } = req.query;
  const offset = (page - 1) * pageSize;
  const db = getDb();

  let where = 'WHERE 1=1';
  const params = [];

  if (status) { where += ' AND l.status = ?'; params.push(status); }
  if (source) { where += ' AND l.source = ?'; params.push(source); }
  if (owner_id) { where += ' AND l.owner_id = ?'; params.push(owner_id); }
  if (keyword) {
    where += ' AND (l.title LIKE ? OR l.company LIKE ? OR l.contact_name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM leads l ${where}`).get(...params).cnt;
  const list = db.prepare(`
    SELECT l.*, u.real_name as owner_name
    FROM leads l LEFT JOIN users u ON l.owner_id = u.id
    ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  res.json({ code: 200, data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize) } });
});

// 获取单条线索
router.get('/:id', (req, res) => {
  const db = getDb();
  const lead = db.prepare(`
    SELECT l.*, u.real_name as owner_name FROM leads l
    LEFT JOIN users u ON l.owner_id = u.id WHERE l.id = ?
  `).get(req.params.id);
  if (!lead) return res.status(404).json({ code: 404, message: '线索不存在' });
  res.json({ code: 200, data: lead });
});

// 创建线索
router.post('/', (req, res) => {
  const { title, company, contact_name, contact_phone, contact_email, source, status, industry, region, remark, owner_id } = req.body;
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO leads (title,company,contact_name,contact_phone,contact_email,source,status,industry,region,remark,owner_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(title, company, contact_name, contact_phone, contact_email, source, status || 'new', industry, region, remark, owner_id || req.user.id);
  res.json({ code: 200, message: '线索创建成功', data: { id: result.lastInsertRowid } });
});

// 更新线索
router.put('/:id', (req, res) => {
  const { title, company, contact_name, contact_phone, contact_email, source, status, industry, region, remark, owner_id } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE leads SET title=?,company=?,contact_name=?,contact_phone=?,contact_email=?,source=?,status=?,industry=?,region=?,remark=?,owner_id=?,updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(title, company, contact_name, contact_phone, contact_email, source, status, industry, region, remark, owner_id, req.params.id);
  res.json({ code: 200, message: '线索更新成功' });
});

// 删除线索
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ code: 200, message: '删除成功' });
});

// 转化线索为客户
router.post('/:id/convert', (req, res) => {
  const db = getDb();
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ code: 404, message: '线索不存在' });
  if (lead.converted) return res.status(400).json({ code: 400, message: '线索已转化' });

  const result = db.prepare(`
    INSERT INTO customers (name, contact_name, contact_phone, contact_email, source, industry, region, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(lead.company || lead.contact_name, lead.contact_name, lead.contact_phone, lead.contact_email, lead.source, lead.industry, lead.region, lead.owner_id);

  db.prepare(`
    UPDATE leads SET converted=1, converted_at=CURRENT_TIMESTAMP, converted_customer_id=?, status='converted' WHERE id=?
  `).run(result.lastInsertRowid, lead.id);

  res.json({ code: 200, message: '转化成功', data: { customer_id: result.lastInsertRowid } });
});

module.exports = router;
