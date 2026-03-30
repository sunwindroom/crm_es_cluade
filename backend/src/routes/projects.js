const express = require('express');
const { getDb } = require('../db/connection');
const auth = require('../middleware/auth');
const perm = require('../middleware/permission');
const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, status, priority, keyword, manager_id } = req.query;
  const offset = (page - 1) * pageSize;
  const db = getDb();
  const { role_name, id: userId } = req.user;

  let conditions = ['1=1'];
  const params = [];

  if (!perm.canViewAllProjects(role_name)) {
    // 只能看自己是项目经理或项目成员的项目
    conditions.push(`(p.manager_id = ? OR p.sales_id = ? OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ?))`);
    params.push(userId, userId, userId);
  }

  if (status) { conditions.push('p.status = ?'); params.push(status); }
  if (priority) { conditions.push('p.priority = ?'); params.push(priority); }
  if (manager_id) { conditions.push('p.manager_id = ?'); params.push(manager_id); }
  if (keyword) {
    conditions.push('(p.name LIKE ? OR p.customer_name LIKE ? OR p.project_no LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const where = 'WHERE ' + conditions.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM projects p ${where}`).get(...params).cnt;
  const list = db.prepare(`
    SELECT p.*, u.real_name as manager_name FROM projects p
    LEFT JOIN users u ON p.manager_id = u.id
    ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  res.json({ code: 200, data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize),
    canCreate: perm.canCreateProject(role_name), canAssignPM: perm.canAssignPM(role_name) } });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const project = db.prepare(`
    SELECT p.*, u.real_name as manager_name, s.real_name as sales_name FROM projects p
    LEFT JOIN users u ON p.manager_id = u.id
    LEFT JOIN users s ON p.sales_id = s.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!project) return res.status(404).json({ code: 404, message: '项目不存在' });

  const tasks = db.prepare(`
    SELECT t.*, u.real_name as assignee_name FROM project_tasks t
    LEFT JOIN users u ON t.assignee_id = u.id WHERE t.project_id = ? ORDER BY t.start_date, t.created_at
  `).all(req.params.id);

  const members = db.prepare(`
    SELECT m.*, u.real_name, u.username, u.department FROM project_members m
    LEFT JOIN users u ON m.user_id = u.id WHERE m.project_id = ?
  `).all(req.params.id);

  const milestones = db.prepare('SELECT * FROM project_milestones WHERE project_id = ? ORDER BY planned_date').all(req.params.id);
  
  const workhours = db.prepare(`
    SELECT w.*, u.real_name as user_name FROM project_workhours w
    LEFT JOIN users u ON w.user_id = u.id WHERE w.project_id = ? ORDER BY w.week_start DESC
  `).all(req.params.id);

  const totalHours = db.prepare('SELECT COALESCE(SUM(hours),0) as total, COALESCE(SUM(hours * hourly_rate),0) as cost FROM project_workhours WHERE project_id = ?').get(req.params.id);

  res.json({ code: 200, data: { ...project, tasks, members, milestones, workhours, total_hours: totalHours.total, labor_cost: totalHours.cost } });
});

router.post('/', (req, res) => {
  const { role_name } = req.user;
  if (!perm.canCreateProject(role_name)) {
    return res.status(403).json({ code: 403, message: '无权创建项目' });
  }
  const { name, customer_id, customer_name, opportunity_id, manager_id, sales_id, start_date, end_date, budget, status, priority, description, remark } = req.body;
  const db = getDb();
  const project_no = `PRJ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const result = db.prepare(`
    INSERT INTO projects (name,project_no,customer_id,customer_name,opportunity_id,manager_id,sales_id,start_date,end_date,budget,status,priority,description,remark)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(name, project_no, customer_id, customer_name, opportunity_id || null, manager_id || req.user.id, sales_id || null, start_date, end_date, budget || 0, status || 'planning', priority || 'normal', description, remark);
  res.json({ code: 200, message: '项目创建成功', data: { id: result.lastInsertRowid, project_no } });
});

router.put('/:id', (req, res) => {
  const { name, customer_id, customer_name, manager_id, sales_id, start_date, end_date, actual_end_date, budget, actual_cost, status, priority, progress, description, remark } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE projects SET name=?,customer_id=?,customer_name=?,manager_id=?,sales_id=?,start_date=?,end_date=?,actual_end_date=?,budget=?,actual_cost=?,status=?,priority=?,progress=?,description=?,remark=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(name, customer_id, customer_name, manager_id, sales_id, start_date, end_date, actual_end_date, budget, actual_cost, status, priority, progress, description, remark, req.params.id);
  res.json({ code: 200, message: '项目更新成功' });
});

// 指派项目经理（技术副总裁/系统管理员）
router.put('/:id/assign-manager', (req, res) => {
  if (!perm.canAssignPM(req.user.role_name)) {
    return res.status(403).json({ code: 403, message: '无权指派项目经理，需要技术副总裁权限' });
  }
  const { manager_id } = req.body;
  const db = getDb();
  db.prepare('UPDATE projects SET manager_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(manager_id, req.params.id);
  res.json({ code: 200, message: '项目经理指派成功' });
});

// 指派销售协调（营销副总裁）
router.put('/:id/assign-sales', (req, res) => {
  const { role_name } = req.user;
  if (!['系统管理员','总裁','营销副总裁'].includes(role_name)) {
    return res.status(403).json({ code: 403, message: '无权指派销售，需要营销副总裁权限' });
  }
  const { sales_id } = req.body;
  const db = getDb();
  db.prepare('UPDATE projects SET sales_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(sales_id, req.params.id);
  res.json({ code: 200, message: '销售协调指派成功' });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ code: 200, message: '删除成功' });
});

// 任务管理
router.get('/:id/tasks', (req, res) => {
  const db = getDb();
  const tasks = db.prepare(`SELECT t.*, u.real_name as assignee_name FROM project_tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.project_id = ? ORDER BY t.start_date, t.created_at`).all(req.params.id);
  res.json({ code: 200, data: tasks });
});

router.post('/:id/tasks', (req, res) => {
  const { name, assignee_id, start_date, due_date, status, priority, description } = req.body;
  const db = getDb();
  const result = db.prepare(`INSERT INTO project_tasks (project_id,name,assignee_id,start_date,due_date,status,priority,description) VALUES (?,?,?,?,?,?,?,?)`).run(req.params.id, name, assignee_id, start_date, due_date, status || 'todo', priority || 'normal', description);
  res.json({ code: 200, message: '任务创建成功', data: { id: result.lastInsertRowid } });
});

router.put('/:id/tasks/:taskId', (req, res) => {
  const { name, assignee_id, start_date, due_date, status, priority, progress, description } = req.body;
  const db = getDb();
  db.prepare(`UPDATE project_tasks SET name=?,assignee_id=?,start_date=?,due_date=?,status=?,priority=?,progress=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=?`).run(name, assignee_id, start_date, due_date, status, priority, progress, description, req.params.taskId, req.params.id);
  
  // 自动更新项目进度
  const tasks = db.prepare('SELECT progress FROM project_tasks WHERE project_id = ?').all(req.params.id);
  if (tasks.length > 0) {
    const avgProgress = Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / tasks.length);
    db.prepare('UPDATE projects SET progress=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(avgProgress, req.params.id);
  }
  
  res.json({ code: 200, message: '任务更新成功' });
});

router.delete('/:id/tasks/:taskId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM project_tasks WHERE id = ? AND project_id = ?').run(req.params.taskId, req.params.id);
  res.json({ code: 200, message: '删除成功' });
});

// 里程碑管理
router.get('/:id/milestones', (req, res) => {
  const db = getDb();
  res.json({ code: 200, data: db.prepare('SELECT * FROM project_milestones WHERE project_id = ? ORDER BY planned_date').all(req.params.id) });
});

router.post('/:id/milestones', (req, res) => {
  const { name, planned_date, description } = req.body;
  const db = getDb();
  const result = db.prepare(`INSERT INTO project_milestones (project_id,name,planned_date,description) VALUES (?,?,?,?)`).run(req.params.id, name, planned_date, description);
  res.json({ code: 200, message: '里程碑创建成功', data: { id: result.lastInsertRowid } });
});

router.put('/:id/milestones/:msId', (req, res) => {
  const { name, planned_date, actual_date, status, description } = req.body;
  const db = getDb();
  db.prepare(`UPDATE project_milestones SET name=?,planned_date=?,actual_date=?,status=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=?`).run(name, planned_date, actual_date, status, description, req.params.msId, req.params.id);
  res.json({ code: 200, message: '里程碑更新成功' });
});

router.delete('/:id/milestones/:msId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM project_milestones WHERE id = ? AND project_id = ?').run(req.params.msId, req.params.id);
  res.json({ code: 200, message: '删除成功' });
});

// 工时管理
router.get('/:id/workhours', (req, res) => {
  const db = getDb();
  const { role_name, id: userId } = req.user;
  let rows;
  if (perm.canViewAllProjects(role_name)) {
    rows = db.prepare(`SELECT w.*, u.real_name as user_name FROM project_workhours w LEFT JOIN users u ON w.user_id = u.id WHERE w.project_id = ? ORDER BY w.week_start DESC`).all(req.params.id);
  } else {
    rows = db.prepare(`SELECT w.*, u.real_name as user_name FROM project_workhours w LEFT JOIN users u ON w.user_id = u.id WHERE w.project_id = ? AND w.user_id = ? ORDER BY w.week_start DESC`).all(req.params.id, userId);
  }
  const stats = db.prepare('SELECT COALESCE(SUM(hours),0) as total_hours, COALESCE(SUM(hours*hourly_rate),0) as total_cost FROM project_workhours WHERE project_id = ?').get(req.params.id);
  res.json({ code: 200, data: { list: rows, stats } });
});

router.post('/:id/workhours', (req, res) => {
  const { week_start, hours, content, hourly_rate } = req.body;
  if (!week_start || !hours) return res.status(400).json({ code: 400, message: '请填写周开始日期和工时' });
  const db = getDb();
  // 检查同周是否已填写
  const existing = db.prepare('SELECT id FROM project_workhours WHERE project_id=? AND user_id=? AND week_start=?').get(req.params.id, req.user.id, week_start);
  if (existing) {
    db.prepare('UPDATE project_workhours SET hours=?,content=?,hourly_rate=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(hours, content, hourly_rate || 0, existing.id);
    return res.json({ code: 200, message: '工时更新成功' });
  }
  const result = db.prepare(`INSERT INTO project_workhours (project_id,user_id,week_start,hours,content,hourly_rate) VALUES (?,?,?,?,?,?)`).run(req.params.id, req.user.id, week_start, hours, content, hourly_rate || 0);
  res.json({ code: 200, message: '工时记录成功', data: { id: result.lastInsertRowid } });
});

// 项目成员管理
router.get('/:id/members', (req, res) => {
  const db = getDb();
  const members = db.prepare(`SELECT m.*, u.real_name, u.username, u.department, u.position FROM project_members m LEFT JOIN users u ON m.user_id = u.id WHERE m.project_id = ?`).all(req.params.id);
  res.json({ code: 200, data: members });
});

router.post('/:id/members', (req, res) => {
  const { user_id, role } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT id FROM project_members WHERE project_id=? AND user_id=?').get(req.params.id, user_id);
  if (existing) return res.status(400).json({ code: 400, message: '该成员已在项目中' });
  db.prepare('INSERT INTO project_members (project_id,user_id,role) VALUES (?,?,?)').run(req.params.id, user_id, role || 'member');
  res.json({ code: 200, message: '成员添加成功' });
});

router.delete('/:id/members/:memberId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM project_members WHERE id = ? AND project_id = ?').run(req.params.memberId, req.params.id);
  res.json({ code: 200, message: '成员移除成功' });
});

module.exports = router;
