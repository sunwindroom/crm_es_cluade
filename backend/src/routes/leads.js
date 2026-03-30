const express = require('express');
const { getDb } = require('../db/connection');
const auth = require('../middleware/auth');
const perm = require('../middleware/permission');
const router = express.Router();
router.use(auth);

// 获取线索列表（权限控制）
router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, status, source, keyword, owner_id } = req.query;
  const offset = (page - 1) * pageSize;
  const db = getDb();
  const { role_name, id: userId } = req.user;

  let conditions = ['1=1'];
  const params = [];

  // 数据可见性
  const vis = perm.buildVisibilityFilter(role_name, userId, db, 'l.owner_id');
  conditions.push(vis.where); params.push(...vis.params);

  if (status) { conditions.push('l.status = ?'); params.push(status); }
  if (source) { conditions.push('l.source = ?'); params.push(source); }
  if (owner_id) { conditions.push('l.owner_id = ?'); params.push(owner_id); }
  if (keyword) {
    conditions.push('(l.title LIKE ? OR l.company LIKE ? OR l.contact_name LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const where = 'WHERE ' + conditions.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM leads l ${where}`).get(...params).cnt;
  const list = db.prepare(`
    SELECT l.*, u.real_name as owner_name, a.real_name as assigned_by_name
    FROM leads l
    LEFT JOIN users u ON l.owner_id = u.id
    LEFT JOIN users a ON l.assigned_by = a.id
    ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  res.json({ code: 200, data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize),
    canDelete: perm.canDelete(role_name), canEdit: perm.canEditAny(role_name), canConvert: perm.canConvertLead(role_name) } });
});

// 获取单条线索
router.get('/:id', (req, res) => {
  const db = getDb();
  const lead = db.prepare(`
    SELECT l.*, u.real_name as owner_name FROM leads l
    LEFT JOIN users u ON l.owner_id = u.id WHERE l.id = ?
  `).get(req.params.id);
  if (!lead) return res.status(404).json({ code: 404, message: '线索不存在' });

  const followups = db.prepare(`
    SELECT f.*, u.real_name as creator_name FROM lead_followups f
    LEFT JOIN users u ON f.creator_id = u.id WHERE f.lead_id = ? ORDER BY f.followup_time DESC
  `).all(req.params.id);

  res.json({ code: 200, data: { ...lead, followups } });
});

// 创建线索（所有人可以）
router.post('/', (req, res) => {
  const { title, company, contact_name, contact_phone, contact_email, source, status, industry, region, remark, owner_id } = req.body;
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO leads (title,company,contact_name,contact_phone,contact_email,source,status,industry,region,remark,owner_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(title, company, contact_name, contact_phone, contact_email, source, status || 'new', industry, region, remark, owner_id || req.user.id);
  res.json({ code: 200, message: '线索创建成功', data: { id: result.lastInsertRowid } });
});

// 更新线索（权限控制）
router.put('/:id', (req, res) => {
  const db = getDb();
  const { role_name, id: userId } = req.user;
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ code: 404, message: '线索不存在' });

  if (!perm.canEditAny(role_name) && lead.owner_id !== userId) {
    return res.status(403).json({ code: 403, message: '无权编辑此线索' });
  }

  const { title, company, contact_name, contact_phone, contact_email, source, status, industry, region, remark, owner_id } = req.body;
  db.prepare(`
    UPDATE leads SET title=?,company=?,contact_name=?,contact_phone=?,contact_email=?,source=?,status=?,industry=?,region=?,remark=?,owner_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(title, company, contact_name, contact_phone, contact_email, source, status, industry, region, remark, owner_id || lead.owner_id, req.params.id);
  res.json({ code: 200, message: '线索更新成功' });
});

// 分配线索（上级分配给下级）
router.put('/:id/assign', (req, res) => {
  const db = getDb();
  const { role_name, id: userId } = req.user;
  const { assignee_id } = req.body;

  if (!perm.canEditAny(role_name)) {
    // 检查是否是上级
    const subIds = perm.getSubordinateIds(db, userId);
    if (!subIds.includes(parseInt(assignee_id))) {
      return res.status(403).json({ code: 403, message: '只能分配给自己的下级' });
    }
  }

  db.prepare('UPDATE leads SET owner_id=?, assigned_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(assignee_id, userId, req.params.id);
  res.json({ code: 200, message: '线索分配成功' });
});

// 删除线索（仅系统管理员）
router.delete('/:id', (req, res) => {
  if (!perm.canDelete(req.user.role_name)) {
    return res.status(403).json({ code: 403, message: '无权删除线索，线索一旦录入不可删除' });
  }
  const db = getDb();
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ code: 200, message: '删除成功' });
});

// 转化线索（总裁/营销副总裁）
router.post('/:id/convert', (req, res) => {
  const db = getDb();
  if (!perm.canConvertLead(req.user.role_name)) {
    return res.status(403).json({ code: 403, message: '无权转化线索，需要总裁或营销副总裁权限' });
  }
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ code: 404, message: '线索不存在' });
  if (lead.converted) return res.status(400).json({ code: 400, message: '线索已转化' });

  const { convert_to = 'customer' } = req.body; // 'customer' or 'opportunity'

  let customerId = null, opportunityId = null;

  const custResult = db.prepare(`
    INSERT INTO customers (name, contact_name, contact_phone, contact_email, source, industry, region, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(lead.company || lead.contact_name, lead.contact_name, lead.contact_phone, lead.contact_email, lead.source, lead.industry, lead.region, lead.owner_id);
  customerId = custResult.lastInsertRowid;

  if (convert_to === 'opportunity') {
    const oppResult = db.prepare(`
      INSERT INTO opportunities (name, customer_id, customer_name, stage, owner_id)
      VALUES (?, ?, ?, 'prospecting', ?)
    `).run(lead.title, customerId, lead.company || lead.contact_name, lead.owner_id);
    opportunityId = oppResult.lastInsertRowid;
  }

  db.prepare(`
    UPDATE leads SET converted=1, converted_at=CURRENT_TIMESTAMP, converted_customer_id=?, converted_opportunity_id=?, status='converted' WHERE id=?
  `).run(customerId, opportunityId, lead.id);

  res.json({ code: 200, message: '转化成功', data: { customer_id: customerId, opportunity_id: opportunityId } });
});

// 添加跟踪记录（所有人可以）
router.post('/:id/followups', (req, res) => {
  const { content, followup_type, followup_time, next_followup_time } = req.body;
  if (!content) return res.status(400).json({ code: 400, message: '跟进内容不能为空' });
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO lead_followups (lead_id, content, followup_type, followup_time, next_followup_time, creator_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, content, followup_type || 'call', followup_time || new Date().toISOString(), next_followup_time, req.user.id);
  res.json({ code: 200, message: '跟进记录添加成功', data: { id: result.lastInsertRowid } });
});

// 获取下级用户列表（用于分配）
router.get('/meta/assignable-users', (req, res) => {
  const db = getDb();
  const { role_name, id: userId } = req.user;
  let users;
  if (perm.canEditAny(role_name)) {
    users = db.prepare('SELECT id, real_name, username, department FROM users WHERE status=1').all();
  } else {
    const subIds = perm.getSubordinateIds(db, userId);
    if (subIds.length === 0) return res.json({ code: 200, data: [] });
    const placeholders = subIds.map(() => '?').join(',');
    users = db.prepare(`SELECT id, real_name, username, department FROM users WHERE id IN (${placeholders})`).all(...subIds);
  }
  res.json({ code: 200, data: users });
});

module.exports = router;
