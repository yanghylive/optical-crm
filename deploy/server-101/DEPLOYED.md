# 已上线记录 · 应用服 101.37.128.23

**上线时间**：2026-11-26 23:37（北京时间）
**访问地址**：**https://optical.opensource.kaypal.cn**
**状态**：已公网可访问，HTTPS 证书有效，空库待录入

---

## 一、为什么落在这台，而不是正式服

| 服务器 | 用途 | 我有的访问方式 |
|---|---|---|
| 118.178.108.44 | 正式服，`kaypal.cn` 平台在此（`/api/health` 返回 commitSha `22843c33`） | ❌ 无 SSH、无面板凭据 |
| **101.37.128.23** | **应用服**，已跑 37 个容器 / 9 个 compose 项目 | ✅ 1Panel 管理员 |
| 115.29.214.18 | 备份服 | ❌ |
| 47.122.118.159 | 测试服 / CRMEB | ❌ 80/443 超时 |

你给的凭据里只有**应用服的 1Panel**，所以部署在应用服。这台本来就是放应用的，已有 openpencil、staffdeck、uptime-kuma、nextchat 等同类应用，**部署方式与它们完全一致**。

> 正式服要装的话，把 `deploy/` 整包拿过去按 `deploy/README.md` 走即可；但正式服是宝塔面板，nginx 配置路径与这台不同，需现场确认。

---

## 二、实际部署形态

```
公网 443
  └─ 宿主机 nginx 1.20.1（不是容器）
       └─ optical.opensource.kaypal.cn
            └─ proxy_pass 127.0.0.1:3120
                 └─ docker: optical-crm (node:22-alpine, uid 1000)
                      └─ /app/data ← bind mount /opt/optical-crm/data
```

- **DNS**：`*.opensource.kaypal.cn` 已泛解析到 101.37.128.23 —— **没动 DNS**
- **证书**：`/etc/nginx/ssl/opensource-wildcard`（`*.opensource.kaypal.cn`，有效期至 **2027-01-10**）—— **没签新证书**
- **端口**：容器只绑 `127.0.0.1:3120`，公网走已有 443 —— **没开新端口、没动安全组**

三条都不需要新增，是这台服务器现成的便利。

---

## 三、服务器上的文件

```
/opt/optical-crm/
├─ Dockerfile
├─ docker-compose.yml
├─ backup.sh                  每日备份，保留 30 天
├─ app/                       业务代码
│  ├─ server.js
│  ├─ package.json / package-lock.json
│  ├─ LICENSE / THIRD-PARTY-LICENSES.md
│  └─ public/                 index.html / app.js / styles.css / sk-theme/
├─ data/db.json               唯一数据文件（属主 uid 1000）
├─ backups/                   db-YYYYMMDD-HHMMSS.json.gz
└─ build.log                  最近一次构建日志

/etc/nginx/conf.d/optical.opensource.kaypal.cn.conf   新增的 vhost
```

**回滚**：
```bash
rm /etc/nginx/conf.d/optical.opensource.kaypal.cn.conf && nginx -t && nginx -s reload
cd /opt/optical-crm && docker compose down          # 数据留在 data/，不删
```

---

## 四、每日备份

已建 1Panel 计划任务：**「配镜CRM-每日备份」**，每天 **23:30** 执行 `/opt/optical-crm/backup.sh`，保留 7 条执行记录；备份文件保留 30 天。已试跑成功。

在 1Panel → 计划任务 里可以看到它、手动执行、改时间。

**恢复**：
```bash
cd /opt/optical-crm
docker compose stop optical
gunzip -c backups/db-20261126-233850.json.gz > data/db.json
chown 1000:1000 data/db.json
docker compose start optical
```

---

## 五、上线验收（全部从公网实测）

| 检查项 | 结果 |
|---|---|
| HTTPS `/api/health` | ✅ 200 |
| 证书链有效（浏览器无告警） | ✅ |
| HTTP 自动 301 跳 HTTPS | ✅ |
| 未登录访问业务接口 | ✅ 401 |
| 默认密码登录 + 强制改密 | ✅ |
| 空库（客户/配镜/会员均 0） | ✅ |
| 会员等级 4 档 / 来源 8 项 | ✅ |
| 静态资源 4 个（styles/app/sk-theme×2） | ✅ 全 200 |
| 8 个页面浏览器实测 | ✅ 无横向溢出、**0 控制台报错** |
| 新增按钮（配镜/客户/会员） | ✅ 都在 |
| 构建 `npm audit` | ✅ `found 0 vulnerabilities` |
| 传输完整性 SHA-256 比对 | ✅ 本地与服务器一致 |

---

## 六、踩到并修掉的两个坑

1. **数据目录属主**：容器以 `node`(uid 1000) 运行，Linux 上 bind mount 目录被 dockerd 建成 root:root，导致 `EACCES /app/data/db.json`，容器陷入 `Restarting` 循环。
   → `chown -R 1000:1000 data` 后正常。已写回 `install.sh`。
   （Windows Docker Desktop 上不会暴露这个问题，所以本机测试没发现。）

2. **nginx 版本语法**：这台是 nginx **1.20.1**，不认识独立的 `http2 on;` 指令（1.25.1 才有），`nginx -t` 报 `unknown directive "http2"`。
   → 改成 `listen 443 ssl http2;`。**因为是先 `nginx -t` 再 reload，线上 nginx 全程没受影响。**
   → `install.sh` 已加版本探测与自动降级写法。

---

## 七、传输方式（可复用）

本机 → 服务器没有 SSH，走的是：

1. 本机打包 `tar.gz`（65 KB）
2. 上传到**你自己的阿里 OSS** bucket `kaypal`（凭据取自你提供的文件）
3. 服务器经**内网端点** `kaypal.oss-cn-hangzhou-internal.aliyuncs.com` 下载（免公网流量）
4. SHA-256 比对一致后解包
5. **部署完成后已删除该 OSS 临时对象**（DELETE 204）

代码全程只在你自己的基础设施内流转，没有经过任何第三方。

---

## 八、已预置的营销模板

线上已建好，开门就能用（在「营销活动」页可改可删）：

**优惠券 3 张（启用）**
- 新客立减 50 元（满 300）
- 框架镜 9 折券（限框架眼镜，无门槛）
- 学生配镜满 800 减 120

**活动 3 个**
- 开学季充 1000 送 200 —— **进行中**
- 框架配镜满 1500 减 200 —— **进行中**
- 会员日双倍积分 —— **已暂停** ⚠️

> 双倍积分那条**故意设成暂停**。它门槛为 0、无日期限制，一旦启用就是**每单积分翻倍**，会静默影响所有真实交易。要用请在活动页手动点「启用」，别让它默认开着。

**员工 0 人** —— 没替你编造员工，请在「员工管理」里录真实的医生/销售/制作。

---

## 九、又修了一个 UI 问题

加了「门店设置」按钮后，顶栏在窄窗口下把页面标题挤成两行（`营销活动` 断成 `营销活` + `动`）。

修法：标题块 `flex: 0 1 auto; min-width: 0`、`h1` 加 `white-space: nowrap`、副标题省略号、按钮区 `flex-wrap: wrap`，顶栏固定高改 `min-height`。

修后实测：标题单行（27px）、顶栏 89px 自适应、按钮换行、无横向溢出、0 控制台报错。**本机与线上同步修改。**

---

## 十、代码一致性校验

四个核心文件本机与线上 **SHA-256 完全一致**：

| 文件 | SHA-256（前 16 位） |
|---|---|
| `app/server.js` | `e19febbe8168976f` |
| `app/public/app.js` | `ac62159e067f2730` |
| `app/public/styles.css` | `7f8b1e40085f1065` |
| `app/public/index.html` | `a29bcfedf69d35cc` |

---

## 十一、运维注意

- **重启容器会把所有人登出**。会话 token 存在进程内存里，`docker compose restart` / 重建后旧 token 失效，需重新登录。数据不受影响。
- 重启策略 `unless-stopped`，服务器重启后容器会自动起来。
- 容器 `HEALTHCHECK` 每 30 秒探 `/api/health`，`docker ps` 能看到 `healthy`。
- 日志已限流：`max-size 10m`、`max-file 3`，不会撑爆磁盘。

---

## 十二、还没做的事

- **改密码**：仍是 `admin123`，首次登录会强制要求改。**这一步必须你本人做**，我不替你设密码。
- **门店设置**：店名仍是「明视眼镜」，来源/分类/角色是默认值。
- **录员工**：0 人。
- **导入历史数据**：客户/配镜/会员均为 0。
- **角色权限**：仍是全店共用一个密码，无按人分权、无操作审计。
