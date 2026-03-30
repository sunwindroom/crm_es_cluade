const express = require('express');
const { getDb } = require('../db/connection');
const auth = require('../middleware/auth');
const perm = require('../middleware/permission');
const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, status, type, keyword, owner_id } = req.query;
  const offset = (page - 1) * pageSize;
  const db = getDb();
  const { role_name, id: userId } = req.user;

  let conditions = ['1=1'];
  const params = [];

  // 项目经理/销售只看自己参与的项目的合同
  if (!perm.canViewAllProjects(role_name)) {
    conditions.push(`(c.owner_id = ? OR EXISTS (SELECT 1 FROM projects p WHERE p.contract_id = c.id AND (p.manager_id = ? OR p.sales_id = ? OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ?))))`);
    params.push(userId, userId, userId, userId);
  }

  if (status) { conditions.push('c.status = ?'); params.push(status); }
  if (type) { conditions.push('c.type = ?'); params.push(type); }
  if (owner_id) { conditions.push('c.owner_id = ?'); params.push(owner_id); }
  if (keyword) {
    conditions.push('(c.name LIKE ? OR c.contract_no LIKE ? OR c.customer_name LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const where = 'WHERE ' + conditions.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM contracts c ${where}`).get(...params).cnt;
  const list = db.prepare(`
    SELECT c.*, u.real_name as owner_name FROM contracts c
    LEFT JOIN users u ON c.owner_id = u.id
    ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  const listWithPayments = list.map(c => {
    const paid = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE contract_id = ? AND status = 'confirmed'`).get(c.id);
    const planCount = db.prepare('SELECT COUNT(*) as cnt FROM payment_plans WHERE contract_id = ?').get(c.id);
    return { ...c, paid_amount: paid.total, unpaid_amount: c.amount - paid.total, plan_count: planCount.cnt };
  });

  res.json({ code: 200, data: { list: listWithPayments, total, page: parseInt(page), pageSize: parseInt(pageSize),
    canCreate: perm.canCreateContract(role_name) } });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const contract = db.prepare(`
    SELECT c.*, u.real_name as owner_name FROM contracts c
    LEFT JOIN users u ON c.owner_id = u.id WHERE c.id = ?
  `).get(req.params.id);
  if (!contract) return res.status(404).json({ code: 404, message: '合同不存在' });

  const today = new Date().toISOString().split('T')[0];
  const plans = db.prepare('SELECT * FROM payment_plans WHERE contract_id = ? ORDER BY plan_no').all(req.params.id);
  const plansWithCountdown = plans.map(p => {
    const planDate = new Date(p.planned_date);
    const todayDate = new Date(today);
    const diffDays = Math.ceil((planDate - todayDate) / (1000 * 60 * 60 * 24));
    return {
      ...p,
      days_until: diffDays,
      is_overdue: diffDays < 0 && p.status === 'pending',
      countdown_label: p.status === 'paid' ? '已付款' : diffDays < 0 ? `逾期${Math.abs(diffDays)}天` : `距到期${diffDays}天`,
      countdown_color: p.status === 'paid' ? 'green' : diffDays < 0 ? 'red' : diffDays <= 7 ? 'orange' : diffDays <= 30 ? 'yellow' : 'blue'
    };
  });

  const payments = db.prepare('SELECT * FROM payments WHERE contract_id = ? ORDER BY payment_date DESC').all(req.params.id);
  const paid = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE contract_id = ? AND status = 'confirmed'`).get(req.params.id);

  res.json({ code: 200, data: { ...contract, payment_plans: plansWithCountdown, payments, paid_amount: paid.total, unpaid_amount: contract.amount - paid.total } });
});

router.post('/', (req, res) => {
  const { role_name } = req.user;
  if (!perm.canCreateContract(role_name)) {
    return res.status(403).json({ code: 403, message: '无权创建合同' });
  }
  const { name, customer_id, customer_name, opportunity_id, type, amount, sign_date, start_date, end_date, payment_terms, owner_id, remark, payment_plans } = req.body;
  
  if (!payment_plans || payment_plans.length === 0) {
    return res.status(400).json({ code: 400, message: '合同必须至少添加一个回款时间节点' });
  }

  const db = getDb();
  const contract_no = `HT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const result = db.prepare(`
    INSERT INTO contracts (name,contract_no,customer_id,customer_name,opportunity_id,type,amount,sign_date,start_date,end_date,payment_terms,owner_id,remark)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(name, contract_no, customer_id, customer_name, opportunity_id || null, type || 'sales', amount || 0, sign_date, start_date, end_date, payment_terms, owner_id || req.user.id, remark);

  const contractId = result.lastInsertRowid;
  const planStmt = db.prepare(`INSERT INTO payment_plans (contract_id,plan_no,name,amount,planned_date,remark) VALUES (?,?,?,?,?,?)`);
  payment_plans.forEach((p, i) => planStmt.run(contractId, i + 1, p.name || `第${i+1}期`, p.amount, p.planned_date, p.remark));

  res.json({ code: 200, message: '合同创建成功', data: { id: contractId, contract_no } });
});

router.put('/:id', (req, res) => {
  const { role_name } = req.user;
  if (!perm.canCreateContract(role_name)) {
    return res.status(403).json({ code: 403, message: '无权编辑合同' });
  }
  const { name, customer_id, customer_name, opportunity_id, type, amount, sign_date, start_date, end_date, status, payment_terms, owner_id, remark } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE contracts SET name=?,customer_id=?,customer_name=?,opportunity_id=?,type=?,amount=?,sign_date=?,start_date=?,end_date=?,status=?,payment_terms=?,owner_id=?,remark=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(name, customer_id, customer_name, opportunity_id || null, type, amount, sign_date, start_date, end_date, status, payment_terms, owner_id, remark, req.params.id);
  res.json({ code: 200, message: '合同更新成功' });
});

router.put('/:id/approve', (req, res) => {
  const { action } = req.body;
  const db = getDb();
  const status = action === 'approve' ? 'signed' : 'rejected';
  db.prepare(`UPDATE contracts SET status=?,approver_id=?,approved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(status, req.user.id, req.params.id);
  res.json({ code: 200, message: action === 'approve' ? '合同审批通过' : '合同已驳回' });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM contracts WHERE id = ?').run(req.params.id);
  res.json({ code: 200, message: '删除成功' });
});

// 更新回款计划
router.put('/:id/payment-plans', (req, res) => {
  const { plans } = req.body;
  if (!plans || plans.length === 0) {
    return res.status(400).json({ code: 400, message: '至少需要一个回款时间节点' });
  }
  const db = getDb();
  // 只删除未关联实际回款的计划
  db.prepare('DELETE FROM payment_plans WHERE contract_id = ? AND actual_payment_id IS NULL').run(req.params.id);
  const stmt = db.prepare(`INSERT INTO payment_plans (contract_id,plan_no,name,amount,planned_date,remark) VALUES (?,?,?,?,?,?)`);
  plans.forEach((p, i) => stmt.run(req.params.id, i + 1, p.name || `第${i+1}期`, p.amount, p.planned_date, p.remark));
  res.json({ code: 200, message: '回款计划保存成功' });
});

module.exports = router;
