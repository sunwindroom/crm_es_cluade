const express = require('express');
const { getDb } = require('../db/connection');
const auth = require('../middleware/auth');
const router = express.Router();
router.use(auth);

router.get('/dashboard', (req, res) => {
  const db = getDb();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
  const today = new Date().toISOString().split('T')[0];

  const stats = {
    leads: {
      total: db.prepare('SELECT COUNT(*) as c FROM leads').get().c,
      this_month: db.prepare(`SELECT COUNT(*) as c FROM leads WHERE strftime('%Y-%m',created_at)=?`).get(currentMonth).c,
      new: db.prepare(`SELECT COUNT(*) as c FROM leads WHERE status='new'`).get().c,
      converted: db.prepare(`SELECT COUNT(*) as c FROM leads WHERE converted=1`).get().c,
    },
    customers: {
      total: db.prepare('SELECT COUNT(*) as c FROM customers').get().c,
      this_month: db.prepare(`SELECT COUNT(*) as c FROM customers WHERE strftime('%Y-%m',created_at)=?`).get(currentMonth).c,
      active: db.prepare(`SELECT COUNT(*) as c FROM customers WHERE status='active'`).get().c,
    },
    opportunities: {
      total: db.prepare(`SELECT COUNT(*) as c FROM opportunities WHERE status='open'`).get().c,
      total_amount: db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM opportunities WHERE status='open'`).get().s,
      won_this_month: db.prepare(`SELECT COUNT(*) as c FROM opportunities WHERE stage='closed_won' AND strftime('%Y-%m',updated_at)=?`).get(currentMonth).c,
      won_amount_this_month: db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM opportunities WHERE stage='closed_won' AND strftime('%Y-%m',updated_at)=?`).get(currentMonth).s,
    },
    contracts: {
      total: db.prepare(`SELECT COUNT(*) as c FROM contracts WHERE status='signed'`).get().c,
      total_amount: db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM contracts WHERE status='signed'`).get().s,
      this_month: db.prepare(`SELECT COUNT(*) as c FROM contracts WHERE status='signed' AND strftime('%Y-%m',sign_date)=?`).get(currentMonth).c,
    },
    payments: {
      total_confirmed: db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status='confirmed'`).get().s,
      this_month: db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status='confirmed' AND strftime('%Y-%m',payment_date)=?`).get(currentMonth).s,
      last_month: db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status='confirmed' AND strftime('%Y-%m',payment_date)=?`).get(lastMonth).s,
      pending: db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status='pending'`).get().s,
    },
    projects: {
      total: db.prepare('SELECT COUNT(*) as c FROM projects').get().c,
      in_progress: db.prepare(`SELECT COUNT(*) as c FROM projects WHERE status='in_progress'`).get().c,
      overdue: db.prepare(`SELECT COUNT(*) as c FROM projects WHERE status NOT IN ('completed','cancelled') AND end_date < date('now')`).get().c,
      avg_progress: db.prepare(`SELECT COALESCE(AVG(progress),0) as a FROM projects WHERE status='in_progress'`).get().a,
    },
    payment_plans: {
      overdue: db.prepare(`SELECT COUNT(*) as c FROM payment_plans WHERE status='pending' AND planned_date < date('now')`).get().c,
      due_soon: db.prepare(`SELECT COUNT(*) as c FROM payment_plans WHERE status='pending' AND planned_date BETWEEN date('now') AND date('now','+30 days')`).get().c,
      overdue_amount: db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM payment_plans WHERE status='pending' AND planned_date < date('now')`).get().s,
    }
  };

  res.json({ code: 200, data: stats });
});

router.get('/payment-trend', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', payment_date) as month, COALESCE(SUM(amount),0) as amount, COUNT(*) as count
    FROM payments WHERE status='confirmed' AND payment_date >= date('now','-12 months')
    GROUP BY month ORDER BY month
  `).all();
  res.json({ code: 200, data: rows });
});

router.get('/sales-funnel', (req, res) => {
  const db = getDb();
  const stages = [
    { key: 'prospecting', name: '意向挖掘' },
    { key: 'qualification', name: '需求确认' },
    { key: 'proposal', name: '方案报价' },
    { key: 'negotiation', name: '商务谈判' },
    { key: 'closed_won', name: '赢单' },
  ];
  const data = stages.map(s => {
    const r = db.prepare(`SELECT COUNT(*) as cnt, COALESCE(SUM(amount),0) as amount FROM opportunities WHERE stage=?`).get(s.key);
    return { ...s, count: r.cnt, amount: r.amount };
  });
  res.json({ code: 200, data });
});

router.get('/customer-source', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT source, COUNT(*) as count FROM customers WHERE source IS NOT NULL GROUP BY source ORDER BY count DESC`).all();
  res.json({ code: 200, data: rows });
});

router.get('/customer-industry', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT industry, COUNT(*) as count FROM customers WHERE industry IS NOT NULL GROUP BY industry ORDER BY count DESC`).all();
  res.json({ code: 200, data: rows });
});

router.get('/lead-source', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT source, COUNT(*) as total, SUM(converted) as converted FROM leads GROUP BY source`).all();
  res.json({ code: 200, data: rows });
});

router.get('/opportunity-stage', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT stage, COUNT(*) as count, COALESCE(SUM(amount),0) as amount FROM opportunities GROUP BY stage`).all();
  res.json({ code: 200, data: rows });
});

router.get('/staff-performance', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT u.real_name as name, u.department, r.name as role_name,
      (SELECT COUNT(*) FROM leads WHERE owner_id=u.id) as leads_count,
      (SELECT COUNT(*) FROM customers WHERE owner_id=u.id) as customers_count,
      (SELECT COUNT(*) FROM opportunities WHERE owner_id=u.id AND stage='closed_won') as won_count,
      (SELECT COALESCE(SUM(amount),0) FROM opportunities WHERE owner_id=u.id AND stage='closed_won') as won_amount,
      (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN contracts c ON p.contract_id=c.id WHERE c.owner_id=u.id AND p.status='confirmed') as payment_amount
    FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.status=1 ORDER BY won_amount DESC
  `).all();
  res.json({ code: 200, data: rows });
});

router.get('/monthly-customers', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count FROM customers WHERE created_at >= date('now','-12 months') GROUP BY month ORDER BY month`).all();
  res.json({ code: 200, data: rows });
});

// 项目工时统计
router.get('/project-workhours', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT p.name as project_name, p.project_no, p.status,
      COALESCE(SUM(w.hours),0) as total_hours,
      COALESCE(SUM(w.hours * w.hourly_rate),0) as labor_cost,
      p.budget,
      COUNT(DISTINCT w.user_id) as member_count
    FROM projects p
    LEFT JOIN project_workhours w ON w.project_id = p.id
    GROUP BY p.id ORDER BY total_hours DESC
  `).all();
  res.json({ code: 200, data: rows });
});

// 回款计划预警
router.get('/payment-plan-alerts', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const rows = db.prepare(`
    SELECT pp.*, c.name as contract_name, c.customer_name,
      CAST(julianday(pp.planned_date) - julianday(?) AS INTEGER) as days_until
    FROM payment_plans pp
    LEFT JOIN contracts c ON pp.contract_id = c.id
    WHERE pp.status = 'pending'
    ORDER BY pp.planned_date ASC
    LIMIT 20
  `).all(today);
  res.json({ code: 200, data: rows });
});

module.exports = router;
