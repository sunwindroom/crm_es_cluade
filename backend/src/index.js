const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const initDatabase = require('./db/init');
const authRoutes = require('./routes/auth');
const leadsRoutes = require('./routes/leads');
const customersRoutes = require('./routes/customers');
const opportunitiesRoutes = require('./routes/opportunities');
const projectsRoutes = require('./routes/projects');
const contractsRoutes = require('./routes/contracts');
const paymentsRoutes = require('./routes/payments');
const reportsRoutes = require('./routes/reports');
const systemRoutes = require('./routes/system');

const app = express();
const PORT = process.env.PORT || 3001;

initDatabase();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/opportunities', opportunitiesRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/system', systemRoutes);

app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'CRM API 运行正常', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ code: 500, message: '服务器内部错误', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

app.listen(PORT, () => {
  console.log(`🚀 CRM Server running at http://localhost:${PORT}`);
});

module.exports = app;
