const express = require('express');
const { getDb } = require('../db/connection');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, stage, status, keyword, owner_id, customer_id } = req.query;
  const offset = (page - 1) * pageSize;
  const db = getDb();
  let where = 'WHERE 1=1';
  const params = [];

  if (stage) { where += ' AND o.stage = ?'; params.push(stage); }
  if (status) { where += ' AND o.status = ?'; params.push(status); }
  if (owner_id) { where += ' AND o.owner_id = ?'; params.push(owner_id); }
  if (customer_id) { where += ' AND o.customer_id = ?'; params.push(customer_id); }
  if (keyword) {
    where += ' AND (o.name LIKE ? OR o.customer_name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM opportunities o ${where}`).get(...params).cnt;
  const list = db.prepare(`
    SELECT o.*, u.real_name as owner_name FROM opportunities o
    LEFT JOIN users u ON o.owner_id = u.id
    ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  res.json({ code: 200, data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize) } });
});

router.get('/funnel', (req, res) => {
  const db = getDb();
  const stages = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
  const stageNames = { prospecting: '意向挖掘', qualification: '需求确认', proposal: '方案报价', negotiation: '商务谈判', closed_won: '赢单', closed_lost: '输单' };
  const data = stages.map(s => {
    const row = db.prepare(`SELECT COUNT(*) as cnt, SUM(amount) as total FROM opportunities WHERE stage = ? AND status = 'open'`).get(s);
    return { stage: s, name: stageNames[s], count: row.cnt, amount: row.total || 0 };
  });
  res.json({ code: 200, data });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const opp = db.prepare(`
    SELECT o.*, u.real_name as owner_name FROM opportunities o
    LEFT JOIN users u ON o.owner_id = u.id WHERE o.id = ?
  `).get(req.params.id);
  if (!opp) return res.status(404).json({ code: 404, message: '商机不存在' });

  const activities = db.prepare(`
    SELECT a.*, u.real_name as creator_name FROM opportunity_activities a
    LEFT JOIN users u ON a.creator_id = u.id WHERE a.opportunity_id = ? ORDER BY a.created_at DESC
  `).all(req.params.id);

  res.json({ code: 200, data: { ...opp, activities } });
});

router.post('/', (req, res) => {
  const { name, customer_id, customer_name, amount, stage, probability, expected_close_date, source, product, owner_id, remark } = req.body;
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO opportunities (name,customer_id,customer_name,amount,stage,probability,expected_close_date,source,product,owner_id,remark)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(name, customer_id, customer_name, amount || 0, stage || 'prospecting', probability || 10, expected_close_date, source, product, owner_id || req.user.id, remark);
  res.json({ code: 200, message: '商机创建成功', data: { id: result.lastInsertRowid } });
});

router.put('/:id', (req, res) => {
  const { name, customer_id, customer_name, amount, stage, probability, expected_close_date, source, product, owner_id, status, lost_reason, remark } = req.body;
  const db = getDb();
  const actual_close_date = (status === 'closed_won' || status === 'closed_lost') ? new Date().toISOString().split('T')[0] : null;
  db.prepare(`
    UPDATE opportunities SET name=?,customer_id=?,customer_name=?,amount=?,stage=?,probability=?,expected_close_date=?,source=?,product=?,owner_id=?,status=?,lost_reason=?,actual_close_date=?,remark=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(name, customer_id, customer_name, amount, stage, probability, expected_close_date, source, product, owner_id, status, lost_reason, actual_close_date, remark, req.params.id);
  res.json({ code: 200, message: '商机更新成功' });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM opportunities WHERE id = ?').run(req.params.id);
  res.json({ code: 200, message: '删除成功' });
});

router.post('/:id/activities', (req, res) => {
  const { content, activity_type } = req.body;
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO opportunity_activities (opportunity_id,content,activity_type,creator_id) VALUES (?,?,?,?)
  `).run(req.params.id, content, activity_type || 'note', req.user.id);
  res.json({ code: 200, message: '活动记录成功', data: { id: result.lastInsertRowid } });
});

module.exports = router;
