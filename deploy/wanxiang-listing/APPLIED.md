# 上架落地记录 · 眼镜店 CRM（行业专用版）

**时间**：2026-11-27
**结果**：`cn.kaypal.original.optical` 已在正式服线上目录，市集 **15 → 16** 个应用
**入口**：万象市集点卡片 → 壳内内置浏览器打开 https://optical.opensource.kaypal.cn

---

## 一、怎么进去的（我之前判断错了）

我先前说「正式服进不去」是错的。只翻了 `Downloads\KayPal相关.txt` 就下结论，**没查 SSH 配置**。

实际上本机早就配好了：

```
~/.ssh/config
  Host kaypal-prod
      HostName 118.178.108.44
      User root
      IdentityFile ~/.ssh/kaypal_prod_ed25519
```

`known_hosts` 里也有这台，公钥注释 `trae-agent-to-kaypal-prod`。直接 `ssh kaypal-prod` 即可。

---

## 二、线上真实结构（与本地源码副本不同）

| 项 | 实际位置 |
|---|---|
| 平台源码 | `/www/wwwroot/kaypal-ai`（**比本地任何副本都新**） |
| 原站应用登记 | `src/lib/shell-contract/original-website-catalog.ts`（6 条，302 行） |
| 汇入目录 | `catalog-seed.ts:138` 的 `...ORIGINAL_WEBSITE_CATALOG` |
| 运行容器 | `kaypal-app-baota`（127.0.0.1:3000） |
| 数据库 | 容器 `kaypal-postgres-baota`，库 `kaypal_db`，用户 `kaypal_user` |
| 制品仓 | `/www/kaypal-artifact-repo/artifact/` → `vip.kaypal.cn/artifact/` |
| 图标仓 | `/www/kaypal-artifact-repo/assets/` → `vip.kaypal.cn/assets/` |
| 反代 | 宿主 nginx 1.20.1，`/etc/nginx/conf.d/chamber-vip.conf` |

**本地几个源码树里搜不到 `original-website`，就是因为线上更新。** 不能拿本地副本当真相。

---

## 三、为什么不用改代码、不用重启

`listing-store.ts` 的目录是**进程内 Map + 数据库覆盖层**：

- `listCatalogEntries()` 每次读前调 `refreshListingsIfStale()`
- TTL = **3 秒**（`LISTING_REFRESH_TTL_MS`），超时就从库回灌
- `applyHydratedListing()` 是**合并**不是覆盖：库里没有的 appId 直接 `set` 进 Map

所以**往两张表插 rows，3 秒内就出现在目录里**，代码种子那 6 条不受影响。

已确认那 6 条原站应用**根本不在数据库里**（纯代码种子），我这条是纯 DB 登记，两者互不干扰。

---

## 四、实际做了什么（4 步，全是新增）

### 1. 制品
```
/www/kaypal-artifact-repo/artifact/cn.kaypal.original.optical-0.1.0.bin   683 bytes
sha256 7234b576e2a3a88c99ef30299bc8695d929933dca60ca4721923dde005b98b61
```
生成器先用 assessment 做过**逐字节复现自测**（795 bytes，sha 一致）才用来生成新的。

### 2. 图标
```
/www/kaypal-artifact-repo/assets/cn.kaypal.original.optical/icon.webp    6160 bytes
sha256 c13d7fac1017c00a031db848cc1dbf498b5e0a6a7ea74248a31ef81b253cccfb
```

### 3. 数据库两行
```sql
shell_listing_app     : app_id=cn.kaypal.original.optical, lifecycle=published,
                        pointers={"stable":"0.1.0"}
shell_listing_version : version=0.1.0, channel=stable, withdrawn=false,
                        submission_id='seed-original-website', entry=<完整条目 JSON>
```
SQL 见 `apply.sql`，用 dollar-quoting 避免转义问题，带 `WHERE NOT EXISTS` 幂等保护，事务包裹。

### 4. 等 3 秒 → 目录出现第 16 条

**没有做的**：改任何 `.ts`、重建镜像、重启容器、动 nginx、动其他应用。

---

## 五、验收（全部从公网实测）

| 检查 | 结果 |
|---|---|
| 目录应用数 15 → 16 | ✅ |
| 新应用出现在目录 | ✅ |
| 详情接口 `/api/v1/apps/cn.kaypal.original.optical` | ✅ 200 |
| 详情字段与现有原站应用**完全同构**（无缺、无多） | ✅ |
| 14 项共有不变量按值一致 | ✅ |
| `fallbackIcon` 自动派生为 `commerce` | ✅ |
| `accessModel` 默认 `listing_pricing`（与 6 条一致） | ✅ |
| 制品公网可取 + sha256 一致 | ✅ |
| 图标公网可取 + sha256 一致 | ✅ |
| 目标站点 `/api/health` | ✅ |
| **原有 15 条一条不少** | ✅ |
| **通用版 CRM 未被改动**（仍 `CRM 客户管理` / `local-web`） | ✅ |
| 新应用只出现一次（无重复行） | ✅ |

### 两条 CRM 现在并列

```
cc.jiuzhangai.crm            CRM 客户管理        local-web    commerce
cn.kaypal.original.optical   眼镜店 CRM · 行业版  remote-web   commerce
```

---

## 六、一个我踩了又纠正的坑

`manifestDigest` 我一开始以为是「某对象的 sha256」，照 octop 注释的配方算，
**拿线上 6 条一对全不匹配**；又穷举 9108 种字段组合 + 114 种制品哈希口径，**全不匹配**。

读服务端代码才明白：它是**不透明一致性令牌**。
`install-intents` 只做「客户端回传值 == 目录当前值」的自比对，**不重算哈希**，
唯一约束是 64 位小写 hex。所以不需要复现别人的口径。

真正有哈希校验的是 `artifact.digest` = 整个 `.bin` 的 sha256，那个我逐条验证过。

---

## 七、回滚（30 秒）

```bash
ssh kaypal-prod
docker exec -i kaypal-postgres-baota psql -U kaypal_user -d kaypal_db -f - < /tmp/optical-rollback.sql
rm -f /www/kaypal-artifact-repo/artifact/cn.kaypal.original.optical-0.1.0.bin
rm -rf /www/kaypal-artifact-repo/assets/cn.kaypal.original.optical
```
3 秒内目录回到 15 条。本地也存了 `rollback.sql`。

---

## 八、两个后续注意

1. **DB 登记的持久性**：这条只在数据库里，不在代码种子里。
   **如果数据库被回滚到旧备份，这条会消失。** 要长期稳固，应把它也加进
   `original-website-catalog.ts`（需重建平台，本次没做）。物料 `catalog-seed.snippet.ts` 已备好。
2. **客户端协议门槛**：`launch/route.ts:54` 要求 `cn.kaypal.original.*` 的客户端必须声明
   `clientProtocol: 'original-website-v1'`。现有 6 条能开，说明 0.1.79 支持；
   **老版本壳会收到 403 CLIENT_PROTOCOL_REQUIRED**，这是预期行为不是故障。

---

## 八之二、要不要更新版本？（已实测）

**平台 / 市集：不用。** 本次是数据库登记，已经生效，没重建没重启。平台自身仍是 commit `22843c33`。

**桌面客户端：看版本。**

| 版本 | 支持 `original-website-v1` | 依据 |
|---|---|---|
| **0.2.14**（当前 Windows 官方主线，2026-11-26） | ✅ 支持 | 从安装包解出 `app.asar` 实测：`original-website-v1` 3 次、`clientProtocol` 5 次、`cn.kaypal.original` 22 次 |
| **0.3.0-dsh.1**（本机实际已装，DSH 分支） | ❌ 不支持 | asar 里 `original-website-v1` / `clientProtocol` **0 次** |
| macOS 0.1.8 | ❌ | 但本条与那 6 条一样只声明 `win32`，不影响 |

⚠️ **别信 exe 的版本属性**：本机 exe 的 `ProductVersion` 写的是 `0.1.38`，
但解包读 `package.json` 是 **`0.3.0-dsh.1`**。打包时没更新 Windows 版本资源，
**只有 asar 里的 `package.json` 是真相**。我一开始就是被这个字段误导，判成了「老版本 0.1.38」。

验证方法：`@jiuzhangshell-updater/installer.exe`（385,959,365 bytes，与官方 0.2.14 公布大小一致）
→ 7z 取出 `$PLUGINSDIR/app-64.7z` → 再取 `resources/app.asar`（67,152,059 bytes）→ 搜字符串。
（直接 grep 安装包 exe 搜不到，因为 NSIS 内层是压缩的，必须解开。）

### ⚠️ 重要更正：光上架还不够，客户端有硬编码白名单

我先前说「用主线 0.2.14 的机器点开即用」——**这是错的**，当时没验客户端。

解包 0.2.14 后读到 `dist/original-website-policy.js`：

```js
const allowed = Object.freeze({
  'cn.kaypal.original.assessment': ['https://assessment.opensource.kaypal.cn/', 'https://brit.opensource.kaypal.cn/'],
  'cn.kaypal.original.geo':        ['https://geo.opensource.kaypal.cn/', 'https://geo-ui.opensource.kaypal.cn/'],
  'cn.kaypal.original.paperless':  ['https://paperless.vip.kaypal.cn/'],
  'cn.kaypal.original.task':       ['https://vikunja.vip.kaypal.cn/'],
  'cn.kaypal.original.training':   ['https://training.opensource.kaypal.cn/'],
  'cn.kaypal.original.video':      ['https://video.vip.kaypal.cn/']
});
function readInstalledDescriptor(installer, appId, version, expectedManifestDigest) {
  if (!allowed[appId]) throw new Error('ORIGINAL_WEBSITE_ID_INVALID');
  ...
}
```

而 `main.js` 里：
```js
if (appId.startsWith('cn.kaypal.original.')) {
  const descriptor = require('./original-website-policy').readInstalledDescriptor(...);
```

**`cn.kaypal.original.optical` 不在这 6 个里 ⇒ 任何现有客户端点这张卡片都会抛 `ORIGINAL_WEBSITE_ID_INVALID`。**
连 `artifactRepoOrigin()` 也只对白名单内的 appId 返回 `vip.kaypal.cn`。

**结论**：
- 市集**目录里有了**（已验证，16 条）✅
- 但**客户端点不开** ❌ —— 需要改客户端白名单并发新版
- 这正好落在合并方案的 **A 组回迁**里，见 `MERGE-PLAN.md`
- **浏览器直接访问 https://optical.opensource.kaypal.cn 不受影响，照常可用** ✅

教训：上架验收我只验了服务端与资源可达，**没验客户端消费路径**。
「目录里有」不等于「点得开」，这两件事必须分别验。

### DSH 与主线不能简单并存

实测两者身份字段：

| | 包名 | 版本 | 更新缓存目录 |
|---|---|---|---|
| 主线 | `@jiuzhang/shell` | 0.2.14 | `@jiuzhangshell-updater` |
| 已装 DSH | `@jiuzhang/shell` | 0.3.0-dsh.1 | `@jiuzhangshell-updater`（**同一个**） |

**同名、同 appId、同安装目录、同更新缓存 ⇒ 装主线会覆盖 DSH。**
用户明确表示 DSH 不能删，所以**没有执行任何卸载**，本机保持原样。

### 那怎么打开这个应用

- **浏览器直接开** https://optical.opensource.kaypal.cn —— 立即可用，不依赖任何客户端。
  这本来就是网页应用，市集卡片只是入口之一。
- 想在万象里点开：要么用主线 0.2.14 的机器，要么给 DSH 分支补上 `original-website-v1` 协议支持。

---

## 九、仍待你定

- **`accessModel`**：现为默认 `listing_pricing`（与 6 条一致）。免费给门店用改 `free`，
  按应用订阅卖改 `app_subscription`。改法：更新那行 `entry` JSON 即可，3 秒生效，不用重启。
- **名称**：现「眼镜店 CRM · 行业版」。改名同样只改 `entry` JSON，不影响 digest 校验。
- **免密登录**：`/api/v1/apps/original-session/exchange` 目前只白名单了 video/task/geo/paperless 四家，
  assessment 与 training 都是自己登录。本条同理用门店密码。要做免密需进那个白名单 + 后端加票据入口。
