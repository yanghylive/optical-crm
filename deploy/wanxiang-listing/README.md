# 万象市集上架 · 眼镜店 CRM（行业专用版）

## 🟢 已上架（2026-11-27）

**appId `cn.kaypal.original.optical` 已在正式服线上目录里，市集现在 16 个应用。**
用户在万象里点这张卡片，就用壳内内置浏览器打开 https://optical.opensource.kaypal.cn ，零安装。

- 上架方式：**数据库登记**（`shell_listing_app` + `shell_listing_version` 各一行），**没改代码、没重建、没重启平台**
- 回滚：`rollback.sql`（删两行）+ 删两个新文件，见下文
- 落地记录见 **`APPLIED.md`**

---

目标：在万象应用市集里**点开即用内置浏览器打开网页端**，零安装。
机制与线上已有的 6 个 `original-website` 应用完全一致。

**核心要求：与通用版 CRM 明确区分——这条是行业专用版。**

---

## 一、两条 CRM 的分工（不是替代关系）

| | 通用版 | **行业专用版（本条）** |
|---|---|---|
| appId | `cc.jiuzhangai.crm` | **`cn.kaypal.original.optical`** |
| 市场名 | CRM 客户管理 | **眼镜店 CRM · 行业版** |
| 版本 | 0.3.0 | 0.1.0 |
| 入口 | `local-web`（本机装） | **`remote-web` + `original-website`（零安装）** |
| 面向 | 零售与服务业通用 | **眼镜店 / 视光中心** |
| 客户模型 | 会员档案 + 标签 + 生命周期 | 客户档案 + **配镜历史处方** |
| 核心单据 | 跟进任务、线索 | **23 列配镜销售台账** |
| 验光数据 | ❌ 无 | ✅ **度数R/L（球镜/柱镜×轴位）、瞳距、RPD/LPD** |
| 配镜工艺 | ❌ 无 | ✅ 框/产品、型号、片、公司、医生/销售/制作 |
| 会员 | 积分/现金/累计消费三个数字 | **储值流水账本 + 次卡核销 + 积分 + 4 档等级** |
| 营销 | AI 跟进建议 | **优惠券 + 充值赠送 + 配镜满减 + 双倍积分** |
| 回访 | 通用跟进 | **7 天佩戴适应 / 180 天视力复查 / 90 天隐形复购** |
| 数据在哪 | 每台机器一份 | **服务器一份，多设备共享** |
| 许可 | 九章私有许可 | MIT |

**一句话区分**：通用版管「人」，行业版管「人 + 处方 + 配镜工艺」。
眼镜店真正的业务资产是验光处方和配镜台账，通用版没有这两块字段，硬套会丢数据。

**图标区分**：通用版是「双人」图形（暖红橙），行业版是**眼镜**图形（暖琥珀金）——
同为 CRM 家族的暖色系与同一渲染风格，但一眼能分出是眼镜行业。

---

## 二、机制：为什么能「点开就是网页」

线上目录 `GET https://kaypal.cn/api/v1/apps/catalog` 现有 15 个应用，其中 **6 个**就是这个模式：

| appId | 名称 | 打开地址 |
|---|---|---|
| `cn.kaypal.original.paperless` | 智能档案库 | `paperless.vip.kaypal.cn` |
| `cn.kaypal.original.assessment` | 九章企业测评 | `assessment.opensource.kaypal.cn` |
| `cn.kaypal.original.task` | 任务与项目管理 | `vikunja.vip.kaypal.cn` |
| `cn.kaypal.original.geo` | GEO 工具族 | `geo.opensource.kaypal.cn` |
| `cn.kaypal.original.video` | 九场 JIUCHANG | `video.vip.kaypal.cn` |
| `cn.kaypal.original.training` | OpenMAIC | `training.opensource.kaypal.cn` |

壳侧 `app-host.ts` 标题即「App Host — **remote-web 宿主**」，每个应用实例 =
独立 `WebContentsView` + 独立 session partition + origin 白名单。
点卡片 → 壳内视图加载 `canonicalOrigin`，就是内置浏览器。

**加粗的三个 `*.opensource.kaypal.cn` 与我们的 CRM 同机同域名家族**，所以这条是顺位接入，不是新架构。

---

## 三、登记条目

见 **`catalog-entry.json`**（真实 sha256 / manifestDigest 由 `build-listing.cjs` 算出）。
可粘贴的 TS 片段见 **`catalog-seed.snippet.ts`**。

关键字段与理由：

| 字段 | 值 | 为什么 |
|---|---|---|
| `entry` | `remote-web` | 壳内浏览器加载远端站点 |
| `launchMode` | `original-website` | 与那 6 条同一启动语义 |
| `canonicalOrigin` | `https://optical.opensource.kaypal.cn` | 已上线、HTTPS 证书有效至 2027-01-10 |
| `allowedOrigins` | 同上（单元素） | 无跨站跳转，白名单收到最小 |
| `runtimeRequirements.runtimes` | `[]` | **用户机器不装任何运行时、不跑 Docker、不下制品** |
| `dataScope` | 四项全 `false` | 不绑租户/工作区/用户/设备 |
| `firstParty` | `false` | **不需要接 SSO**，用应用自己的门店密码登录 |
| `permissions` / `capabilities` | `[]` | 不调壳本地能力，权限面最小 |
| `category` | `commerce` | 受控词表里「电商营销」，与通用版 CRM 同类，便于并列 |
| `minShellVersion` | `0.1.66` | 与那 6 条一致；当前发布 0.1.79，满足 |
| `accessModel` | `listing_pricing` | 与那 6 条一致 |
| `withdrawn` | `false` | **必须显式写**，壳侧 fail-closed：缺失即视为已撤回 |

⚠️ **`fallbackIcon` 不要手写**。它是读路径派生值（`fallback-icon.ts` 的 `withFallbackIcon`），
由 `category` 直查得出。写 `category: 'commerce'` 就自动得到 `fallbackIcon: 'commerce'`。

### manifestDigest —— 我之前理解错了，这里更正

**它不是「某个对象的 sha256」，而是一个不透明的一致性令牌。**

我一开始照 `catalog-seed.ts` 里 octop 那条注释的配方算，拿线上 6 条真实数据一对，**6 条全不匹配**；
又穷举了 9108 种字段组合 + 114 种制品哈希口径，**全部不匹配**。

去读服务端代码才明白原因：

- `install-intents/route.ts:92` 只做 `manifestDigest !== entry.manifestDigest` 的**自比对**
  —— 客户端把目录给它的值回传，服务端检查是否等于目录当前值，**不重算任何哈希**
- 唯一格式约束是 `catalog.ts:26` 的 `/^[a-f0-9]{64}$/`

所以现有那 6 条用的是当时某个临时脚本的口径，**不需要也无法从公开字段复现**。
本次取值 = `sha256(JSON.stringify(条目去掉 manifestDigest 自身))`，稳定、随内容变化、符合格式约束。

### artifact 才是真有哈希校验的那个

`artifact.digest` = **整个 `.bin` 文件的 sha256**（已用现有 6 条逐一验证一致）。

`.bin` 不是二进制包，是个 JSON：
```json
{ "files": {
    "original-website.json": "<启动清单，2 空格缩进 + 尾换行>",
    "index.html": "<一句「请从万象 AI 市集打开 XXX」的占位页>"
} }
```
外层也是 `JSON.stringify(..., null, 2) + '\n'`。
**我用这个生成器逐字节复现了 assessment 的 .bin（795 bytes，sha 完全一致）**，格式确认无误。

---

## 四、图标

- 规格：**256×256 WebP**（与现有图标集一致，现有 4 枚均为 256×256 RGB）
- 上架路径：`https://vip.kaypal.cn/assets/cn.kaypal.original.optical/icon.webp`
- 风格：沿用现有图标集的**光泽半透明 3D ribbon 渲染 + 对角渐变底**
- 图形：**眼镜**（区别于通用版的双人）
- 配色：暖琥珀金 → 深橙红（与通用版同为暖色家族，但色相偏移，卡片可区分）

**为什么不放 `original-website-icons/commerce.webp`**：那个路径是**按分类通用**的
（现有 office/tool/media/education 四枚都是分类通用图）。眼镜是应用专属图形，
放分类通用位会让将来任何 commerce 应用都顶着眼镜。所以走 app 专属路径。

> 顺带发现：`original-website-icons/` 目前只有 `office / media / education / tool` 四枚，
> **`commerce.webp` 不存在**。所以 `fallbackIcon: commerce` 依赖的是壳侧字形库（15 项闭集），
> 不是这个图标目录——两者不是一回事，别混。

产物：`icon-256.webp`（上架用，6160 bytes）、`icon-256.png`（预览用）。

**已做的图标校验**：
- `icon-compare.png` —— 与通用版 CRM 及现有 4 枚分类图标并排，确认风格同族、图形可区分
- `icon-small-sizes.png` —— 96 / 64 / 48 / 32 px 缩放实测，32px 下两个镜圈 + 鼻梁仍可辨，
  与通用版在同等尺寸下的可读性相当

> 第一版生成结果被否掉了：模型给出的图形接近通用版的「双环 / 双人」ribbon，
> 读起来还是「两个人」而不是眼镜，**不满足「区分好」**。第二版明确了眼镜几何
>（两个等高并排镜圈 + 鼻梁 + 左右镜腿、横向轮廓、禁止 8 字/无穷环/人形）才达标。

---

## 四之二、结构校验（7 项全过）

拿线上 `cn.kaypal.original.assessment` 的真实详情做基准比对：

| 校验 | 结果 |
|---|---|
| 线上模板字段全覆盖（`fallbackIcon` 除外，它是派生值） | ✅ |
| 13 项共有不变量与线上**逐字一致**（kind/entry/launchMode/channel/withdrawn/minShellVersion/firstParty/accessModel/permissions/capabilities/runtimeRequirements/dataScope/publisher） | ✅ |
| `manifestDigest` 可复算一致 | ✅ |
| 图标 `sha256` 与实际文件一致 | ✅ |
| `appId` 不与现有 15 条冲突 | ✅ |
| origin 白名单最小化（单元素） | ✅ |
| 与通用版 CRM `appId` 明确区分 | ✅ |

复算命令：`node build-listing.cjs <原始图>`（改任何进 digest 的字段后重跑）。

---

## 五、怎么落地（已完成，见 APPLIED.md）

**实际走的是数据库登记，不是改代码。**

`listing-store` 的目录是「进程内 Map + 数据库覆盖层」：读路径每 **3 秒**从库回灌
（`LISTING_REFRESH_TTL_MS`），且 `applyHydratedListing` 是**合并**不是覆盖。
所以往 `shell_listing_app` + `shell_listing_version` 各插一行，3 秒内就出现在目录里，
**不用改 `.ts`、不用重建镜像、不用重启平台**。

线上那 6 条原站应用**根本不在数据库里**（纯代码种子），本条是纯 DB 登记，互不干扰。

正式服访问方式本机早就配好了：`ssh kaypal-prod`
（`~/.ssh/config` → root@118.178.108.44 + `kaypal_prod_ed25519`）。
我先前说「进不去」是只翻了 txt 没查 SSH 配置，判断错了。

线上真实位置（**比本地任何源码副本都新**）：
```
/www/wwwroot/kaypal-ai/src/lib/shell-contract/original-website-catalog.ts   6 条原站登记
/www/kaypal-artifact-repo/artifact/    → vip.kaypal.cn/artifact/
/www/kaypal-artifact-repo/assets/      → vip.kaypal.cn/assets/
容器 kaypal-postgres-baota / 库 kaypal_db / 用户 kaypal_user
```

**长期稳固建议**：DB 登记若遇数据库回滚到旧备份会消失。要彻底稳固，
应把条目也加进 `original-website-catalog.ts`（需重建平台，本次没做）。
物料 `catalog-seed.snippet.ts` 已备好。

### 回滚（30 秒）

```bash
ssh kaypal-prod
docker exec -i kaypal-postgres-baota psql -U kaypal_user -d kaypal_db -f - < /tmp/optical-rollback.sql
rm -f /www/kaypal-artifact-repo/artifact/cn.kaypal.original.optical-0.1.0.bin
rm -rf /www/kaypal-artifact-repo/assets/cn.kaypal.original.optical
```
3 秒内目录回到 15 条。本地也存了 `rollback.sql`。

---

## 六、命名备选

当前取 **`眼镜店 CRM · 行业版`**（明确带行业版标记，符合「区分好」的要求）。

| 备选 | 特点 |
|---|---|
| `眼镜店 CRM` | 最短，卡片渲染最稳；行业信息靠描述传达 |
| `配镜 CRM · 眼镜行业版` | 突出「配镜」这个核心动作 |
| `视光中心 CRM` | 面向医疗视光定位，比「眼镜店」更专业 |

改名只需改 `build-listing.cjs` 里的 `NAME` 重跑——**`name` 不进 manifestDigest**，
所以改名不用重算 digest；改 `version` / `canonicalOrigin` / `icon` / `minShellVersion` 才要重算。

---

## 七、两个要你定的商业口径

1. **`accessModel`**：现取 `listing_pricing`（与那 6 条一致，即按 listing 定价）。
   如果这个行业版打算随壳免费给门店用，应改 `'free'`；如果按应用订阅卖，改 `'app_subscription'`。
   这个字段决定权益门禁走哪条链，**不是纯展示**，上架前请确认。
2. **`name`**：现取 `眼镜店 CRM · 行业版`，备选见上一节。

这两项都不影响技术接通，但影响计费与卡片文案，我不替你拍。

---

## 八、上架后仍存在的限制

- **不接 SSO ⇒ 所有从壳里点开的人共用那一个门店密码**。无按人分权、无操作审计。
  这与现状一致，上架不会让它变好或变坏。
- 想要免密：壳里有现成先例（Octop 那一支先往页面 `localStorage` 塞 token 再 `loadURL`）。
  给 CRM 做这个需要后端加一个「接受壳签发票据」的登录入口，属可选第二步。
- `runtimeRequirements.os` 目前跟着那 6 条写 `["win32"]`。要支持 macOS 壳需加 `"darwin"`。
