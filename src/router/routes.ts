import type { RouteRecordRaw } from 'vue-router'

import { useUserStore } from '@/stores/user'
import { hasPermission } from '@/utils/permission'

export interface AdminRouteMeta {
  title: string
  icon?: string
  permission?: string
  permissions?: string[]
  permissionMode?: 'any' | 'all'
  hidden?: boolean
  keepAlive?: boolean
}

export type AdminRouteRecord = RouteRecordRaw & {
  meta: AdminRouteMeta
  children?: AdminRouteRecord[]
}

function systemRedirect() {
  const permissions = useUserStore().permissions
  if (hasPermission(permissions, 'system:user:read')) return '/system/users'
  if (hasPermission(permissions, 'system:role:read')) return '/system/roles'
  if (hasPermission(permissions, 'system:department:read')) return '/system/departments'
  if (hasPermission(permissions, 'system:data-ownership:transfer')) return '/system/data-ownership'
  if (hasPermission(permissions, 'system:permission:read')) return '/system/permissions'
  if (hasPermission(permissions, 'system:setting:read')) return '/system/settings'
  return '/system/logs'
}

export const adminRoutes: AdminRouteRecord[] = [
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/dashboard/DashboardView.vue'),
    meta: { title: '项目运行概览', icon: 'DataBoard', permission: 'system:overview:read' },
  },
  {
    path: '/system',
    name: 'system',
    redirect: systemRedirect,
    meta: {
      title: '系统管理',
      icon: 'Setting',
      permissions: [
        'system:user:read',
        'system:role:read',
        'system:department:read',
        'system:data-ownership:transfer',
        'system:permission:read',
        'system:setting:read',
        'system:log:read',
        'system:login-log:read',
        'system:retention:cleanup',
      ],
    },
    children: [
      {
        path: 'users',
        name: 'system-users',
        component: () => import('@/views/system/UsersView.vue'),
        meta: { title: '用户管理', icon: 'User', permission: 'system:user:read' },
      },
      {
        path: 'departments',
        name: 'system-departments',
        component: () => import('@/views/system/DepartmentsView.vue'),
        meta: { title: '部门管理', icon: 'OfficeBuilding', permission: 'system:department:read' },
      },
      {
        path: 'roles',
        name: 'system-roles',
        component: () => import('@/views/system/RolesView.vue'),
        meta: { title: '角色管理', icon: 'Lock', permission: 'system:role:read' },
      },
      {
        path: 'data-ownership',
        name: 'system-data-ownership',
        component: () => import('@/views/system/DataOwnershipView.vue'),
        meta: {
          title: '数据归属转交',
          icon: 'Switch',
          permission: 'system:data-ownership:transfer',
        },
      },
      {
        path: 'permissions',
        name: 'system-permissions',
        component: () => import('@/views/system/PermissionsView.vue'),
        meta: { title: '权限列表', icon: 'Key', permission: 'system:permission:read' },
      },
      {
        path: 'settings',
        name: 'system-settings',
        component: () => import('@/views/system/SettingsView.vue'),
        meta: { title: '系统设置', icon: 'Setting', permission: 'system:setting:read' },
      },
      {
        path: 'logs',
        name: 'system-logs',
        component: () => import('@/views/system/LogsView.vue'),
        meta: {
          title: '系统日志',
          icon: 'Document',
          permissions: ['system:log:read', 'system:login-log:read', 'system:retention:cleanup'],
        },
      },
    ],
  },
  {
    path: '/plugins',
    name: 'plugins',
    redirect: '/plugins/definitions',
    meta: {
      title: '插件管理',
      icon: 'Cpu',
      permissions: [
        'plugin:artifact:upload',
        'plugin:runtime:read',
        'plugin:runtime:manage',
        'plugin:service-permission:read',
        'plugin:service-permission:write',
        'plugin:config:read',
        'plugin:account:read',
        'plugin:audit:read',
        'plugin:notification-channel:bind',
      ],
    },
    children: [
      {
        path: 'definitions',
        name: 'plugin-definitions',
        component: () => import('@/views/plugins/DefinitionsView.vue'),
        meta: {
          title: '插件目录',
          icon: 'Box',
          permissions: ['plugin:runtime:read', 'plugin:artifact:upload'],
        },
      },
      {
        path: 'definitions/:pluginId',
        name: 'plugin-definition-detail',
        component: () => import('@/views/plugins/DefinitionDetailView.vue'),
        meta: { title: '插件定义详情', permission: 'plugin:runtime:read', hidden: true },
      },
      {
        path: 'installations',
        name: 'plugin-installations',
        component: () => import('@/views/plugins/InstallationsView.vue'),
        meta: { title: '安装实例', icon: 'Cpu', permission: 'plugin:runtime:read' },
      },
      {
        path: 'installations/:installationId',
        component: () => import('@/views/plugins/InstallationDetailView.vue'),
        redirect: (to) => `/plugins/installations/${String(to.params.installationId)}/overview`,
        meta: {
          title: '安装实例详情',
          permissions: ['plugin:runtime:read', 'plugin:config:read', 'plugin:account:read'],
          hidden: true,
        },
        children: [
          {
            path: 'overview',
            name: 'plugin-installation-overview',
            component: () => import('@/views/plugins/InstallationOverviewView.vue'),
            meta: { title: '运行概览', permission: 'plugin:runtime:read', hidden: true },
          },
          {
            path: 'config',
            name: 'plugin-installation-config',
            component: () => import('@/views/plugins/ConfigView.vue'),
            meta: { title: '实例配置', permission: 'plugin:config:read', hidden: true },
          },
          {
            path: 'accounts',
            name: 'plugin-installation-accounts',
            component: () => import('@/views/plugins/AccountsView.vue'),
            meta: { title: '实例账户', permission: 'plugin:account:read', hidden: true },
          },
          {
            path: 'notification-channels',
            name: 'plugin-installation-notification-channels',
            component: () => import('@/views/plugins/InstallationNotificationChannelsView.vue'),
            meta: {
              title: '主动推送授权',
              permissions: [
                'plugin:runtime:manage',
                'plugin:notification-channel:bind',
                'notification:channel:read',
              ],
              permissionMode: 'all',
              hidden: true,
            },
          },
        ],
      },
      {
        path: 'artifacts',
        redirect: '/plugins/definitions',
        meta: { title: '旧插件上传入口', hidden: true },
      },
      {
        path: 'runtimes',
        redirect: '/plugins/installations',
        meta: { title: '旧运行器入口', hidden: true },
      },
      {
        path: 'runtimes/:pluginId',
        redirect: (to) => ({
          path: '/plugins/installations',
          query: { pluginId: String(to.params.pluginId), legacy: '1' },
        }),
        meta: { title: '旧运行器详情入口', hidden: true },
      },
      {
        path: 'runtimes/:pluginId/config',
        redirect: (to) => ({
          path: '/plugins/installations',
          query: { pluginId: String(to.params.pluginId), legacy: '1' },
        }),
        meta: { title: '旧实例配置入口', hidden: true },
      },
      {
        path: 'runtimes/:pluginId/accounts',
        redirect: (to) => ({
          path: '/plugins/installations',
          query: { pluginId: String(to.params.pluginId), legacy: '1' },
        }),
        meta: { title: '旧实例账户入口', hidden: true },
      },
      {
        path: 'config',
        redirect: (to) => ({
          path: '/plugins/installations',
          query: {
            pluginId: typeof to.query.pluginId === 'string' ? to.query.pluginId : '',
            legacy: '1',
          },
        }),
        meta: { title: '旧配置入口', hidden: true },
      },
      {
        path: 'accounts',
        redirect: (to) => ({
          path: '/plugins/installations',
          query: {
            pluginId: typeof to.query.pluginId === 'string' ? to.query.pluginId : '',
            legacy: '1',
          },
        }),
        meta: { title: '旧账户入口', hidden: true },
      },
      {
        path: 'service-permissions',
        name: 'plugin-service-permissions',
        component: () => import('@/views/plugins/ServicePermissionsView.vue'),
        meta: {
          title: '插件服务权限',
          icon: 'Key',
          permission: 'plugin:service-permission:read',
        },
      },
      {
        path: 'audit-logs',
        name: 'plugin-audit-logs',
        component: () => import('@/views/plugins/AuditLogsView.vue'),
        meta: { title: '插件审计日志', icon: 'Tickets', permission: 'plugin:audit:read' },
      },
      {
        path: 'service-call-logs',
        name: 'plugin-service-call-logs',
        component: () => import('@/views/plugins/ServiceCallLogsView.vue'),
        meta: { title: '插件服务调用日志', icon: 'Tickets', permission: 'plugin:audit:read' },
      },
    ],
  },
  {
    path: '/jobs',
    name: 'jobs-group',
    redirect: '/jobs/list',
    meta: {
      title: 'Job 管理',
      icon: 'Timer',
      permissions: ['job:read', 'job:execution:read'],
    },
    children: [
      {
        path: 'list',
        name: 'jobs',
        component: () => import('@/views/jobs/JobsView.vue'),
        meta: { title: 'Job 列表', icon: 'Timer', permission: 'job:read' },
      },
      {
        path: 'create',
        name: 'job-create',
        component: () => import('@/views/jobs/JobFormView.vue'),
        meta: { title: '创建 Job', permission: 'job:write', hidden: true },
      },
      {
        path: ':id/edit',
        name: 'job-edit',
        component: () => import('@/views/jobs/JobFormView.vue'),
        meta: { title: '编辑 Job', permission: 'job:write', hidden: true },
      },
      {
        path: 'executions',
        name: 'job-executions',
        component: () => import('@/views/jobs/ExecutionsView.vue'),
        meta: {
          title: '执行记录',
          icon: 'Clock',
          permission: 'job:execution:read',
          keepAlive: true,
        },
      },
      {
        path: 'executions/:id',
        name: 'job-execution-detail',
        component: () => import('@/views/jobs/ExecutionDetailView.vue'),
        meta: { title: '执行详情', permission: 'job:execution:read', hidden: true },
      },
    ],
  },
  {
    path: '/notifications',
    name: 'notifications',
    redirect: '/notifications/channels',
    meta: {
      title: '通知中心',
      icon: 'Bell',
      permissions: [
        'notification:channel:read',
        'notification:rule:read',
        'notification:history:read',
      ],
    },
    children: [
      {
        path: 'channels',
        name: 'notification-channels',
        component: () => import('@/views/notifications/ChannelsView.vue'),
        meta: { title: '通知渠道', icon: 'Bell', permission: 'notification:channel:read' },
      },
      {
        path: 'rules',
        name: 'notification-rules',
        component: () => import('@/views/notifications/RulesView.vue'),
        meta: { title: '通知规则', icon: 'SetUp', permission: 'notification:rule:read' },
      },
      {
        path: 'history',
        name: 'notification-history',
        component: () => import('@/views/notifications/HistoryView.vue'),
        meta: { title: '发送历史', icon: 'MessageBox', permission: 'notification:history:read' },
      },
    ],
  },
]
