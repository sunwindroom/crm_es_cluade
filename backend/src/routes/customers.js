const express = require('express');
const { getDb } = require('../db/connection');
const auth = require('../middleware/auth');
const perm = require('../middleware/permission');
const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, status, level, industry, keyword, owner_id } = req.query;
  const offset = (page - 1) * pageSize;
  const db = getDb();
  const { role_name, id: userId } = req.user;

  let conditions = ['1=1'];
  const params = [];

  const vis = perm.buildVisibilityFilter(role_name, userId, db, 'c.owner_id');
  conditions.push(vis.where); params.push(...vis.params);

  if (status) { conditions.push('c.status = ?'); params.push(status); }
  if (level) { conditions.push('c.level = ?'); params.push(level); }
  if (industry) { conditions.push('c.industry = ?'); params.push(industry); }
  if (owner_id) { conditions.push('c.owner_id = ?'); params.push(owner_id); }
  if (keyword) {
    conditions.push('(c.name LIKE ? OR c.contact_name LIKE ? OR c.phone LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const where = 'WHERE ' + conditions.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM customers c ${where}`).get(...params).cnt;
  const list = db.prepare(`
    SELECT c.*, u.real_name as owner_name FROM customers c
    LEFT JOIN users u ON c.owner_id = u.id
    ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  res.json({ code: 200, data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize),
    canDelete: perm.canDelete(role_name), canEdit: perm.canEditAny(role_name) } });
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
    LEFT JOIN users u ON f.creator_id = u.id WHERE f.customer_id = ? ORDER BY f.followup_time DESC LIMIT 50
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
  const db = getDb();
  const { role_name, id: userId } = req.user;
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ code: 404, message: '客户不存在' });

  if (!perm.canEditAny(role_name) && customer.owner_id !== userId) {
    return res.status(403).json({ code: 403, message: '无权编辑此客户' });
  }

  const { name, type, industry, level, status, region, address, website, phone, email, contact_name, contact_phone, contact_email, source, owner_id, remark } = req.body;
  db.prepare(`
    UPDATE customers SET name=?,type=?,industry=?,level=?,status=?,region=?,address=?,website=?,phone=?,email=?,contact_name=?,contact_phone=?,contact_email=?,source=?,owner_id=?,remark=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(name, type, industry, level, status, region, address, website, phone, email, contact_name, contact_phone, contact_email, source, owner_id || customer.owner_id, remark, req.params.id);
  res.json({ code: 200, message: '客户更新成功' });
});

// 分配客户
router.put('/:id/assign', (req, res) => {
  const db = getDb();
  const { role_name, id: userId } = req.user;
  const { assignee_id } = req.body;

  if (!perm.canEditAny(role_name)) {
    const subIds = perm.getSubordinateIds(db, userId);
    if (!subIds.includes(parseInt(assignee_id))) {
      return res.status(403).json({ code: 403, message: '只能分配给自己的下级' });
    }
  }

  db.prepare('UPDATE customers SET owner_id=?, assigned_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(assignee_id, userId, req.params.id);
  res.json({ code: 200, message: '客户分配成功' });
});

router.delete('/:id', (req, res) => {
  if (!perm.canDelete(req.user.role_name)) {
    return res.status(403).json({ code: 403, message: '无权删除客户，客户一旦录入不可删除' });
  }
  const db = getDb();
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.json({ code: 200, message: '删除成功' });
});

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

router.post('/:id/followups', (req, res) => {
  const { content, followup_type, followup_time, next_followup_time } = req.body;
  if (!content) return res.status(400).json({ code: 400, message: '跟进内容不能为空' });
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO customer_followups (customer_id,content,followup_type,followup_time,next_followup_time,creator_id)
    VALUES (?,?,?,?,?,?)
  `).run(req.params.id, content, followup_type || 'call', followup_time || new Date().toISOString(), next_followup_time, req.user.id);
  res.json({ code: 200, message: '跟进记录添加成功', data: { id: result.lastInsertRowid } });
});

module.exports = router;
