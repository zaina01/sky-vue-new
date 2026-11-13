# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server on port 5173. `/api` is proxied to `http://localhost:8080`.
- `npm run type-check` — run `vue-tsc -b`.
- `npm run lint` — run ESLint across the repo.
- `npm run build` — run type checking and create the Vite production build.
- `npm run format` — format files with Prettier.
- `npm run format:check` — verify Prettier formatting.
- `npm run preview` — preview the production build.

There is currently no test runner configured in `package.json`, so there is no single-test command.

## Application architecture

This is a Vue 3 + TypeScript + Vite admin console using Element Plus, Pinia, Vue Router, Axios, and ECharts. The app entry is `src/main.ts`, which installs Pinia and the router, imports Element Plus programmatic styles for messages/message boxes, and loads global CSS from `src/style.css`.

Routing is split between `src/router/index.ts`, `src/router/routes.ts`, and `src/router/guards.ts`:

- Public routes are `/login` and `/init-admin`.
- Authenticated routes render under `src/layouts/AdminLayout.vue`.
- Admin menu metadata lives in `adminRoutes`; route `meta.permission` and `meta.permissions` use backend permission names directly.
- `setupRouterGuards()` redirects unauthenticated users to `/login`, loads `/api/user/me` through the user store, and enforces route permissions.
- Sidebar menus are generated from the route tree by `src/stores/permission.ts`, preserving parent groups if any child route is allowed.

State is managed with Pinia stores in `src/stores/`:

- `auth.ts` owns the JWT token and local login/logout state.
- `user.ts` loads the current user profile and exposes backend permissions.
- `permission.ts` filters route/menu visibility and provides `can()` for permission checks.
- `app.ts` owns layout/global UI state such as sidebar and global loading.

## API layer and backend protocol

API modules live in `src/api/`. Business modules call helper functions exported from `src/api/request.ts` through `src/api/http.ts`.

Important request conventions:

- Development uses an empty Axios `baseURL`; endpoints should include the full `/api/...` path.
- Vite proxies `/api` to `http://localhost:8080` in `vite.config.ts`.
- The backend response envelope is `ApiResponse<T>` from `src/types/common.ts` with `{ code, msg, data }`.
- `request.ts` unwraps successful responses so view/API callers receive `data` directly.
- Only backend codes `401001` and `401002` clear the token and redirect to login.
- `403001` redirects to `/403` without clearing the token.
- Login `400001` and init-admin/register `409001` are handled locally by their pages to avoid duplicate global messages.

For paginated endpoints, use `PageResponse<T>` and `PageQuery` from `src/types/common.ts`. Most list pages use `src/composables/usePagination.ts`; reusable table pagination markup lives in `src/components/common/PaginationTable.vue`.

## Permissions and UI actions

Use backend permission strings in route metadata and `PermissionGuard` wrappers. Existing modules use permissions such as `system:user:read`, `plugin:runtime:manage`, `job:write`, and `notification:channel:test`.

`src/utils/permission.ts` treats an array of route permissions as “any of these permissions is enough.” Keep that behavior when adding grouped menu routes.

## JSON and schema-driven forms

`src/components/JsonEditor/JsonEditor.vue` is the shared JSON editor. It accepts a string `v-model` and emits `valid-change`; pages should disable saving when JSON is invalid.

Plugin config/account forms are schema-driven:

- Shared schema helpers are in `src/utils/pluginSchemaForm.ts`.
- Reusable dynamic form component is `src/components/plugins/PluginSchemaForm.vue`.
- `ConfigView.vue` and `AccountsView.vue` prefer server-provided schema forms and fall back to advanced JSON editing if no schema is available or JSON parsing fails.
- Config schemas can arrive as `schema` or `configSchema`; account schemas can arrive as `schema` or `accountSchema`.
- Account schema handling preserves unknown JSON fields, keeps readonly values in edit mode, treats sensitive fields left blank as unchanged, and ignores all-asterisk masked sensitive placeholders.

## Module layout

Feature pages are under `src/views/`:

- `login/` for login and first-admin initialization.
- `system/` for users, roles, permissions, and logs.
- `plugins/` for artifact upload, plugin list/runtime actions, plugin details, config, accounts, and audit logs.
- `jobs/` for job list/forms, manual run, pause/resume, cron preview, executions, and execution detail.
- `notifications/` for channels, rules, history, retry, and test send flows.

Types are grouped by backend domain in `src/types/` and API wrappers mirror those domains in `src/api/`.

## Current Vite details

Element Plus is configured for on-demand component imports using `unplugin-auto-import` and `unplugin-vue-components` with `ElementPlusResolver()` in `vite.config.ts`. The `/api` proxy has extended timeouts for large plugin artifact uploads.
