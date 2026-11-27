# 配镜 CRM · 部署到万象市集那台服务器

与万象平台**同机、同 nginx、同 docker 网络**，但**独立容器、独立数据、独立编排**。
不改平台任何现有文件，回滚只需删 3 个新增文件。

---

## 0. 本地已验证过的东西

不是纸面方案，下面这些我在本机 Docker 里真跑过：

| 验证项 | 结果 |
|---|---|
| 镜像构建（`node:22-alpine` + `npm ci --omit=dev`） | ✅ 成功，`found 0 vulnerabilities` |
| 容器启动默认**空库**（不再凭空生成 36 个假客户） | ✅ 客户 0 / 配镜 0 / 会员 0 |
| 会员等级 4 档、客户来源 8 项自动初始化 | ✅ |
| `/api/health` 免鉴权探活 | ✅ 200 |
| 未登录访问业务接口 | ✅ 401 |
| 默认密码登录 + 强制改密标记 | ✅ |
| 静态资源 / 主题接线 | ✅ `sk-theme.css` 200、`app.js` 200 |
| **数据卷持久化**：销毁容器后用同一卷重建 | ✅ 数据仍在 |
| Docker `HEALTHCHECK` | ✅ `healthy`，失败次数 0 |
| `install.sh` 语法（真实 Linux bash） | ✅ `bash -n` 通过 |
| nginx 配置校验（方案 A / 方案 B） | ✅ `nginx -t` 均 successful |
| **HTTPS 经 nginx 反代到 CRM 全链路** | ✅ `/api/health` 200、登录拿到 token、首页 200 |
| 平台原有 upstream 不受影响 | ✅ 仍指向 `app` |

> 唯一警告来自**平台自己的** `nginx.conf:82`（`listen 443 ssl http2` 写法已过时），
> 与本次新增配置无关。我们新增的块用的是现代写法 `http2 on;`。

---

## 1. 两种入口，选一个

| | 方案 A（推荐先用） | 方案 B（更正式） |
|---|---|---|
| 访问地址 | `https://api.kaypalai.com:8443` | `https://optical.kaypalai.com` |
| 要不要改 DNS | **不要** | 要，加 1 条 A 记录 |
| 要不要新证书 | **不要**，复用平台现有证书 | 要（有泛域名证书则不用） |
| 要放行的端口 | 8443 | 已有 443，无需新增 |
| 上线速度 | 最快 | 多等 DNS + 签证书 |
| 观感 | 端口号有点丑 | 干净 |

**为什么方案 A 能复用证书**：证书是签给**域名**的，跟端口无关。
同一个 `api.kaypalai.com` 证书放在 8443 上一样有效，浏览器不会报警。

明天就要开门 → **先上方案 A**，之后有空再切方案 B（换一份 conf 即可，数据不动）。

---

## 2. 前置条件

- 服务器上有 `docker` 和 `docker compose` v2
- 平台是用 `docker compose` 起的，且能找到它的 `docker-compose.yml` 和 `nginx.conf`
  （本仓库里对应 `platform/docker/`，服务器上路径以实际为准）
- 平台 nginx 的证书在 `<平台>/docker/ssl/fullchain.pem` + `privkey.pem`
- 你能 SSH 上服务器，且有 sudo

> ⚠️ 如果生产实际是 **K8s** 而不是 docker compose（`docs/deployment-architecture.md` 里两种都写了），
> 这个安装器不适用，要改走 Ingress + Deployment。**先确认清楚再动手。**

---

## 3. 安装（方案 A）

```bash
# 1) 把整个 optical-crm 目录传上服务器
scp -r optical-crm user@server:/opt/

# 2) 先干跑，看清楚会新增哪些文件，不落盘
cd /opt/optical-crm/deploy
sudo bash install.sh --mode a --platform-dir /opt/kaypalai/docker --dry-run

# 3) 真正安装
sudo bash install.sh --mode a --platform-dir /opt/kaypalai/docker
```

安装器会依次做：

1. 探测平台 docker 网络名（`docker network ls | grep -i kaypal`），写进 `deploy/.env`
2. 建 `deploy/data/`（数据目录）
3. 生成 `nginx-optical.conf` = 平台 `nginx.conf` + 一行 `include /etc/nginx/conf.d/*.conf;`
4. 生成 `conf.d/optical.conf`（CRM 的 server 块）
5. 生成 `docker-compose.override.yml`（只给 nginx 追加 8443 端口和两个挂载）
6. `docker compose up -d --build` 起 CRM，等健康检查通过
7. 重建 nginx 容器套用 override → `nginx -t` → `nginx -s reload`
8. curl 验证 `https://api.kaypalai.com:8443/api/health`

**任何一步失败会自动删掉本次新增的文件**，不会留下半截状态。
已存在同名文件时**直接中止**，绝不覆盖你的改动。

### 还要手动做一件事：放行 8443

```bash
# 服务器防火墙（按实际用的那个）
sudo ufw allow 8443/tcp                 # Ubuntu
sudo firewall-cmd --add-port=8443/tcp --permanent && sudo firewall-cmd --reload   # CentOS
```

**云服务商安全组也要放行 8443**，这一层在控制台改，脚本管不到。

---

## 4. 安装（方案 B）

先补两步，再跑安装器：

```bash
# 1) DNS：optical.kaypalai.com  A  →  服务器公网 IP

# 2) 证书（已有 *.kaypalai.com 泛域名证书就跳过，直接拷过去）
sudo certbot certonly --standalone -d optical.kaypalai.com
sudo mkdir -p /opt/kaypalai/docker/ssl/optical
sudo cp /etc/letsencrypt/live/optical.kaypalai.com/fullchain.pem /opt/kaypalai/docker/ssl/optical/
sudo cp /etc/letsencrypt/live/optical.kaypalai.com/privkey.pem   /opt/kaypalai/docker/ssl/optical/

# 3) 安装
cd /opt/optical-crm/deploy
sudo bash install.sh --mode b --platform-dir /opt/kaypalai/docker
```

---

## 5. 上线后立刻做

1. 打开地址，用 `admin123` 登录，**按提示马上改成自己的密码**
2. 顶栏「门店设置」→ 改门店名、客户来源、产品分类、员工角色
3. 「导入 / 导出」→ 下载空白模板 → 填历史数据 → 导入
4. 设每日备份：
   ```bash
   crontab -e
   # 每天 23:30 备份，保留 30 天
   30 23 * * * /opt/optical-crm/deploy/backup.sh >> /var/log/optical-backup.log 2>&1
   ```

---

## 6. 回滚

```bash
cd /opt/kaypalai/docker
rm -f docker-compose.override.yml nginx-optical.conf
rm -rf conf.d
docker compose up -d nginx          # nginx 回到原样

cd /opt/optical-crm/deploy
docker compose down                 # 停 CRM（数据留在 deploy/data，不删）
```

平台侧只删了 3 个**新增**文件，原 `nginx.conf` / `docker-compose.yml` 从头到尾没被改过。

---

## 7. 日常运维

```bash
cd /opt/optical-crm/deploy

docker compose logs -f optical        # 看日志
docker compose restart optical        # 重启
docker compose ps                     # 状态 + 健康
docker compose up -d --build          # 更新代码后重建（数据不丢）

curl -s http://127.0.0.1:3100/api/health   # 宿主机直连自检
```

**恢复数据**：
```bash
docker compose stop optical
gunzip -c backups/db-20261126-233000.json.gz > data/db.json
docker compose start optical
```

---

## 8. 安全清单

- [ ] 已改掉 `admin123`
- [ ] 走的是 HTTPS，不是 HTTP
- [ ] CRM 端口只绑 `127.0.0.1`，公网只能经 nginx 进来
- [ ] 云安全组只放行必要端口
- [ ] 每日备份 cron 已生效，且验证过能恢复
- [ ] 知道当前是**全店共用一个密码、没有角色权限**——谁能登录谁就能看全部数据

> 最后一条是当前架构的真实限制。要按人分权限、留操作审计，得另做一轮，不在本次范围。

---

## 9. 国内服务器拉不动 Docker Hub

本机实测 Docker Hub 直连超时，DaoCloud 镜像源可用。服务器上如果也拉不动：

```bash
docker build -f deploy/Dockerfile \
  --build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:22-alpine \
  -t optical-crm:1.0.0 .
```

或给 docker 配镜像加速器（`/etc/docker/daemon.json` 的 `registry-mirrors`）后重启 docker。

---

## 10. 文件清单

```
deploy/
├─ Dockerfile                    生产镜像（多阶段不需要，原生 JS 无构建）
├─ docker-compose.yml            独立编排，加入平台网络，数据卷持久化
├─ .env.example                  网络名 / 宿主机端口
├─ install.sh                    一键安装（含 dry-run、自动回滚、幂等保护）
├─ backup.sh                     每日备份 + 保留 30 天
├─ nginx/
│  ├─ optical-8443.conf          方案 A：复用证书，8443
│  └─ optical-subdomain.conf     方案 B：子域名，443
└─ README.md                     本文件
```
