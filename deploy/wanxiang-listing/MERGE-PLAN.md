# 万象壳「两条线合一」方案 v2

> v1 的诊断（"源码没推上去"）只对了一半。查到 patch 目录后，**真正的根因更具体**。

## ✅ 已定决策（2026-11-27）

| 项 | 决定 |
|---|---|
| DSH 内核 | **默认开启** |
| GitHub 推送 | 本机有权限（网络时好时坏，可走正式服中转） |
| 合并后版本 | **全新版本线，1.2 开头** |

## ✅ Phase 0 止血：已完成

| 分支 | commit | 内容 |
|---|---|---|
| `rescue/dsh-line-20261127` | `66c1577a` | 22 文件，含 `dsh-runtime.ts`(25KB) / `dsh-grant.ts`(7.5KB) |
| `rescue/market-line-20261127` | `c19765ef` | 10 个源码文件（排除 500MB 构建产物） |

两条都已推到 GitHub。用 git plumbing 造提交，**工作区/HEAD/当前分支均未改动**，逐项校验过。

---

## 一、真正的根因：两条线改的是**不同的层**

`patches/0.2.2/README.md` 里团队自己写着：

> 「0.2.1 的打开进度能力**只存在于 dist，没有回迁 `apps/shell/src`**，因此 0.2.2 继续沿用 dist 覆盖方式，**而不是从本仓源码直接构建**。」

> 「## 待办：……后续应把打开进度、下载进度与断点续传**回迁到 `apps/shell/src` 与 renderer 源码**，再恢复"源码直接构建发布"的链路。」

所以：

| | 主线 0.2.x | DSH 线 0.3.0-dsh.1 |
|---|---|---|
| 改哪一层 | **编译产物** `dist/main.js` / `renderer/shell.js` | **源码** `apps/shell/src/*.ts` |
| 怎么发 | dist overlay 覆盖后打包 | tsc 编译后打包 |
| 源码有没有 | **没有**（改动只在 dist） | 有（但未提交，已 rescue） |

**这就是分叉的机制**：
- 从 src 编译 → **丢掉 dist overlay 的全部能力**（原站协议、下载进度、断点续传、顾小满…）
- 继续 dist overlay → **丢掉 DSH 的源码改动**
- 两条路互斥，所以只能二选一 → 表现为"两个版本"

**不是有人开了分支，是发布链路本身断成了两截。**

### 证据

`shell-0.2.0-merge/patches/0.2.2/`：
```
MANIFEST.json   format: "jiuzhang-shell-dist-overlay.v1"
files/app-dist/main.js                 1,173,755 bytes  → dist/main.js
files/app-dist/artifact-downloader.js     28,397 bytes
files/renderer/shell.js                  798,978 bytes
files/renderer/wanxiang-workspace.css     47,760 bytes
files/shell-renderer-i18n/messages.{zh-CN,en-US}.js
files/package.json                     （版本 0.2.2）
```

`build-provenance.json` 的 `sourceCommit` 写的是 **`0.2.1-patch-on-0.2.0-dist-merge`**——字面意思就是"在 dist 上打补丁"。

本地源码树里 **`original-website-v1` 命中 0 次**，但 0.2.2 的 `dist/main.js` 里有 2 次。

---

## 二、好消息：主线源码**没丢，也从来没存在过**

我全盘扫了 127,706 个目录（85 秒），确认机器上**没有更新的壳源码树**。
但这不是坏消息——**主线那些能力本来就没有 TS 源码，它们的"源"就是 dist overlay。**

而且量很小：

| | main.js 字符数 |
|---|---|
| 0.2.2 dist overlay（**本地已有**） | 983,488 |
| 0.2.14 线上 dist（从安装包解出） | 1,014,532 |
| **增量** | **31,044（约 3%）** |

关键能力标记在两版里**计数完全一致**：
`original-website-v1` 2/2、`clientProtocol` 2/2、`dev-workbench` 5/5、`guxiaoman` 8/8、`open-progress` 1/1。

**结论：0.2.14 ≈ 本地已有的 0.2.2 overlay + 3% 增量。**
不需要去别的机器找源码，**材料齐了**。

---

## 三、合并方案：把 dist 回迁成源码，两条线自然合一

### 核心思路

不是"把 A 分支合进 B 分支"，而是**把断掉的发布链路接回去**：

```
现在：  src/*.ts ──tsc──> dist ──[overlay 覆盖]──> 打包   ← 主线走这条
        src/*.ts ──tsc──> dist ─────────────────> 打包   ← DSH 走这条

合并后：src/*.ts（含回迁的 overlay 能力 + DSH）──tsc──> dist ──> 打包   ← 只剩一条
```

**回迁完成的那一刻，分叉就消失了**，因为两边改的是同一层。

### Phase 1 — 建立可编译基线（0.5 天 / AI 约 1 小时）

1. 从 `rescue/dsh-line` 切 `merge/1.2.0`
2. 装依赖、`tsc` 编译，确认能出 dist
3. 把本地 dist 与 0.2.14 dist 做**函数级比对**，列出缺失能力清单

**验收**：`merge/1.2.0` 能编译；缺失清单明确到函数名。

### Phase 2 — 回迁 dist overlay 到源码（主要工作量）

按文件分四块，**难度递增**：

| 块 | 内容 | 难度 |
|---|---|---|
| A | `artifact-downloader.js`（25.6K 字符）分片续传/ETag | 低，独立模块，几乎可直接转 TS |
| B | `messages.{zh-CN,en-US}.js` i18n | 低，纯数据 |
| C | `wanxiang-workspace.css` | 低，直接放回 renderer 源码 |
| D | **`main.js` 差量**（原站协议、打开进度、健康检查、顾小满等） | **中**，需逐函数比对回迁 |
| E | `renderer/shell.js`（799K 字符） | **中高**，量大，但多为 UI |

做法：以 0.2.14 dist 为**行为基准**，逐块把逻辑翻译回 TypeScript，**每块回迁后立刻编译 + 与 dist 做行为比对**。

**AI 在这一步优势最大**：JS→TS 的机械翻译 + 类型恢复，是纯文本工作。
但**必须逐块验证**，不能一次性翻译完再测——我在市集上架时踩过"快错方向"的坑（穷举 9108 种哈希组合全错，读代码才发现方向不对）。

**验收**：从 `merge/1.2.0` 源码编译出的 dist，与 0.2.14 dist **行为等价**（关键路径逐条冒烟）。

### Phase 3 — DSH 默认开启（0.5 天 / AI 约 1 小时）

DSH 源码已在 `rescue/dsh-line`，回迁完成后**同一棵树上就有两边能力**。

- 去掉探测回落，**默认启用 DSH**（按你的决定）
- 保留探测失败时的明确报错（不要静默回落，否则用户不知道内核没起来）
- `dsh-grant` 的 ed25519 每设备密钥逻辑原样保留

**验收**：启动即 DSH 内核；原站应用能点开；二开工作台能用。

### Phase 4 — 发 1.2.0（0.5 天）

- 版本 **1.2.0**，高于 `0.2.14` 与 `0.3.0-dsh.1`，两边老用户都能自动升
- **appId / productName 保持不变**（`com.jiuzhang.supershell` / JIUZHANG SuperShell）
  ⚠️ 改 appId 会让老用户断更，"全新的区分"用版本号体现即可
- 更新 feed 保持单一通道
- 打包 → 真机装 → 冒烟

### Phase 5 — 防止再分叉（关键，1 天 + 持续）

**光合并没用，必须把 dist overlay 这条路堵死**，否则下次赶进度又会走回去。

| 机制 | 做法 |
|---|---|
| **禁止 dist overlay** | 删掉 `patches/*/files/app-dist/`，CI 检测到该路径直接失败 |
| **发布只能从 tag** | 打包脚本校验 `git describe --exact-match`，工作区脏拒绝出包 |
| **制品↔commit 绑定** | `build-provenance.json` 的 `sourceCommit` 必须是真实 commit，CI 校验 |
| **源码唯一性** | CI 校验：dist 必须由本次 tsc 产出，不接受外部覆盖 |
| **分支保护** | main 禁直推，release 只从 main 切 |

---

## 四、工期（AI 主导）

| 阶段 | 人工 | AI | 卡点 |
|---|---|---|---|
| 0 止血 | 半天 | ✅ **已完成** | — |
| 1 基线 | 半天 | 1 小时 | 依赖安装/编译墙钟 |
| 2 回迁 | 3–5 天 | **3–6 小时** | 逐块验证，构建轮次 |
| 3 DSH 默认开 | 半天 | 1 小时 | — |
| 4 发 1.2.0 | 半天 | 1 小时 | 真机验收 |
| 5 防再犯 | 1 天 | 写 1 小时 | **团队遵守，AI 压不动** |

**净工作时间约 1 个工作日**（人工 5–8 天）。

不可压缩项：构建墙钟、真机验收、团队执行纪律。

---

## 六、Phase 1 已完成（2026-11-27）

工作树 **`D:\wx-merge-120`**，分支 **`merge/1.2.0`**（从 `rescue/dsh-line` 切出）。
用 `git worktree`，**不动任何现有工作树**；`node_modules` 用 junction 复用，免装依赖。

| 验收 | 结果 |
|---|---|
| `tsc -p apps/shell` | ✅ **零错误** |
| 工作树改动数 | 0（干净） |
| DSH 源码在位 | ✅ `dsh-runtime.ts` / `dsh-grant.ts` |
| **IPC 通道对比** | ✅ **39 vs 39，零缺失零新增** |

### 能力差异清单（已量化）

dist 文件：0.2.14 有 287 个，源码编译出 187 个。差 102 个，拆开看：

| 类别 | 数量 | 性质 |
|---|---|---|
| **只存在于 dist 的逻辑模块** | **36** | **需要回迁** |
| `vendor/ws/*` | 19 | 第三方库副本，复制即可 |
| dev-workbench 资源（html/css/md/png） | 40 | 资源，复制即可 |
| 其它 html/css | 7 | 资源，复制即可 |

新增 2 个：`dsh-grant.js` / `dsh-runtime.js`（正是 DSH）。

### 36 个待回迁模块，合计 368.8 KB

| 组 | 内容 | 个数 | 体量 |
|---|---|---|---|
| **A** | **原站与市集入口** | **4** | **12.8 KB** |
| B | 平台服务集成 `platform-*` | 10 | 135.9 KB |
| C | 浏览器面板 | 9 | 84.0 KB |
| D | 生命周期与诊断 | 5 | 34.2 KB |
| E | 外观与品牌 | 2 | 4.7 KB |
| F | 其它（含 34KB 设计包资源，可直接复制） | 6 | 97.3 KB |

明细见 `.baseline/backport-list.json`，基准 dist 已存 `.baseline/main-0.2.14.js`。

### ⚠️ A 组里有个必须先解决的问题

`original-website-policy.js` **硬编码了 6 个 appId 白名单**，
`readInstalledDescriptor()` 第一行就是 `if (!allowed[appId]) throw ORIGINAL_WEBSITE_ID_INVALID`。

**`cn.kaypal.original.optical` 不在里面** ⇒ 眼镜 CRM 卡片虽然在市集目录里，
**任何现有客户端都点不开**。详见 `APPLIED.md` 的更正段。

所以 A 组回迁不只是"翻译回 TS"，还要**把 optical 加进白名单**（或改成从目录下发，去掉硬编码）。
**后者更对**——否则每上架一个原站应用都要发一次客户端，这本身就是分叉的温床。

### 下一步：Phase 2 从 A 组开始

4 个模块约 200 行，回迁 + 去硬编码 + 编译验证。做完眼镜 CRM 就能在壳里点开。

---

## 六之二、Phase 2 · A 组进行中

### ✅ 已完成：`original-website-policy` 回迁 + 去硬编码

分支 `merge/1.2.0`，commit **`2468196e`**，已推 GitHub。

**按你的决定做的**：发新应用不再改客户端。

| 改动 | 旧 | 新 |
|---|---|---|
| 期望入口 URL | 6 个 appId 硬编码常量 | **目录 `allowedOrigins` 下发** |
| 制品仓库 origin | 6 个 appId 枚举 | **`cn.kaypal.original.` 命名空间** |
| selection 规则 | geo 特判 choose，其余 primary | **choose 要求多入口，primary 不限** |
| 首入口校验 | 只在 main 里查 | **策略模块内再钉一道** |

**验收 40 项全过**（`npm run test:original-website-policy`）：

| 组 | 项数 | 内容 |
|---|---|---|
| 与旧硬编码等价 | 6 | 6 个存量应用期望 URL **逐字一致（含顺序）** |
| 真实 descriptor | 8 | 7 个应用真实制品全部通过，**含新上架的 optical** |
| 篡改与越界拒绝 | 15 | 改 URL/版本/schema/入口数/label、非 https、带凭据、重复 origin、首入口不符… |
| 制品仓库钉定 | 9 | 7 个原站钉官方仓；非原站走 fallback；**前缀伪装 `cn.kaypal.originalX.evil` 不生效** |
| 存量语义未变 | 2 | geo 仍 choose、assessment 双入口仍 primary |

**安全性未削弱**：去掉的只是「第二道 appId 钉」。目录走认证 HTTPS、制品 ed25519 签名、
已装内容 contentDigest 复验、会话索引验签、入口与目录精确相等、首入口=canonicalOrigin、
launch token aud 绑定 origin —— 七道约束都还在，其中一道是本次**新增**的。

### ✅ 已完成：3 个文件接线 + 会话模块回迁

commit **`d91c101a`**（接线）、**`0fbca1ef`**（会话模块），均已推 GitHub。

| 文件 | 改动 | 编译 |
|---|---|---|
| `app-host.ts` | `originalWebsite` 标记；原站**不挂 preload**、**不注入壳票据头**、启用 Alt+←/→ 历史导航 | ✅ |
| `installer.ts` | 制品 / 签名清单 / SBOM 三处改用 `artifactRepoOrigin`（命名空间钉官方仓） | ✅ |
| `http-cloud-client.ts` | launch 请求按字面量下发 `clientProtocol: 'original-website-v1'` | ✅ |
| `original-market-session.ts` | **新回迁**，20 项验收全过 | ✅ |

**会话模块的表为什么保留硬编码**（与策略模块相反）：
它不是准入闸，是**可选 SSO 集成**。未登记的应用 `policyFor()` 返回 undefined，
main 用 `if (sessionPolicy)` 优雅跳过，用自己的登录照常打开。
已实测 optical / assessment / training / 任意新 appId **全部优雅跳过**。
Cookie 名/路径/SameSite 是站点自己的实现细节，目录里没有也不该有。
**⇒ 上架新应用同样不需要动这里。**

### ✅ A 组完成（commit `770020d9`，已推 GitHub）

**主进程原站能力差异归零** —— `main.js` 的 `originalWebsite` / `clientProtocol` /
`cn.kaypal.original` / `launchCanonicalOrigin` 全部不再缺失。

回迁的接线：

| 路径 | 内容 |
|---|---|
| `openApp` | sessionPolicy 守卫、clientProtocol、cloudLoadPath、SSO 独立分区、originalWebsite 透传 |
| 恢复实例 | 从 descriptor 恢复入口深链、SSO 分区、clientProtocol、reopenCloudLoadPath |
| `openAppByAppId` | descriptor 读取 + 多入口选择对话框 + origin 白名单 + **实例复用归属收窄**（两处） |
| 应用库/市集/详情/IPC | `originalInstallState` 共享设备安装态投影（4 处调用点） |
| 新增函数 | `assertOriginalIdentity`（统一登录期间身份/组织一致性断言） |
| `installer.ts` | 5 个方法公开化 + `contentDigest` 短缓存与 `force` 参数（回迁 dist 侧演进） |
| `cloud-client.ts` | `LaunchResult.loadPath` |

### 验收汇总

| 类别 | 项数 | 结果 |
|---|---|---|
| 本次新增：原站策略 | 40 | ✅ |
| 本次新增：原站会话 | 20 | ✅ |
| **仓库自带回归 12 套** | **379** | ✅ 全过 |
| 合计 | **439** | ✅ |

回归覆盖：实例 origin 策略 16、应用权限策略 31、受信主机 28、安装续传 13、
升级候选 49、应用配置 22、云 API 14、能力策略 14、身份会话 13、更新策略 52、
市集模型 96、取图链路 31。

**IPC 通道 39 vs 39，零缺失。** dist 缺失文件 102 → 100（两个模块已回迁）。

### ✅ E 组完成 + D 组部分完成

| commit | 内容 | 验收 |
|---|---|---|
| （E 组） | `shell-appearance` 主题唯一权威、`guxiaoman-brand` 宿主品牌脚本 | 16 项 ✅ |
| `5f27971d` | `app-retirement-policy` / `net-retry` / `app-health-checks` / `app-open-diagnostics` | 30 项 ✅ |

要点：
- **外观**：revision 单调递增、相同结果不重复广播、重入保护、prepare 先于读系统色
- **品牌脚本**：`runtime` 序列化后不得含模块作用域引用 —— 已用 vm 沙箱**真实执行**验证，
  并验重复注入走幂等分支
- **诊断**：appId / instanceId / 失败原因**全部只出 12 位哈希**，已测不泄露 URL 与明文
- **重试**：注入 fetch 验证 4xx 不重试、429/5xx 退避重试、失败带 URL/cause/次数

**dist 缺失文件 102 → 94**（已回迁 8 个逻辑模块）。

### ✅ 技能包资源 + Skill 库 + A 组收尾（commit `36be77ea`）

| 内容 | 量 |
|---|---|
| Skill 包资源回迁到源码（SKILL.md / yaml / 图片 / css / 浏览器脚本） | 41 个 |
| 壳根级与面板 html/css 回迁 | 8 个 |
| `skill-library.ts` 回迁 | 1 个 |
| `cloud-entry-policy.ts` / `market-carrier.ts` 回迁（A 组收尾） | 2 个 |
| 新增 `copy-shell-assets.mjs` 并接进 `build:shell` | — |

**为什么要加复制脚本**：`tsc` 只编译 `src/**/*.ts`，**不复制任何非 ts 资产**；
打包白名单只含 `dist/**`，所以漏复制 = 打包后资源缺失。
原 `copy-panel-ui.mjs` 只覆盖面板 html 与 assets/，技能包和根级 html/css 一直没人管。

验收 32 项（Skill 库**跑真实技能包**：列出、读正文、导出、重复导出 unchanged、
目标被篡改时拒绝且不动已有文件、相对路径拒绝）。

### ⚠️ 一个必须记下的坑：asar 偏移

我最初提取 asar 内容时用「试 0~4 字节对齐 + UTF-8 往返长度相等」来猜数据区起点。
**这个判据不可靠**：位移几字节后仍可能满足长度相等，结果是
**头部混入上一个文件的尾字节、尾部被截掉几字节**，而总长度看起来完全正常。

症状：提取出的 `.js` 开头有莫名的 `}` 或 `t;`，结尾少 `;\n`。
我是在 Skill 库测试报 `catalog.json` 不是合法 JSON 时才发现的。

**正确算法**：
```js
const dataStart = 8 + buf.readUInt32LE(4);   // asar header pickle 大小
const header = JSON.parse(buf.slice(16, 16 + buf.readUInt32LE(12)).toString('utf8'));
// 文件内容 = buf.slice(dataStart + entry.offset, dataStart + entry.offset + entry.size)
```
已按此**全部重取**（41 资源 + 8 html/css + 36 逻辑模块），并复核我手写回迁的模块
——导出面与结尾均完整，未受截断影响。

### 📌 回迁中查出的一条真实边界（非本次引入）

`error-reporting.sanitizeText` 的顺序是：**先**把 home 目录替换成 `~`，**再**用
`\b[A-Za-z]:\\[^\s"']*` 收敛 Windows 绝对路径。

于是 `C:\Users\alice\priv\f.txt` → `~\priv\f.txt`：
用户名与盘符结构去掉了，但**home 之下的目录段（`priv`）保留**——
因为替换后字符串不再以盘符开头，路径正则不再匹配。

- 与 0.2.14 基准**行为一致**（对拍通过），不是回迁引入的回归；
- home **之外**的绝对路径（如 `D:\topsecret\...`）整段收敛为 `[path]`，正常；
- token / 查询串 / 用户名确实去掉了。

已在测试里**如实断言现状**并写明注释，没有擅自"修好"它——
改脱敏顺序会让上报内容与基准不一致，属于产品决策，留给后续单独评估。

### ⏳ 剩余

| 项 | 说明 |
|---|---|
| `error-reporting.js` | D 组最后一个，526 行，最大 |
| `installer.ts` 共享设备多用户原站安装 | `originalOwners` / `shareOriginal`，3 处 |
| `payment-client.ts` `isFreeTrainingApp` | 训练应用免费判定，与 optical 无关 |
| B 组 平台服务集成 | 10 个模块 135.9 KB |
| C 组 浏览器面板 | 9 个模块 84.0 KB |
| F 组 其它 + 设计包资源 | 6 个模块 97.3 KB（含 34KB 资源可直接复制） |
| `vendor/ws` 19 个 + html/css/图片 | 复制即可，非逻辑 |

### 网络说明

本机 GitHub 时通时断。推不上去时走**正式服中转**：
`git bundle create` → `scp` → 正式服 `git fetch <bundle>` → `git push`。
注意正式服克隆要先 `git fetch origin merge/1.2.0` 补齐基线 commit，否则 bundle 报缺前置。

### 尚未做的验证（如实说明）

**以上都是编译期 + 单元/集成测试层面的验证。**
「装到真机、在市集里点开眼镜 CRM、页面真的加载出来」这一步**还没做**，
需要打出完整安装包并在装了壳的机器上实测。那需要 B/C/D/E/F 组也回迁完
（否则打出来的包缺平台服务与浏览器面板能力）。

---

## 七、现在可以开工

材料齐了：
- ✅ DSH 源码（rescue 分支）
- ✅ 主线能力基准（0.2.2 overlay 本地 + 0.2.14 dist 已解出）
- ✅ 增量只有 3%，范围清楚
- ✅ GitHub 可推

**下一步就是 Phase 1：切 `merge/1.2.0`，编译，列出缺失能力清单。**
