const express = require('express');
const { getDb } = require('../db/connection');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, status, priority, keyword, manager_id } = req.query;
  const offset = (page - 1) * pageSize;
  const db = getDb();
  let where = 'WHERE 1=1';
  const params = [];

  if (status) { where += ' AND p.status = ?'; params.push(status); }
  if (priority) { where += ' AND p.priority = ?'; params.push(priority); }
  if (manager_id) { where += ' AND p.manager_id = ?'; params.push(manager_id); }
  if (keyword) {
    where += ' AND (p.name LIKE ? OR p.customer_name LIKE ? OR p.project_no LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM projects p ${where}`).get(...params).cnt;
  const list = db.prepare(`
    SELECT p.*, u.real_name as manager_name FROM projects p
    LEFT JOIN users u ON p.manager_id = u.id
    ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  res.json({ code: 200, data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize) } });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const project = db.prepare(`
    SELECT p.*, u.real_name as manager_name FROM projects p
    LEFT JOIN users u ON p.manager_id = u.id WHERE p.id = ?
  `).get(req.params.id);
  if (!project) return res.status(404).json({ code: 404, message: '项目不存在' });

  const tasks = db.prepare(`
    SELECT t.*, u.real_name as assignee_name FROM project_tasks t
    LEFT JOIN users u ON t.assignee_id = u.id WHERE t.project_id = ? ORDER BY t.created_at
  `).all(req.params.id);

  const members = db.prepare(`
    SELECT m.*, u.real_name, u.department FROM project_members m
    LEFT JOIN users u ON m.user_id = u.id WHERE m.project_id = ?
  `).all(req.params.id);

  res.json({ code: 200, data: { ...project, tasks, members } });
});

router.post('/', (req, res) => {
  const { name, customer_id, customer_name, manager_id, start_date, end_date, budget, status, priority, description, remark } = req.body;
  const db = getDb();
  const project_no = `PRJ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const result = db.prepare(`
    INSERT INTO projects (name,project_no,customer_id,customer_name,manager_id,start_date,end_date,budget,status,priority,description,remark)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(name, project_no, customer_id, customer_name, manager_id || req.user.id, start_date, end_date, budget || 0, status || 'planning', priority || 'normal', description, remark);
  res.json({ code: 200, message: '项目创建成功', data: { id: result.lastInsertRowid, project_no } });
});

router.put('/:id', (req, res) => {
  const { name, customer_id, customer_name, manager_id, start_date, end_date, actual_end_date, budget, actual_cost, status, priority, progress, description, remark } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE projects SET name=?,customer_id=?,customer_name=?,manager_id=?,start_date=?,end_date=?,actual_end_date=?,budget=?,actual_cost=?,status=?,priority=?,progress=?,description=?,remark=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(name, customer_id, customer_name, manager_id, start_date, end_date, actual_end_date, budget, actual_cost, status, priority, progress, description, remark, req.params.id);
  res.json({ code: 200, message: '项目更新成功' });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ code: 200, message: '删除成功' });
});

// 任务管理
router.get('/:id/tasks', (req, res) => {
  const db = getDb();
  const tasks = db.prepare(`
    SELECT t.*, u.real_name as assignee_name FROM project_tasks t
    LEFT JOIN users u ON t.assignee_id = u.id WHERE t.project_id = ? ORDER BY t.created_at
  `).all(req.params.id);
  res.json({ code: 200, data: tasks });
});

router.post('/:id/tasks', (req, res) => {
  const { name, assignee_id, start_date, due_date, status, priority, description } = req.body;
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO project_tasks (project_id,name,assignee_id,start_date,due_date,status,priority,description)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(req.params.id, name, assignee_id, start_date, due_date, status || 'todo', priority || 'normal', description);
  res.json({ code: 200, message: '任务创建成功', data: { id: result.lastInsertRowid } });
});

router.put('/:id/tasks/:taskId', (req, res) => {
  const { name, assignee_id, start_date, due_date, status, priority, progress, description } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE project_tasks SET name=?,assignee_id=?,start_date=?,due_date=?,status=?,priority=?,progress=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=?
  `).run(name, assignee_id, start_date, due_date, status, priority, progress, description, req.params.taskId, req.params.id);
  res.json({ code: 200, message: '任务更新成功' });
});

router.delete('/:id/tasks/:taskId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM project_tasks WHERE id = ? AND project_id = ?').run(req.params.taskId, req.params.id);
  res.json({ code: 200, message: '删除成功' });
});

module.exports = router;
