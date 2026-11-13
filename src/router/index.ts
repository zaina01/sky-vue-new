import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import AdminLayout from '@/layouts/AdminLayout.vue'
import { setupRouterGuards } from './guards'
import { adminRoutes } from './routes'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/LoginView.vue'),
    meta: { public: true, title: '登录', hidden: true },
  },
  {
    path: '/init-admin',
    name: 'InitAdmin',
    component: () => import('@/views/login/InitAdmin.vue'),
    meta: { public: true, title: '初始化管理员', hidden: true },
  },
  {
    path: '/',
    component: AdminLayout,
    redirect: '/dashboard',
    children: adminRoutes,
  },
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('@/views/error/ForbiddenView.vue'),
    meta: { public: true, title: '无权限', hidden: true },
  },
  {
    path: '/404',
    name: 'not-found',
    component: () => import('@/views/error/NotFoundView.vue'),
    meta: { public: true, title: '页面不存在', hidden: true },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/404',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

setupRouterGuards(router)

export default router
