const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/connection');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// ==================== 用户管理 ====================
router.get('/users', (req, res) => {
  const { page = 1, pageSize = 10, status, keyword, role_id } = req.query;
  const offset = (page - 1) * pageSize;
  const db = getDb();
  let where = 'WHERE 1=1';
  const params = [];

  if (status !== undefined && status !== '') { where += ' AND u.status = ?'; params.push(parseInt(status)); }
  if (role_id) { where += ' AND u.role_id = ?'; params.push(role_id); }
  if (keyword) {
    where += ' AND (u.username LIKE ? OR u.real_name LIKE ? OR u.email LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM users u ${where}`).get(...params).cnt;
  const list = db.prepare(`
    SELECT u.id, u.username, u.real_name, u.email, u.phone, u.department, u.position, u.status, u.last_login, u.created_at, r.name as role_name, u.role_id
    FROM users u LEFT JOIN roles r ON u.role_id = r.id
    ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  res.json({ code: 200, data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize) } });
});

router.get('/users/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT u.id, u.username, u.real_name, u.email, u.phone, u.department, u.position, u.status, u.last_login, u.created_at, u.role_id, r.name as role_name
    FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ?
  `).get(req.params.id);
  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
  res.json({ code: 200, data: user });
});

router.post('/users', (req, res) => {
  const { username, password, real_name, email, phone, role_id, department, position } = req.body;
  if (!username || !password) return res.status(400).json({ code: 400, message: '用户名和密码必填' });
  const db = getDb();
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ code: 400, message: '用户名已存在' });
  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (username,password,real_name,email,phone,role_id,department,position)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(username, hashed, real_name, email, phone, role_id, department, position);
  res.json({ code: 200, message: '用户创建成功', data: { id: result.lastInsertRowid } });
});

router.put('/users/:id', (req, res) => {
  const { real_name, email, phone, role_id, department, position, status } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE users SET real_name=?,email=?,phone=?,role_id=?,department=?,position=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(real_name, email, phone, role_id, department, position, status, req.params.id);
  res.json({ code: 200, message: '用户更新成功' });
});

router.put('/users/:id/reset-password', (req, res) => {
  const { new_password } = req.body;
  if (!new_password) return res.status(400).json({ code: 400, message: '新密码不能为空' });
  const db = getDb();
  const hashed = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(hashed, req.params.id);
  res.json({ code: 200, message: '密码重置成功' });
});

router.delete('/users/:id', (req, res) => {
  if (req.params.id == req.user.id) return res.status(400).json({ code: 400, message: '不能删除自己' });
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ code: 200, message: '删除成功' });
});

// ==================== 角色管理 ====================
router.get('/roles', (req, res) => {
  const db = getDb();
  const list = db.prepare('SELECT * FROM roles ORDER BY id').all();
  const withCount = list.map(r => {
    const cnt = db.prepare('SELECT COUNT(*) as c FROM users WHERE role_id = ?').get(r.id);
    return { ...r, user_count: cnt.c, permissions: JSON.parse(r.permissions || '{}') };
  });
  res.json({ code: 200, data: withCount });
});

router.get('/roles/:id', (req, res) => {
  const db = getDb();
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
  if (!role) return res.status(404).json({ code: 404, message: '角色不存在' });
  res.json({ code: 200, data: { ...role, permissions: JSON.parse(role.permissions || '{}') } });
});

router.post('/roles', (req, res) => {
  const { name, description, permissions } = req.body;
  if (!name) return res.status(400).json({ code: 400, message: '角色名称必填' });
  const db = getDb();
  const result = db.prepare(`INSERT INTO roles (name,description,permissions) VALUES (?,?,?)`).run(name, description, JSON.stringify(permissions || {}));
  res.json({ code: 200, message: '角色创建成功', data: { id: result.lastInsertRowid } });
});

router.put('/roles/:id', (req, res) => {
  const { name, description, permissions } = req.body;
  const db = getDb();
  db.prepare(`UPDATE roles SET name=?,description=?,permissions=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(name, description, JSON.stringify(permissions || {}), req.params.id);
  res.json({ code: 200, message: '角色更新成功' });
});

router.delete('/roles/:id', (req, res) => {
  const db = getDb();
  const cnt = db.prepare('SELECT COUNT(*) as c FROM users WHERE role_id = ?').get(req.params.id);
  if (cnt.c > 0) return res.status(400).json({ code: 400, message: '该角色下还有用户，不能删除' });
  db.prepare('DELETE FROM roles WHERE id = ?').run(req.params.id);
  res.json({ code: 200, message: '删除成功' });
});

// ==================== 操作日志 ====================
router.get('/logs', (req, res) => {
  const { page = 1, pageSize = 20, module, keyword } = req.query;
  const offset = (page - 1) * pageSize;
  const db = getDb();
  let where = 'WHERE 1=1';
  const params = [];
  if (module) { where += ' AND module = ?'; params.push(module); }
  if (keyword) { where += ' AND (username LIKE ? OR action LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM operation_logs ${where}`).get(...params).cnt;
  const list = db.prepare(`SELECT * FROM operation_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(pageSize), offset);
  res.json({ code: 200, data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize) } });
});

module.exports = router;
