# 前后端联调与账户分组验收

后端协议来源：`D:/Files/java/sky-new/docs/frontend-backend-integration.md`。本次前端新增账户分组管理、单个和批量移动、分组筛选与导出、导入逐行结果，以及 CHECKBOX 数组展示。

## 前端行为

- 分组按安装实例隔离。固定分组列显示名称或“未分组”；筛选支持全部、未分组和指定组，组合账户 ID、显示名称及启停状态。
- `plugin:account:read` 控制读取和分组筛选，`plugin:account:write` 控制创建、重命名、删除和移动。分组加载失败提供重试，账户列表仍可读取。
- 新建账户可指定初始组；编辑账户保留现有组，分组变更走独立 PATCH。移出组显式提交 `groupId:null`。
- 删除分组会保留账户并移为未分组，删除当前筛选组后恢复全部。分组数量包含启用及停用账户。
- 批量移动显示每项失败原因，部分成功后刷新数量并恢复当前页可见失败项的选择；筛选页清空时回退到有效页。
- 导出弹窗复制打开时的筛选条件，可调整启停状态。CSV/XLSX 列结构不增加分组列。
- LIST、MULTI_SELECT、OBJECT_LIST 文件单元格使用严格 JSON 数组，MAP 使用 JSON 对象；数组空单元格为 `[]`，MAP 空单元格为 `{}`。标量字段保留文本单元格协议。
- 导入页面显示行号、账户 ID、成功/失败、创建/更新及错误原因；新账户默认未分组，覆盖已有账户保留分组。

## 启动

优先复用现有 `sky_new_frontend_it` 数据库及后端 `sky-job/build/frontend-integration` 插件产物。按后端文档设置 `SKY_DB_*`、HTTP 18080、gRPC 29090 和插件目录，运行 `gradle :sky-job:bootRun`。旧的 `sky-job/build/libs` 打包 JAR 可能不包含当前分组接口，应使用当前源码宿主。本次不运行数据库重置或迁移。

在前端目录运行：

```powershell
$env:VITE_API_PROXY_TARGET='http://localhost:18080'
npm run dev
```

浏览器打开 `http://localhost:5173`。账号为后端文档中的 `frontend_it_admin` 和 `frontend_it_target`；SELF 账号没有仪表盘权限，登录后可直接进入其安装实例的账户页面。

需要无热更新的生产预览时：

```powershell
$env:VITE_API_PROXY_TARGET='http://localhost:18080'
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

## 自动检查

```powershell
npm run test
npm run lint
npm run build
```

Windows 沙箱若出现 Vitest 临时目录重命名 `EPERM`，仅对当前命令设置临时目录：

```powershell
$env:TEMP=(New-Item -ItemType Directory -Force 'node_modules/.cache/test-temp').FullName
$env:TMP=$env:TEMP
npm run test -- --maxWorkers=2
```

## 真实接口验收

宿主启动后，在前端目录运行 `node scripts/frontend-integration.mjs`。脚本只接受本机 18080 `/api`，复用文档中的测试账号；结果写入 `docs/frontend-integration-results.json`，不输出令牌。

脚本创建独立测试实例、账户、渠道、任务、规则和服务权限，验证后清理；原始 A/B/SERVICE 实例保留。需要 JDK 25、已有插件 API JAR 和 MySQL JDBC 驱动，可通过 `SKY_PLUGIN_API_JAR`、`SKY_MYSQL_DRIVER_JAR` 覆盖路径。脚本会构建临时账户插件，用真实 CSV/XLSX 验证复杂 JSON、逐行错误及类型保留。

当前后端卸载实例使用软删除，保留的实例行会阻止插件定义删除。临时账户插件清理 helper 只连接固定 `sky_new_frontend_it`，校验本次生成的准确实例 ID、插件 ID 前缀、测试名称及已删除状态，再移除该测试实例行并通过 REST 删除定义。不会迁移、重置数据库或修改历史快照。

## 验收记录（2026-10-14）

前端全量 32 个测试文件、186 项测试通过；ESLint、类型检查、生产构建和改动文件 Prettier 检查通过。构建保留原有仪表盘大于 500 kB 的体积提示。

真实接口已通过以下 12 组场景，详细结果见 JSON 报告：

1. 原始 A/B 实例渠道池和配置隔离、列表安全投影。
2. 停用部门兼容、CUSTOM 部门保留和本地依赖 merge 安装。
3. 分组增删改、名称校验、重名冲突及跨实例/SELF 范围隔离。
4. 账户创建、按创建顺序稳定分页、组合筛选和用户自定义列。
5. 单个/批量移动、显式 null、重复和不存在账户的单项失败。
6. 按组 CSV/XLSX 导出、重新导入保留分组和排序、Blob JSON 错误。
7. 删除非空组后账户、账户 JSON 和创建时间保留。
8. 任务渠道独立更新、规则字符串 jobId 和通知历史 ID 快照。
9. 四类资源转交后原 SELF 令牌即时生效，再转回原管理员。
10. SERVICE 权限 CRUD、任务 runner 调用、调用详情和目标 runner 日志。
11. 复杂 JSON 单元格、空容器、逐行错误、CHECKBOX 数组投影和 CSV/XLSX 往返导入。
12. 未匹配路由返回 HTTP 404 和 `404001`。

生产预览浏览器已验证管理员分组创建、重命名、单个账户移动、按组筛选及导出范围、删除非空组和筛选重置、未分组默认选项；SELF 用户仅能读取其 B 实例，实际导入预校验显示成功与失败行。部门、数据归属、任务、通知历史、服务权限和服务调用日志页面读取真实数据时未出现页面脚本错误。

本次未执行生产数据库迁移、通知外部投递或破坏性数据库重建。界面交互和真实 REST 场景分别验收；没有把模拟测试计作真实联调通过。
