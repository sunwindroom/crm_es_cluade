const express = require('express');
const { getDb } = require('../db/connection');
const auth = require('../middleware/auth');
const perm = require('../middleware/permission');
const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, stage, status, keyword, owner_id, customer_id } = req.query;
  const offset = (page - 1) * pageSize;
  const db = getDb();
  const { role_name, id: userId } = req.user;

  let conditions = ['1=1'];
  const params = [];

  const vis = perm.buildVisibilityFilter(role_name, userId, db, 'o.owner_id');
  conditions.push(vis.where); params.push(...vis.params);

  if (stage) { conditions.push('o.stage = ?'); params.push(stage); }
  if (status) { conditions.push('o.status = ?'); params.push(status); }
  if (owner_id) { conditions.push('o.owner_id = ?'); params.push(owner_id); }
  if (customer_id) { conditions.push('o.customer_id = ?'); params.push(customer_id); }
  if (keyword) {
    conditions.push('(o.name LIKE ? OR o.customer_name LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const where = 'WHERE ' + conditions.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM opportunities o ${where}`).get(...params).cnt;
  const list = db.prepare(`
    SELECT o.*, u.real_name as owner_name FROM opportunities o
    LEFT JOIN users u ON o.owner_id = u.id
    ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  res.json({ code: 200, data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize),
    canDelete: perm.canDelete(role_name), canEdit: perm.canEditAny(role_name) } });
});

router.get('/funnel', (req, res) => {
  const db = getDb();
  const stages = ['prospecting','qualification','proposal','negotiation','closed_won','closed_lost'];
  const stageNames = { prospecting:'意向挖掘', qualification:'需求确认', proposal:'方案报价', negotiation:'商务谈判', closed_won:'赢单', closed_lost:'输单' };
  const data = stages.map(s => {
    const row = db.prepare(`SELECT COUNT(*) as cnt, SUM(amount) as total FROM opportunities WHERE stage = ?`).get(s);
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
  const db = getDb();
  const { role_name, id: userId } = req.user;
  const opp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(req.params.id);
  if (!opp) return res.status(404).json({ code: 404, message: '商机不存在' });

  if (!perm.canEditAny(role_name) && opp.owner_id !== userId) {
    return res.status(403).json({ code: 403, message: '无权编辑此商机' });
  }

  const { name, customer_id, customer_name, amount, stage, probability, expected_close_date, source, product, owner_id, status, lost_reason, remark } = req.body;
  const actual_close_date = (stage === 'closed_won' || stage === 'closed_lost') ? new Date().toISOString().split('T')[0] : null;
  db.prepare(`
    UPDATE opportunities SET name=?,customer_id=?,customer_name=?,amount=?,stage=?,probability=?,expected_close_date=?,source=?,product=?,owner_id=?,status=?,lost_reason=?,actual_close_date=?,remark=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(name, customer_id, customer_name, amount, stage, probability, expected_close_date, source, product, owner_id || opp.owner_id, status || opp.status, lost_reason, actual_close_date, remark, req.params.id);
  res.json({ code: 200, message: '商机更新成功' });
});

// 分配商机
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

  db.prepare('UPDATE opportunities SET owner_id=?, assigned_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(assignee_id, userId, req.params.id);
  res.json({ code: 200, message: '商机分配成功' });
});

router.delete('/:id', (req, res) => {
  if (!perm.canDelete(req.user.role_name)) {
    return res.status(403).json({ code: 403, message: '无权删除商机，商机一旦录入不可删除' });
  }
  const db = getDb();
  db.prepare('DELETE FROM opportunities WHERE id = ?').run(req.params.id);
  res.json({ code: 200, message: '删除成功' });
});

router.post('/:id/activities', (req, res) => {
  const { content, activity_type } = req.body;
  if (!content) return res.status(400).json({ code: 400, message: '跟进内容不能为空' });
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO opportunity_activities (opportunity_id,content,activity_type,creator_id) VALUES (?,?,?,?)
  `).run(req.params.id, content, activity_type || 'note', req.user.id);
  res.json({ code: 200, message: '活动记录成功', data: { id: result.lastInsertRowid } });
});

// 赢单商机转化为项目（总裁/营销副总裁/技术副总裁）
router.post('/:id/convert-to-project', (req, res) => {
  const { role_name } = req.user;
  if (!['系统管理员','总裁','营销副总裁','技术副总裁'].includes(role_name)) {
    return res.status(403).json({ code: 403, message: '无权操作，需要总裁/营销副总裁/技术副总裁权限' });
  }
  const db = getDb();
  const opp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(req.params.id);
  if (!opp) return res.status(404).json({ code: 404, message: '商机不存在' });
  if (opp.stage !== 'closed_won') return res.status(400).json({ code: 400, message: '只有赢单阶段的商机才能转化为项目' });
  if (opp.converted_project_id) return res.status(400).json({ code: 400, message: '该商机已转化为项目' });

  const { manager_id, start_date, end_date } = req.body;
  const project_no = `PRJ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const result = db.prepare(`
    INSERT INTO projects (name,project_no,customer_id,customer_name,opportunity_id,manager_id,start_date,end_date,budget,status)
    VALUES (?,?,?,?,?,?,?,?,?,'planning')
  `).run(opp.name, project_no, opp.customer_id, opp.customer_name, opp.id, manager_id || req.user.id, start_date, end_date, opp.amount);

  db.prepare('UPDATE opportunities SET converted_project_id=? WHERE id=?').run(result.lastInsertRowid, opp.id);
  res.json({ code: 200, message: '已成功转化为项目', data: { project_id: result.lastInsertRowid, project_no } });
});

module.exports = router;
