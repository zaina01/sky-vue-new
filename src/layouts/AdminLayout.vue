<script setup lang="ts">
import { ArrowDown, Fold, SwitchButton } from '@element-plus/icons-vue'
import * as ElementPlusIcons from '@element-plus/icons-vue'
import { computed, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { usePermissionStore } from '@/stores/permission'
import { useUserStore } from '@/stores/user'

const appStore = useAppStore()
const authStore = useAuthStore()
const permissionStore = usePermissionStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const activeMenu = computed(() => route.path)
const breadcrumbs = computed(() => route.matched.filter((item) => item.meta.title))
const iconMap = ElementPlusIcons as unknown as Record<string, Component>

function menuIcon(icon?: string) {
  return icon ? iconMap[icon] : undefined
}

function logout() {
  authStore.logout()
  router.replace('/login')
}
</script>

<template>
  <el-container class="admin-layout">
    <el-aside :width="appStore.sidebarCollapsed ? '76px' : '248px'" class="admin-sidebar">
      <div class="admin-brand">
        <div class="admin-brand__mark">S</div>
        <div v-if="!appStore.sidebarCollapsed">
          <strong>Sky Scheduler</strong>
          <span>Plugin Ops Console</span>
        </div>
      </div>

      <el-scrollbar>
        <el-menu
          router
          :collapse="appStore.sidebarCollapsed"
          :default-active="activeMenu"
          background-color="transparent"
          text-color="#9ca3af"
          active-text-color="#ffffff"
        >
          <template v-for="menu in permissionStore.menus" :key="menu.path">
            <el-sub-menu v-if="menu.children?.length" :index="menu.path">
              <template #title>
                <el-icon v-if="menuIcon(menu.meta.icon)">
                  <component :is="menuIcon(menu.meta.icon)" />
                </el-icon>
                <span>{{ menu.meta.title }}</span>
              </template>
              <el-menu-item
                v-for="child in menu.children"
                :key="child.path"
                :index="`${menu.path}/${child.path}`"
              >
                <el-icon v-if="menuIcon(child.meta.icon)">
                  <component :is="menuIcon(child.meta.icon)" />
                </el-icon>
                <template #title>{{ child.meta.title }}</template>
              </el-menu-item>
            </el-sub-menu>
            <el-menu-item v-else :index="menu.path">
              <el-icon v-if="menuIcon(menu.meta.icon)">
                <component :is="menuIcon(menu.meta.icon)" />
              </el-icon>
              <template #title>{{ menu.meta.title }}</template>
            </el-menu-item>
          </template>
        </el-menu>
      </el-scrollbar>
    </el-aside>

    <el-container>
      <el-header class="admin-header">
        <div class="admin-header__left">
          <el-button :icon="Fold" circle text @click="appStore.toggleSidebar" />
          <el-breadcrumb separator="/">
            <el-breadcrumb-item v-for="item in breadcrumbs" :key="item.path">
              {{ item.meta.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <el-dropdown trigger="click" @command="logout">
          <button class="user-entry" type="button">
            <span>{{ userStore.displayName }}</span>
            <el-icon><ArrowDown /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout" :icon="SwitchButton">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <el-main class="admin-main">
        <RouterView v-slot="{ Component: routeComponent, route: currentRoute }">
          <KeepAlive>
            <component :is="routeComponent" v-if="currentRoute.meta.keepAlive" />
          </KeepAlive>
          <component :is="routeComponent" v-if="!currentRoute.meta.keepAlive" />
        </RouterView>
      </el-main>
    </el-container>
  </el-container>
</template>
