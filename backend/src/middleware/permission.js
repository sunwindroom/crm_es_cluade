const { getDb } = require('../db/connection');

// 角色层级（销售体系）
const SALES_HIERARCHY = { '总裁': 4, '营销副总裁': 3, '销售经理': 2, '销售': 1 };

// 可查看所有数据的角色
const CAN_VIEW_ALL_ROLES = ['系统管理员', '总裁', '营销副总裁', '技术副总裁', '财务', '商务'];

// 可删除的角色
const CAN_DELETE_ROLES = ['系统管理员'];

// 可编辑任意记录的角色
const CAN_EDIT_ANY_ROLES = ['系统管理员', '总裁', '营销副总裁'];

// 可转化线索的角色
const CAN_CONVERT_LEAD_ROLES = ['系统管理员', '总裁', '营销副总裁'];

// 可新建项目的角色
const CAN_CREATE_PROJECT_ROLES = ['系统管理员', '总裁', '技术副总裁', '营销副总裁', '商务'];

// 可指派项目经理的角色
const CAN_ASSIGN_PM_ROLES = ['系统管理员', '技术副总裁'];

// 可查看所有项目的角色
const CAN_VIEW_ALL_PROJECTS = ['系统管理员', '总裁', '技术副总裁', '营销副总裁', '商务', '财务'];

// 可创建合同的角色
const CAN_CREATE_CONTRACT_ROLES = ['系统管理员', '总裁', '技术副总裁', '营销副总裁', '商务'];

// 离职移交操作角色
const CAN_TRANSFER_ROLES = ['系统管理员', '总裁', '营销副总裁', '技术副总裁'];

// 可确认回款的角色
const CAN_CONFIRM_PAYMENT_ROLES = ['系统管理员', '财务'];

/**
 * 获取用户所有下级的ID列表
 */
function getSubordinateIds(db, userId) {
  const ids = [];
  const queue = [userId];
  while (queue.length > 0) {
    const id = queue.shift();
    const subs = db.prepare('SELECT id FROM users WHERE manager_id = ? AND status = 1').all(id);
    subs.forEach(s => { ids.push(s.id); queue.push(s.id); });
  }
  return ids;
}

/**
 * 构建数据可见性的WHERE条件
 * @returns { where: string, params: array }
 */
function buildVisibilityFilter(roleName, userId, db, ownerField = 'owner_id') {
  if (CAN_VIEW_ALL_ROLES.includes(roleName)) {
    return { where: '1=1', params: [] };
  }
  // 销售经理可以看自己和下级的数据
  const subIds = getSubordinateIds(db, userId);
  const allIds = [userId, ...subIds];
  const placeholders = allIds.map(() => '?').join(',');
  return { where: `${ownerField} IN (${placeholders})`, params: allIds };
}

module.exports = {
  CAN_VIEW_ALL_ROLES,
  CAN_DELETE_ROLES,
  CAN_EDIT_ANY_ROLES,
  CAN_CONVERT_LEAD_ROLES,
  CAN_CREATE_PROJECT_ROLES,
  CAN_ASSIGN_PM_ROLES,
  CAN_VIEW_ALL_PROJECTS,
  CAN_CREATE_CONTRACT_ROLES,
  CAN_TRANSFER_ROLES,
  CAN_CONFIRM_PAYMENT_ROLES,
  SALES_HIERARCHY,
  getSubordinateIds,
  buildVisibilityFilter,

  canDelete: (roleName) => CAN_DELETE_ROLES.includes(roleName),
  canEditAny: (roleName) => CAN_EDIT_ANY_ROLES.includes(roleName),
  canConvertLead: (roleName) => CAN_CONVERT_LEAD_ROLES.includes(roleName),
  canCreateProject: (roleName) => CAN_CREATE_PROJECT_ROLES.includes(roleName),
  canAssignPM: (roleName) => CAN_ASSIGN_PM_ROLES.includes(roleName),
  canViewAllProjects: (roleName) => CAN_VIEW_ALL_PROJECTS.includes(roleName),
  canCreateContract: (roleName) => CAN_CREATE_CONTRACT_ROLES.includes(roleName),
  canTransfer: (roleName) => CAN_TRANSFER_ROLES.includes(roleName),
  canConfirmPayment: (roleName) => CAN_CONFIRM_PAYMENT_ROLES.includes(roleName),
  canViewAll: (roleName) => CAN_VIEW_ALL_ROLES.includes(roleName),
};
