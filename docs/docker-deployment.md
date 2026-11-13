# Docker 镜像与部署

本项目通过 `.github/workflows/docker.yml` 发布 `ghcr.io/zaina01/sky-vue-new`，支持 `linux/amd64` 和 `linux/arm64`。每个架构分别构建和容器冒烟验证，通过后合并多架构清单。

- PR：运行测试、Lint、构建和容器验证，不推送镜像。
- 默认分支：发布 `latest` 和 `sha-<完整提交号>`。
- `v*` 标签：发布原样标签（例如 `v1.0.0`）和提交号标签，不更新 `latest`。
- GitHub 工作流使用 `GITHUB_TOKEN`，需要 `packages: write` 权限。私有 GHCR 包在服务器需要 `read:packages` 登录凭据。

后端仓库 `sky-new` 提供完整的三服务 `compose.yaml`、`.env.example` 和 [部署文档](https://github.com/zaina01/sky-new/blob/master/docs/docker-deployment.md)。将前端镜像标签填入 Compose 的 `FRONTEND_TAG`，后端版本由 `BACKEND_TAG` 独立控制；服务器无需本项目源码。

镜像通过 Node.js 24 构建，Nginx 托管静态文件；构建时 API 基址固定为空，浏览器请求同域 `/api/*`。Nginx 将 `/api` 原样转发到 `backend:8080`，通过 Docker DNS 定期重新解析地址。不要在生产镜像中使用 Vite 开发代理。

```bash
docker build -t sky-frontend:local .
bash deploy/docker-smoke.sh sky-frontend:local
```

冒烟只使用临时网络和 Python 后端，不访问真实数据库。检查 Nginx 启动、`/healthz`、首页、History 路由刷新、查询参数和 `/api` 路径保留、2MB POST，以及后端切换到不同 IP 后的 DNS 重新解析。运行环境需要 Docker、Bash 和 curl。

健康接口 `/healthz` 仅表示 Nginx 存活；整体部署健康应检查后端 `/api/actuator/health`。上传限制为 60MB，代理读取/发送超时为 600 秒。HTTPS、证书签发与续期由外部代理管理。
