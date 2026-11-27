# 配镜 CRM 轻量版 · 生产镜像
# 构建上下文 = 仓库根目录（optical-crm/），不是 deploy/
#   docker build -f deploy/Dockerfile -t optical-crm:1.0.0 .
#
# 国内服务器拉不动 Docker Hub 时换镜像源：
#   docker build -f deploy/Dockerfile \
#     --build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:22-alpine \
#     -t optical-crm:1.0.0 .
ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE}

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# 先装依赖，利用层缓存
COPY app/package.json app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 业务代码（不含 node_modules / data，见 .dockerignore）
COPY app/server.js ./
COPY app/public ./public
COPY app/LICENSE app/THIRD-PARTY-LICENSES.md ./

# 数据目录：运行时用卷挂载覆盖，这里先建好并交给非 root 用户
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
