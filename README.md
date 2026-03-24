# CRM 客户关系管理系统

一套完整的企业级 CRM 系统，覆盖线索→客户→商机→项目→合同→回款全流程。

## 技术栈

- **前端**：React 18 + Vite + Tailwind CSS + Recharts + Zustand
- **后端**：Node.js + Express + better-sqlite3 + JWT
- **数据库**：SQLite（内嵌，无需单独安装）

## 快速启动

### 启动后端
```bash
cd backend
npm install
cp .env.example .env
npm start
```

### 启动前端
```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173，使用 `admin` / `Admin@123` 登录。

## 功能模块

| 模块 | 功能 |
|------|------|
| 🎯 线索管理 | 线索录入、跟踪、一键转化为客户 |
| 👥 客户管理 | 客户档案、多联系人、跟进记录 |
| 💡 商机管理 | 销售漏斗、看板视图、阶段推进 |
| 📁 项目管理 | 项目跟踪、任务分配、进度管理 |
| 📄 合同管理 | 合同全流程、审批、回款计划 |
| 💰 回款管理 | 回款登记、财务确认、统计分析 |
| 📈 报表统计 | 销售/客户/回款/员工多维分析 |
| ⚙️ 系统管理 | 用户、角色、权限精细化配置 |

## 文档

- [产品功能说明文档](docs/产品功能说明文档.md)
- [安装部署文档](docs/安装部署文档.md)
