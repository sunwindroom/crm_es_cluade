const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './crm.db';

function initDatabase() {
  const db = new Database(path.resolve(DB_PATH));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- ==============================
    -- 角色与用户
    -- ==============================
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      permissions TEXT DEFAULT '{}',
      level INTEGER DEFAULT 0,
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
      manager_id INTEGER REFERENCES users(id),
      status INTEGER DEFAULT 1,
      resigned INTEGER DEFAULT 0,
      resigned_at DATETIME,
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
      assigned_by INTEGER REFERENCES users(id),
      converted INTEGER DEFAULT 0,
      converted_at DATETIME,
      converted_customer_id INTEGER,
      converted_opportunity_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lead_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      content TEXT NOT NULL,
      followup_type TEXT DEFAULT 'call',
      followup_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      next_followup_time DATETIME,
      creator_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      assigned_by INTEGER REFERENCES users(id),
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
      assigned_by INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'open',
      lost_reason TEXT,
      converted_project_id INTEGER,
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
      sales_id INTEGER REFERENCES users(id),
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

    CREATE TABLE IF NOT EXISTS project_milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      planned_date DATE,
      actual_date DATE,
      status TEXT DEFAULT 'pending',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_workhours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      week_start DATE NOT NULL,
      hours REAL DEFAULT 0,
      content TEXT,
      hourly_rate REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      project_id INTEGER REFERENCES projects(id),
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
    CREATE TABLE IF NOT EXISTS payment_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      plan_no INTEGER,
      name TEXT,
      amount REAL NOT NULL,
      planned_date DATE NOT NULL,
      status TEXT DEFAULT 'pending',
      actual_payment_id INTEGER REFERENCES payments(id),
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_no TEXT UNIQUE,
      contract_id INTEGER REFERENCES contracts(id),
      contract_name TEXT,
      payment_plan_id INTEGER REFERENCES payment_plans(id),
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

    -- ==============================
    -- 离职移交
    -- ==============================
    CREATE TABLE IF NOT EXISTS resignation_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resigned_user_id INTEGER NOT NULL REFERENCES users(id),
      receiver_user_id INTEGER NOT NULL REFERENCES users(id),
      operator_id INTEGER REFERENCES users(id),
      transfer_type TEXT,
      record_count INTEGER DEFAULT 0,
      notes TEXT,
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

  // ==============================
  // 数据库迁移：补充旧版本缺失的字段和表
  // ==============================
  function columnExists(table, column) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    return cols.some(c => c.name === column);
  }
  function tableExists(table) {
    return !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
  }
  function addColumnIfMissing(table, column, definition) {
    if (tableExists(table) && !columnExists(table, column)) {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`  ✔ 迁移: ${table}.${column} 已添加`);
      } catch(e) { /* ignore */ }
    }
  }

  // roles 表迁移
  addColumnIfMissing('roles', 'level', 'INTEGER DEFAULT 0');

  // users 表迁移
  addColumnIfMissing('users', 'manager_id', 'INTEGER REFERENCES users(id)');
  addColumnIfMissing('users', 'resigned', 'INTEGER DEFAULT 0');
  addColumnIfMissing('users', 'resigned_at', 'DATETIME');

  // leads 表迁移
  addColumnIfMissing('leads', 'assigned_by', 'INTEGER REFERENCES users(id)');
  addColumnIfMissing('leads', 'converted_opportunity_id', 'INTEGER');

  // customers 表迁移
  addColumnIfMissing('customers', 'assigned_by', 'INTEGER REFERENCES users(id)');

  // opportunities 表迁移
  addColumnIfMissing('opportunities', 'assigned_by', 'INTEGER REFERENCES users(id)');
  addColumnIfMissing('opportunities', 'converted_project_id', 'INTEGER');

  // projects 表迁移
  addColumnIfMissing('projects', 'sales_id', 'INTEGER REFERENCES users(id)');
  addColumnIfMissing('projects', 'opportunity_id', 'INTEGER REFERENCES opportunities(id)');

  // contracts 表迁移
  addColumnIfMissing('contracts', 'project_id', 'INTEGER REFERENCES projects(id)');

  // payments 表迁移
  addColumnIfMissing('payments', 'payment_plan_id', 'INTEGER REFERENCES payment_plans(id)');

  // payment_plans 表迁移
  addColumnIfMissing('payment_plans', 'name', 'TEXT');

  // 创建新表（若不存在）
  if (!tableExists('lead_followups')) {
    db.exec(`CREATE TABLE lead_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      content TEXT NOT NULL,
      followup_type TEXT DEFAULT 'call',
      followup_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      next_followup_time DATETIME,
      creator_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('  ✔ 迁移: lead_followups 表已创建');
  }
  if (!tableExists('project_milestones')) {
    db.exec(`CREATE TABLE project_milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      planned_date DATE,
      actual_date DATE,
      status TEXT DEFAULT 'pending',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('  ✔ 迁移: project_milestones 表已创建');
  }
  if (!tableExists('project_workhours')) {
    db.exec(`CREATE TABLE project_workhours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      week_start DATE NOT NULL,
      hours REAL DEFAULT 0,
      content TEXT,
      hourly_rate REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('  ✔ 迁移: project_workhours 表已创建');
  }
  if (!tableExists('resignation_transfers')) {
    db.exec(`CREATE TABLE resignation_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resigned_user_id INTEGER NOT NULL REFERENCES users(id),
      receiver_user_id INTEGER NOT NULL REFERENCES users(id),
      operator_id INTEGER REFERENCES users(id),
      transfer_type TEXT,
      record_count INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('  ✔ 迁移: resignation_transfers 表已创建');
  }

  // 更新旧角色的 level 字段（若为 0 则按名称补全）
  const updateLevel = db.prepare(`UPDATE roles SET level=? WHERE name=? AND (level IS NULL OR level=0)`);
  updateLevel.run(100, '系统管理员');
  updateLevel.run(90,  '总裁');
  updateLevel.run(80,  '营销副总裁');
  updateLevel.run(80,  '技术副总裁');
  updateLevel.run(70,  '财务');
  updateLevel.run(70,  '商务');
  updateLevel.run(60,  '销售经理');
  updateLevel.run(40,  '销售');

  // ==============================
  // 初始化角色 (level越高权限越大)
  // ==============================
  const roleStmt = db.prepare(`INSERT OR IGNORE INTO roles (name, description, permissions, level) VALUES (?, ?, ?, ?)`);
  
  const allPerms = JSON.stringify({ leads:['read','write','delete'], customers:['read','write','delete'], opportunities:['read','write','delete'], projects:['read','write','delete'], contracts:['read','write','delete'], payments:['read','write','delete'], reports:['read'], system:['read','write','delete'] });
  
  roleStmt.run('系统管理员', '拥有所有权限', allPerms, 100);
  roleStmt.run('总裁', '公司总裁，查看和管理所有业务', JSON.stringify({ leads:['read','write'], customers:['read','write'], opportunities:['read','write'], projects:['read','write'], contracts:['read','write'], payments:['read','write'], reports:['read'] }), 90);
  roleStmt.run('营销副总裁', '营销副总裁，管理销售线索客户商机', JSON.stringify({ leads:['read','write'], customers:['read','write'], opportunities:['read','write'], contracts:['read','write'], payments:['read'], reports:['read'] }), 80);
  roleStmt.run('技术副总裁', '技术副总裁，管理项目合同', JSON.stringify({ leads:['read'], customers:['read'], opportunities:['read'], projects:['read','write'], contracts:['read','write'], payments:['read'], reports:['read'] }), 80);
  roleStmt.run('销售经理', '销售经理，管理下级销售', JSON.stringify({ leads:['read','write'], customers:['read','write'], opportunities:['read','write'], contracts:['read'], payments:['read'], reports:['read'] }), 60);
  roleStmt.run('销售', '一线销售人员', JSON.stringify({ leads:['read','write'], customers:['read','write'], opportunities:['read','write'], contracts:['read'], payments:['read'] }), 40);
  roleStmt.run('财务', '财务人员，管理回款', JSON.stringify({ leads:['read'], customers:['read'], opportunities:['read'], projects:['read'], contracts:['read'], payments:['read','write'], reports:['read'] }), 70);
  roleStmt.run('商务', '商务人员', JSON.stringify({ leads:['read'], customers:['read'], opportunities:['read'], projects:['read'], contracts:['read','write'], payments:['read'], reports:['read'] }), 70);

  // 初始化管理员
  const adminPwd = bcrypt.hashSync('Admin@123', 10);
  const adminRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('系统管理员');
  db.prepare(`INSERT OR IGNORE INTO users (username, password, real_name, email, role_id, department, position) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('admin', adminPwd, '系统管理员', 'admin@crm.com', adminRole?.id, '信息技术部', '系统管理员');

  insertSampleData(db);
  console.log('✅ 数据库初始化完成');
  db.close();
}

function insertSampleData(db) {
  const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminUser) return;
  
  // 创建示例用户
  const presidentRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('总裁');
  const mktVpRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('营销副总裁');
  const techVpRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('技术副总裁');
  const smRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('销售经理');
  const salesRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('销售');
  const financeRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('财务');

  const userStmt = db.prepare(`INSERT OR IGNORE INTO users (username, password, real_name, email, role_id, department, position, manager_id) VALUES (?,?,?,?,?,?,?,?)`);
  const pwd = bcrypt.hashSync('Admin@123', 10);
  
  userStmt.run('president', pwd, '王总裁', 'president@crm.com', presidentRole?.id, '管理层', '总裁', null);
  const president = db.prepare('SELECT id FROM users WHERE username=?').get('president');
  
  userStmt.run('mkt_vp', pwd, '李营销VP', 'mktvp@crm.com', mktVpRole?.id, '销售部', '营销副总裁', president?.id);
  const mktVp = db.prepare('SELECT id FROM users WHERE username=?').get('mkt_vp');
  
  userStmt.run('tech_vp', pwd, '张技术VP', 'techvp@crm.com', techVpRole?.id, '技术部', '技术副总裁', president?.id);
  
  userStmt.run('sm001', pwd, '陈销售经理', 'sm001@crm.com', smRole?.id, '销售部', '销售经理', mktVp?.id);
  const sm001 = db.prepare('SELECT id FROM users WHERE username=?').get('sm001');
  
  userStmt.run('sales001', pwd, '赵销售', 'sales001@crm.com', salesRole?.id, '销售部', '销售', sm001?.id);
  userStmt.run('sales002', pwd, '孙销售', 'sales002@crm.com', salesRole?.id, '销售部', '销售', sm001?.id);
  userStmt.run('finance001', pwd, '周财务', 'finance@crm.com', financeRole?.id, '财务部', '财务专员', null);
  
  const sales001 = db.prepare('SELECT id FROM users WHERE username=?').get('sales001');
  const uid = adminUser.id;
  const ownerId = sales001?.id || uid;

  // 示例客户
  const custStmt = db.prepare(`INSERT OR IGNORE INTO customers (name,type,industry,level,status,region,contact_name,contact_phone,contact_email,owner_id) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const custData = [
    ['北京科技有限公司','company','互联网','vip','active','北京','张明','13800138001','zhangming@bj-tech.com'],
    ['上海贸易集团','company','贸易','important','active','上海','李红','13900139002','lihong@sh-trade.com'],
    ['广州制造股份','company','制造业','normal','active','广州','王刚','13700137003','wanggang@gz-mfg.com'],
    ['深圳金融科技','company','金融','vip','active','深圳','陈波','13600136004','chenbo@sz-fintech.com'],
    ['成都软件开发','company','软件','important','active','成都','赵丽','13500135005','zhaoli@cd-soft.com'],
  ];
  custData.forEach(c => custStmt.run(...c, ownerId));

  // 示例线索
  const leadStmt = db.prepare(`INSERT OR IGNORE INTO leads (title,company,contact_name,contact_phone,contact_email,source,status,owner_id) VALUES (?,?,?,?,?,?,?,?)`);
  [
    ['来自官网的询盘','杭州互联网科技','周杰','13111111001','zhoujie@hz.com','官网','new'],
    ['参展获取的名片','苏州科技企业','吴强','13111111002','wuqiang@sz.com','展会','contacted'],
    ['朋友介绍的客户','南京医疗设备','郑华','13111111003','zhenghua@nj.com','推荐','qualified'],
    ['电话营销线索','武汉化工集团','孙明','13111111004','sunming@wh.com','电话','new'],
    ['广告投放获取','西安电子商务','林静','13111111005','linjing@xa.com','广告','contacted'],
  ].forEach(l => leadStmt.run(...l, ownerId));

  const custIds = db.prepare('SELECT id FROM customers LIMIT 5').all().map(r => r.id);
  if (custIds.length < 1) return;

  // 示例商机
  const oppStmt = db.prepare(`INSERT OR IGNORE INTO opportunities (name,customer_id,customer_name,amount,stage,probability,expected_close_date,owner_id) VALUES (?,?,?,?,?,?,?,?)`);
  [
    ['ERP系统实施项目',custIds[0],'北京科技有限公司',580000,'proposal',60,'2025-06-30'],
    ['云平台迁移服务',custIds[1],'上海贸易集团',320000,'negotiation',80,'2025-05-15'],
    ['数据分析平台',custIds[2],'广州制造股份',450000,'prospecting',20,'2025-08-31'],
    ['移动应用开发',custIds[3],'深圳金融科技',280000,'qualification',40,'2025-07-20'],
    ['安全系统升级',custIds[4],'成都软件开发',190000,'closed_won',100,'2025-03-31'],
  ].forEach(o => oppStmt.run(...o, ownerId));

  const oppIds = db.prepare('SELECT id FROM opportunities LIMIT 3').all().map(r => r.id);

  // 示例合同
  const ctStmt = db.prepare(`INSERT OR IGNORE INTO contracts (name,contract_no,customer_id,customer_name,opportunity_id,type,amount,sign_date,start_date,end_date,status,owner_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  if (oppIds.length > 0) {
    ctStmt.run('ERP实施合同','HT-2025-001',custIds[0],'北京科技有限公司',oppIds[0],'sales',580000,'2025-01-15','2025-02-01','2025-12-31','signed',uid);
    ctStmt.run('云迁移服务合同','HT-2025-002',custIds[1],'上海贸易集团',oppIds[1],'service',320000,'2025-02-10','2025-03-01','2025-09-30','signed',uid);
  }

  // 示例回款计划
  const contractIds = db.prepare("SELECT id FROM contracts WHERE status='signed' LIMIT 2").all().map(r => r.id);
  const planStmt = db.prepare(`INSERT OR IGNORE INTO payment_plans (contract_id,plan_no,name,amount,planned_date) VALUES (?,?,?,?,?)`);
  if (contractIds.length > 0) {
    planStmt.run(contractIds[0],1,'首款（30%）',174000,'2025-02-15');
    planStmt.run(contractIds[0],2,'中期款（40%）',232000,'2025-06-15');
    planStmt.run(contractIds[0],3,'尾款（30%）',174000,'2025-12-01');
    if (contractIds.length > 1) {
      planStmt.run(contractIds[1],1,'预付款（50%）',160000,'2025-03-15');
      planStmt.run(contractIds[1],2,'结款（50%）',160000,'2025-08-30');
    }
  }

  // 示例回款
  const pmStmt = db.prepare(`INSERT OR IGNORE INTO payments (payment_no,contract_id,contract_name,customer_id,customer_name,amount,payment_date,payment_method,status,creator_id) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  if (contractIds.length > 0) {
    pmStmt.run('SK-2025-001',contractIds[0],'ERP实施合同',custIds[0],'北京科技有限公司',174000,'2025-02-15','transfer','confirmed',uid);
    pmStmt.run('SK-2025-002',contractIds[0],'ERP实施合同',custIds[0],'北京科技有限公司',232000,'2025-06-15','transfer','pending',uid);
    if (contractIds.length > 1) {
      pmStmt.run('SK-2025-003',contractIds[1],'云迁移服务合同',custIds[1],'上海贸易集团',160000,'2025-03-15','check','confirmed',uid);
    }
  }
  // 更新已付回款计划状态
  const p1 = db.prepare("SELECT id FROM payments WHERE payment_no='SK-2025-001'").get();
  const p3 = db.prepare("SELECT id FROM payments WHERE payment_no='SK-2025-003'").get();
  const plans = db.prepare('SELECT id FROM payment_plans LIMIT 10').all();
  if (plans.length > 0 && p1) db.prepare("UPDATE payment_plans SET status='paid', actual_payment_id=? WHERE id=?").run(p1.id, plans[0].id);
  if (plans.length > 3 && p3) db.prepare("UPDATE payment_plans SET status='paid', actual_payment_id=? WHERE id=?").run(p3.id, plans[3].id);

  // 示例项目
  const techVp = db.prepare("SELECT id FROM users WHERE username='tech_vp'").get();
  const prjStmt = db.prepare(`INSERT OR IGNORE INTO projects (name,project_no,customer_id,customer_name,manager_id,start_date,end_date,budget,status,progress) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  prjStmt.run('ERP系统实施','PRJ-2025-001',custIds[0],'北京科技有限公司',techVp?.id||uid,'2025-02-01','2025-12-31',580000,'in_progress',45);
  prjStmt.run('云平台迁移','PRJ-2025-002',custIds[1],'上海贸易集团',techVp?.id||uid,'2025-03-01','2025-09-30',320000,'in_progress',30);

  const prjIds = db.prepare('SELECT id FROM projects LIMIT 2').all().map(r => r.id);
  if (prjIds.length > 0) {
    const msStmt = db.prepare(`INSERT OR IGNORE INTO project_milestones (project_id,name,planned_date,status) VALUES (?,?,?,?)`);
    msStmt.run(prjIds[0],'需求确认完成','2025-02-28','completed');
    msStmt.run(prjIds[0],'系统设计完成','2025-04-30','completed');
    msStmt.run(prjIds[0],'开发完成','2025-09-30','pending');
    msStmt.run(prjIds[0],'验收上线','2025-12-31','pending');

    const taskStmt = db.prepare(`INSERT OR IGNORE INTO project_tasks (project_id,name,assignee_id,start_date,due_date,status,progress) VALUES (?,?,?,?,?,?,?)`);
    taskStmt.run(prjIds[0],'需求调研与分析',uid,'2025-02-01','2025-02-28','completed',100);
    taskStmt.run(prjIds[0],'系统架构设计',uid,'2025-03-01','2025-04-30','completed',100);
    taskStmt.run(prjIds[0],'核心模块开发',uid,'2025-05-01','2025-09-30','in_progress',40);
    taskStmt.run(prjIds[0],'测试与验收',uid,'2025-10-01','2025-12-31','todo',0);

    const memberStmt = db.prepare(`INSERT OR IGNORE INTO project_members (project_id,user_id,role) VALUES (?,?,?)`);
    memberStmt.run(prjIds[0], uid, 'manager');
  }
}

if (require.main === module) { initDatabase(); }
module.exports = initDatabase;
