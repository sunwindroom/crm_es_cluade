const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './crm.db';

function initDatabase() {
  const db = new Database(path.resolve(DB_PATH));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ==============================
  // 用户与权限
  // ==============================
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      permissions TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      real_name TEXT,
      email TEXT,
      phone TEXT,
      avatar TEXT,
      role_id INTEGER REFERENCES roles(id),
      department TEXT,
      position TEXT,
      status INTEGER DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ==============================
    -- 线索管理
    -- ==============================
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      source TEXT,
      status TEXT DEFAULT 'new',
      industry TEXT,
      region TEXT,
      remark TEXT,
      owner_id INTEGER REFERENCES users(id),
      converted INTEGER DEFAULT 0,
      converted_at DATETIME,
      converted_customer_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ==============================
    -- 客户管理
    -- ==============================
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'company',
      industry TEXT,
      level TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'active',
      region TEXT,
      address TEXT,
      website TEXT,
      phone TEXT,
      email TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      source TEXT,
      owner_id INTEGER REFERENCES users(id),
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customer_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position TEXT,
      phone TEXT,
      email TEXT,
      is_primary INTEGER DEFAULT 0,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customer_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      followup_type TEXT DEFAULT 'call',
      followup_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      next_followup_time DATETIME,
      creator_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ==============================
    -- 商机管理
    -- ==============================
    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      customer_id INTEGER REFERENCES customers(id),
      customer_name TEXT,
      amount REAL DEFAULT 0,
      stage TEXT DEFAULT 'prospecting',
      probability INTEGER DEFAULT 10,
      expected_close_date DATE,
      actual_close_date DATE,
      source TEXT,
      product TEXT,
      owner_id INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'open',
      lost_reason TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS opportunity_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      activity_type TEXT DEFAULT 'note',
      creator_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ==============================
    -- 项目管理
    -- ==============================
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      project_no TEXT UNIQUE,
      customer_id INTEGER REFERENCES customers(id),
      customer_name TEXT,
      opportunity_id INTEGER REFERENCES opportunities(id),
      contract_id INTEGER,
      manager_id INTEGER REFERENCES users(id),
      start_date DATE,
      end_date DATE,
      actual_end_date DATE,
      budget REAL DEFAULT 0,
      actual_cost REAL DEFAULT 0,
      status TEXT DEFAULT 'planning',
      priority TEXT DEFAULT 'normal',
      progress INTEGER DEFAULT 0,
      description TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      assignee_id INTEGER REFERENCES users(id),
      start_date DATE,
      due_date DATE,
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'normal',
      progress INTEGER DEFAULT 0,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      role TEXT DEFAULT 'member',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ==============================
    -- 合同管理
    -- ==============================
    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contract_no TEXT UNIQUE,
      customer_id INTEGER REFERENCES customers(id),
      customer_name TEXT,
      opportunity_id INTEGER REFERENCES opportunities(id),
      type TEXT DEFAULT 'sales',
      amount REAL DEFAULT 0,
      sign_date DATE,
      start_date DATE,
      end_date DATE,
      status TEXT DEFAULT 'draft',
      payment_terms TEXT,
      owner_id INTEGER REFERENCES users(id),
      approver_id INTEGER REFERENCES users(id),
      approved_at DATETIME,
      file_url TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ==============================
    -- 回款管理
    -- ==============================
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_no TEXT UNIQUE,
      contract_id INTEGER REFERENCES contracts(id),
      contract_name TEXT,
      customer_id INTEGER REFERENCES customers(id),
      customer_name TEXT,
      amount REAL NOT NULL,
      payment_date DATE NOT NULL,
      payment_method TEXT DEFAULT 'transfer',
      bank_account TEXT,
      status TEXT DEFAULT 'pending',
      confirmed_at DATETIME,
      confirmer_id INTEGER REFERENCES users(id),
      creator_id INTEGER REFERENCES users(id),
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payment_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      plan_no INTEGER,
      amount REAL NOT NULL,
      planned_date DATE NOT NULL,
      status TEXT DEFAULT 'pending',
      actual_payment_id INTEGER REFERENCES payments(id),
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ==============================
    -- 操作日志
    -- ==============================
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      username TEXT,
      module TEXT,
      action TEXT,
      target_id INTEGER,
      detail TEXT,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 初始化角色
  const roleStmt = db.prepare(`
    INSERT OR IGNORE INTO roles (name, description, permissions) VALUES (?, ?, ?)
  `);
  roleStmt.run('超级管理员', '拥有所有权限', JSON.stringify({
    leads: ['read','write','delete'],
    customers: ['read','write','delete'],
    opportunities: ['read','write','delete'],
    projects: ['read','write','delete'],
    contracts: ['read','write','delete'],
    payments: ['read','write','delete'],
    reports: ['read'],
    system: ['read','write','delete']
  }));
  roleStmt.run('销售经理', '管理销售相关模块', JSON.stringify({
    leads: ['read','write','delete'],
    customers: ['read','write','delete'],
    opportunities: ['read','write','delete'],
    contracts: ['read','write'],
    payments: ['read'],
    reports: ['read']
  }));
  roleStmt.run('销售顾问', '负责客户跟进', JSON.stringify({
    leads: ['read','write'],
    customers: ['read','write'],
    opportunities: ['read','write'],
    contracts: ['read'],
    payments: ['read']
  }));
  roleStmt.run('项目经理', '管理项目和合同', JSON.stringify({
    customers: ['read'],
    projects: ['read','write'],
    contracts: ['read','write'],
    payments: ['read']
  }));

  // 初始化管理员
  const adminPwd = bcrypt.hashSync('Admin@123', 10);
  const adminRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('超级管理员');
  db.prepare(`
    INSERT OR IGNORE INTO users (username, password, real_name, email, role_id, department, position)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('admin', adminPwd, '系统管理员', 'admin@crm.com', adminRole?.id, '信息技术部', '系统管理员');

  // 初始化示例数据
  insertSampleData(db);

  console.log('✅ 数据库初始化完成');
  db.close();
}

function insertSampleData(db) {
  const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminUser) return;
  const uid = adminUser.id;

  // 示例客户
  const customers = [
    ['北京科技有限公司', 'company', '互联网', 'vip', 'active', '北京', '张明', '13800138001', 'zhangming@bj-tech.com'],
    ['上海贸易集团', 'company', '贸易', 'important', 'active', '上海', '李红', '13900139002', 'lihong@sh-trade.com'],
    ['广州制造股份', 'company', '制造业', 'normal', 'active', '广州', '王刚', '13700137003', 'wanggang@gz-mfg.com'],
    ['深圳金融科技', 'company', '金融', 'vip', 'active', '深圳', '陈波', '13600136004', 'chenbo@sz-fintech.com'],
    ['成都软件开发', 'company', '软件', 'important', 'active', '成都', '赵丽', '13500135005', 'zhaoli@cd-soft.com'],
  ];
  const custStmt = db.prepare(`
    INSERT OR IGNORE INTO customers (name,type,industry,level,status,region,contact_name,contact_phone,contact_email,owner_id)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `);
  customers.forEach(c => custStmt.run(...c, uid));

  // 示例线索
  const leads = [
    ['来自官网的询盘', '杭州互联网科技', '周杰', '13111111001', 'zhoujie@hz.com', '官网', 'new'],
    ['参展获取的名片', '苏州科技企业', '吴强', '13111111002', 'wuqiang@sz.com', '展会', 'contacted'],
    ['朋友介绍的客户', '南京医疗设备', '郑华', '13111111003', 'zhenghua@nj.com', '推荐', 'qualified'],
    ['电话营销线索', '武汉化工集团', '孙明', '13111111004', 'sunming@wh.com', '电话', 'new'],
    ['广告投放获取', '西安电子商务', '林静', '13111111005', 'linjing@xa.com', '广告', 'contacted'],
  ];
  const leadStmt = db.prepare(`
    INSERT OR IGNORE INTO leads (title,company,contact_name,contact_phone,contact_email,source,status,owner_id)
    VALUES (?,?,?,?,?,?,?,?)
  `);
  leads.forEach(l => leadStmt.run(...l, uid));

  // 示例商机
  const custIds = db.prepare('SELECT id FROM customers LIMIT 5').all().map(r => r.id);
  if (custIds.length > 0) {
    const opps = [
      ['ERP系统实施项目', custIds[0], '北京科技有限公司', 580000, 'proposal', 60, '2024-06-30'],
      ['云平台迁移服务', custIds[1], '上海贸易集团', 320000, 'negotiation', 80, '2024-05-15'],
      ['数据分析平台', custIds[2], '广州制造股份', 450000, 'prospecting', 20, '2024-08-31'],
      ['移动应用开发', custIds[3], '深圳金融科技', 280000, 'qualification', 40, '2024-07-20'],
      ['安全系统升级', custIds[4], '成都软件开发', 190000, 'closed_won', 100, '2024-03-31'],
    ];
    const oppStmt = db.prepare(`
      INSERT OR IGNORE INTO opportunities (name,customer_id,customer_name,amount,stage,probability,expected_close_date,owner_id)
      VALUES (?,?,?,?,?,?,?,?)
    `);
    opps.forEach(o => oppStmt.run(...o, uid));
  }

  // 示例合同
  const oppIds = db.prepare('SELECT id FROM opportunities LIMIT 3').all().map(r => r.id);
  if (custIds.length > 0 && oppIds.length > 0) {
    const contracts = [
      ['ERP实施合同', 'HT-2024-001', custIds[0], '北京科技有限公司', oppIds[0], 'sales', 580000, '2024-01-15', '2024-02-01', '2024-12-31', 'signed'],
      ['云迁移服务合同', 'HT-2024-002', custIds[1], '上海贸易集团', oppIds[1], 'service', 320000, '2024-02-10', '2024-03-01', '2024-09-30', 'signed'],
      ['数据平台合同', 'HT-2024-003', custIds[2], '广州制造股份', null, 'sales', 450000, '2024-03-20', '2024-04-01', '2025-03-31', 'draft'],
    ];
    const ctStmt = db.prepare(`
      INSERT OR IGNORE INTO contracts (name,contract_no,customer_id,customer_name,opportunity_id,type,amount,sign_date,start_date,end_date,status,owner_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    contracts.forEach(c => ctStmt.run(...c, uid));
  }

  // 示例回款
  const contractIds = db.prepare("SELECT id FROM contracts WHERE status = 'signed' LIMIT 2").all().map(r => r.id);
  if (contractIds.length > 0) {
    const payments = [
      ['SK-2024-001', contractIds[0], 'ERP实施合同', custIds[0], '北京科技有限公司', 174000, '2024-02-15', 'transfer', 'confirmed'],
      ['SK-2024-002', contractIds[0], 'ERP实施合同', custIds[0], '北京科技有限公司', 232000, '2024-06-15', 'transfer', 'confirmed'],
      ['SK-2024-003', contractIds[1], '云迁移服务合同', custIds[1], '上海贸易集团', 160000, '2024-03-15', 'check', 'confirmed'],
      ['SK-2024-004', contractIds[1], '云迁移服务合同', custIds[1], '上海贸易集团', 96000, '2024-06-30', 'transfer', 'pending'],
    ];
    const pmStmt = db.prepare(`
      INSERT OR IGNORE INTO payments (payment_no,contract_id,contract_name,customer_id,customer_name,amount,payment_date,payment_method,status,creator_id)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `);
    payments.forEach(p => pmStmt.run(...p, uid));
  }

  // 示例项目
  if (custIds.length > 0) {
    const projects = [
      ['ERP系统实施', 'PRJ-2024-001', custIds[0], '北京科技有限公司', uid, '2024-02-01', '2024-12-31', 580000, 'in_progress', 65],
      ['云平台迁移', 'PRJ-2024-002', custIds[1], '上海贸易集团', uid, '2024-03-01', '2024-09-30', 320000, 'in_progress', 40],
      ['数据分析平台', 'PRJ-2024-003', custIds[2], '广州制造股份', uid, '2024-04-01', '2025-03-31', 450000, 'planning', 0],
    ];
    const prjStmt = db.prepare(`
      INSERT OR IGNORE INTO projects (name,project_no,customer_id,customer_name,manager_id,start_date,end_date,budget,status,progress)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `);
    projects.forEach(p => prjStmt.run(...p));

    // 示例任务
    const prjIds = db.prepare('SELECT id FROM projects LIMIT 2').all().map(r => r.id);
    if (prjIds.length > 0) {
      const tasks = [
        [prjIds[0], '需求调研与分析', uid, '2024-02-01', '2024-02-28', 'completed', 100],
        [prjIds[0], '系统设计与架构', uid, '2024-03-01', '2024-03-31', 'completed', 100],
        [prjIds[0], '核心模块开发', uid, '2024-04-01', '2024-07-31', 'in_progress', 60],
        [prjIds[0], '用户测试与验收', uid, '2024-08-01', '2024-10-31', 'todo', 0],
        [prjIds[1], '现状评估', uid, '2024-03-01', '2024-03-15', 'completed', 100],
        [prjIds[1], '迁移方案制定', uid, '2024-03-16', '2024-04-15', 'in_progress', 70],
      ];
      const taskStmt = db.prepare(`
        INSERT OR IGNORE INTO project_tasks (project_id,name,assignee_id,start_date,due_date,status,progress)
        VALUES (?,?,?,?,?,?,?)
      `);
      tasks.forEach(t => taskStmt.run(...t));
    }
  }
}

if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;
