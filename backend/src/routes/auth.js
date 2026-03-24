const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'crm_default_secret_2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
  }

  const db = getDb();
  const user = db.prepare(`
    SELECT u.*, r.name as role_name, r.permissions
    FROM users u LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.username = ? AND u.status = 1
  `).get(username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ code: 401, message: '用户名或密码错误' });
  }

  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  const token = jwt.sign(
    { id: user.id, username: user.username, role_id: user.role_id, role_name: user.role_name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  const { password: _, ...userInfo } = user;
  res.json({
    code: 200,
    message: '登录成功',
    data: { token, user: { ...userInfo, permissions: JSON.parse(user.permissions || '{}') } }
  });
});

// 获取当前用户信息
router.get('/profile', authMiddleware, (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT u.id, u.username, u.real_name, u.email, u.phone, u.avatar, u.department, u.position,
           u.status, u.last_login, u.created_at, r.name as role_name, r.permissions
    FROM users u LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.id = ?
  `).get(req.user.id);

  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });

  res.json({ code: 200, data: { ...user, permissions: JSON.parse(user.permissions || '{}') } });
});

// 修改密码
router.put('/password', authMiddleware, (req, res) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) {
    return res.status(400).json({ code: 400, message: '参数不完整' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(old_password, user.password)) {
    return res.status(400).json({ code: 400, message: '原密码错误' });
  }

  const hashed = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashed, req.user.id);
  res.json({ code: 200, message: '密码修改成功' });
});

// 更新个人信息
router.put('/profile', authMiddleware, (req, res) => {
  const { real_name, email, phone, avatar, department, position } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE users SET real_name=?, email=?, phone=?, avatar=?, department=?, position=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(real_name, email, phone, avatar, department, position, req.user.id);
  res.json({ code: 200, message: '个人信息更新成功' });
});

module.exports = router;
