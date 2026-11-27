# 万象壳 1.2.0 合并线 · 交接文档

> 最后更新：2026-11-27
> 工作树 `D:\wx-merge-120` · 分支 `merge/1.2.0` · HEAD `8623c90f`
> **有未提交改动**（B 块键盘子系统，见 §4），tsc 零错、已编译、定向套件已过。

---

## 1. 一句话现状

两条分叉构建线正在合并成一条 1.2.0。**源码回迁已全部完成（dist 缺失文件归零）**，
现在做的是**主进程接线 + 模块内部能力补齐**。方向已自查确认没跑偏，但进度比早期估计重
（详见 `AUDIT-20261127.md`）。线上正式版与眼镜 CRM 生产环境**全程未触碰**。

---

## 2. 目标与已定决策（不要重新讨论）

| 项 | 决策 |
|---|---|
| 终点 | 合成一条构建线，版本 **1.2 开头**；能力**不少于** 0.2.14 正式版 |
| 基线 | **以主线为基**，把 dist overlay 的能力回迁成源码；不是拿 DSH 线覆盖主线 |
| oracle | **0.2.14 基准是唯一真相源**。不发明行为；旧测试断言与基准冲突时**改测试对齐基准** |
| DSH | 内核**默认开启**（Phase 3，尚未做） |
| appId / productName | **不改**（改了老用户断更） |
| 上架方式 | 数据库登记（`shell_listing_app` + `shell_listing_version`），**不改客户端** |
| 发新应用 | **不改市集客户端**。准入闸硬编码白名单已去除 |
| 眼镜 CRM | `remote-web` / `original-website`，零安装；`cn.kaypal.original.optical` |
| 隔离 | 不碰用户原工作树、不碰线上正式版 |
| 本机 DSH | **不卸载**（用户明确「DSH不能删啊」） |
| 交付策略 | **A：全接完再打包**（用户 2026-11-27 选定）。不出 beta |
| 页面侧注入脚本 | 按原始资源**逐字节搬运**，不重写成 TS |
| 验收 | 与基准**同 realm 对拍** + 绝对断言；基准缺失时优雅降级 |

### 2.1 布局模型冲突 —— 已裁决走 B

主线与基准的面板布局是**两套不同实现**：

| | 主线（市集线） | 0.2.14 基准 |
|---|---|---|
| 宽度上限 | `max(窗口×0.6, 窗口 − 左侧手机宽 − 8)` | `窗口 − 420 − 8` |
| 宽度下限 | 按页面高算 20:9 手机宽 | 固定 560 |
| 吸附点 | 半宽 / 上限 / **手机宽** | 半宽 / 上限 / 560 |
| 布局模式 | 无 | split / wide / focus / custom |
| 窄窗口 | 无处理 | **<988px 整体让给工作区** |
| 手机比例特性 | **有**（用户 H0 明确要过） | 全仓零处 |

**用户选定 B**：保留主线布局模型，只搬键盘/焦点/下载/权限那部分。
- 拿到：Windows 子视图焦点丢失修复（用户可感知的真 bug）
- 放弃：基准的布局模式 + 窄窗回退
- **代价**：与基准永久留一处布局分歧，**Phase 5 CI 门禁必须给它显式豁免**
- `test-browser-panel-view-drive.mjs` 里锁主线布局的 4 条断言**保持不变**（这是有意的）

---

## 3. 已完成（提交清单，新→旧）

| commit | 内容 |
|---|---|
| `8623c90f` | 市集退役门禁 4 个消费点 + 订单详情通道 + 顾小满品牌/共享内存注入 |
| `4299474c` | SDK 外观同步 + 内置浏览器入口 + 下架 interop 闸（含契约文档/门禁/测试） |
| `500e218b` | cloud-entry-policy 六文件全接线 + **整棵 fixture 字节钉死** |
| `c84b933e` | 下架门禁 13/13 + 打开失败诊断全阶段埋点 |
| `23ec7c0e` | accessModel/purchaseScope/carrier 透传 + 免费训练闸 + fixture 钉定 |
| `7821b7de` | knowledge-platform-service 回迁（dist 缺口归零） |
| `d8e99d29` | 逐字节资产 EOL 钉定 |
| `150dde89` | panel-automation 回迁 |

### 3.1 这一段挖出的真问题（不是翻译工作）

1. **云应用免密深链根本没产出**：`main.ts` 一直读 `launch.loadPath`，但 `http-cloud-client`
   从来不写它 → 恒 undefined。现已接上签名验签 → 路径登记核对。
2. **应用导出（另存为）整条被砍**：主线「下载一律取消」，基准是「声明 `files.write_scoped`
   的云应用走另存为对话框」。已按基准恢复。
3. **市集退役门禁三处没接**：`app-market` / `default-install` / `app-library` 都没引用
   `app-retirement-policy` → 已下架应用仍可能显示/被默认装/拿到安装意图。已接 + 17 项新测试。
4. **`shell:openCommerceOrderDetail` 通道整条缺失** → 订单卡片点不开详情。已补 + 12 项新测试。
5. **fixture 整棵树被 autocrlf 破坏**：416 个文件字节与仓库不符，`artifact.bin` 206→212，
   sha256 对不上 → 3 条真装链假红。已钉 `-text` + 恢复，三套件转绿。
6. **`check-app-sdk.mjs` 在 Windows 上假红**：围栏正则按 `\n` 锚定，文档是 CRLF。已归一化读入文本。

### 3.2 排除的虚惊

**i18n 不是缺口。** 扫描报少 94%，实测是架构差（主线 re-export 共享包 vs 基准内联）。
运行时对拍：导出面 15/15 一致，**双语各 1392 键，缺 0 多 0 文案异 0**。

---

## 4. 手上未提交的活（B 块：原生键盘焦点子系统）

**状态：tsc 零错、已编译、定向套件已过。可以提交。**

改动 9 个文件（7 源码 + 2 测试）：

| 文件 | 改了什么 |
|---|---|
| `browser-panel/fixture-layout-host.ts` | 新增 12 个键盘/焦点函数 + `panelGeometry()` 适配 + `focusChromeShortcut`；`bringToFront`/`bringChromeToFront` 加"已排好序就不再置顶"守卫 + 焦点捕获/修复；观察者装配 + destroy 清理 |
| `browser-panel/layout-host.ts` | 契约扩展：`webContents` 加 `isFocused/focus/removeListener/once/setBackgroundThrottling`；`LayoutWindowLike` 加 `webContents/isFocused/removeListener/contentView.children`；接口加 4 个新方法 |
| `browser-panel/ipc.ts` | 4 条 `ipcMain.on` 通道（chrome-input / window-input / window-key / page-shortcut），主 frame 校验；`PanelLike` 加 `layoutHost`/`panelWebContents`；deps 加 `getWindowWebContents` |
| `browser-panel/assembly.ts` | 注入 `electron.webContents` / `electron.app` / `getWindowWebContents` |
| `browser-panel/manager.ts` | `layoutHost` 由 private 改 **public readonly**（否则 IPC 通路静默断） |
| `browser-panel/ui/browser-control-strip.ts` | pointerdown 发 `chrome-input`；新增 `onWindowKey` 订阅 |
| `preload.ts` | 补整段 keyboard-fallback IIFE（IME 合成态/编辑态/浮层判定 + 只上报未被消费的键） |
| `scripts/test-panel-debug-logging.mjs` | 日志计数校准 13→19（新增 6 条 keyboard 日志） |
| `scripts/test-browser-panel-view-drive.mjs` | 主题断言对齐 `shellAppearance` 新接线（**这条是 4299474c 引入的测试网红，已修**） |

### 4.1 B 块的适配点（与基准的有意差异）

- `resolveLayout()` → **`panelGeometry()`**：自建几何，与 `layoutOnce` 同算法（保留主线布局）
- `dispatchWindowKey` 里 `layoutMode === 'focus'` 分支**去掉**（主线无布局模式）
- `endResize('native:mouseUp', screenX)` → **`endResize('native:mouseUp')`**：主线是单参版，
  基准的双参版属"拖拽坐标精度"改进，归布局族，B 不搬
- `focusableOwnedViews` 里 `attachedPanelViews.has(panelView)` → **`panelView !== null`**
  （主线单面板视图，基准是多视图 Map）
- **不搬**：`detachPanelView` / `setActivePanelView`（依赖基准多视图模型）
- **不搬**：`browser-panel:page-escape` 通道（依赖 `setLayoutMode('restore')`）

### 4.2 测试结果

| 套件 | 结果 |
|---|---|
| `test-panel-debug-logging` | **22/22** ✅ |
| `test-browser-panel-policy` | **30/30** ✅ |
| `test-panel-automation` | **41/41** ✅ |
| `test-browser-panel-view-drive` | 168/174，**6 条失败全部既有**（见 §7.3） |

---

## 5. 完整缺口清单

### A 组：主进程接线（13 个模块，源码都已在）

```
platform-host-context      platform-account-context
platform-host-services     platform-deep-memory-service
platform-personal-subject  platform-application-registry
platform-shared-memory-app-client   ← 注入已接（8623c90f），IPC 通道仍缺
knowledge-platform-service          ← trackKnowledgeRouteLifecycle 已接，其余未接
knowledge-reauth
guxiaoman-brand                     ← 已接（8623c90f）
app-browser-panel                   ← 模块已在，createAppBrowserPanelOpener 未接进 SDK deps
assistant-session
error-reporting
```

`main.js` 归一化后比基准少 **58832 字符（10%）**。

### B 组：模块内部能力缺口

| 模块 | 缺 | 状态 |
|---|---|---|
| `browser-panel/fixture-layout-host` | 23 函数 | **键盘/焦点 12 个已接（未提交）**；布局 8 个按 B 决策不搬；多视图 2 个不搬；下载事件/权限/自动化保护待接 |
| `browser-panel/manager` | 12 函数 | 待接：`bindBrowserTask`/`finishBrowserTask`/`controlBrowserTask`/`beginBrowserDispatch`/`assertBrowserDispatch`/`executionGeneration`/`setAutomationLeaseActive`/`_syncAutomationProtection`/`getAutomationPlatform` 等 |
| `local-web-host` | 12 函数 | 待接：`proxyApiToPlatform` + 知识库呈现/品牌化整套（`prepareKnowledgePresentation`/`presentKnowledgeHtml`/`brandKnowledgeHtml`/`brand*`） |
| `knowledge-host-managed` | 7 函数 | 待接：`buildKnowledgeRouteReadinessScript`（缺导出）/`hideGithubEntries`/`ensurePlatformLinks`/`activeNavLabel`/`sectionByTitle`/`currentSection` |
| `dev-workbench/writer` | 53% | ⚠️ **另一套实现，不是缺失**。基准有 `atomicWrite`/`assertSafePath`/`snapshot`/`patchHtml`/`patchNextLayout`/`managedAssets`/`applyLocked`；主线有 `backupFile`/`makeUniqueBackupDir`/`patchIndexHtml`/`inspectAsset`。**需判断题，先对拍定性再问用户** |
| `installer` | 4 函数 | 待接：原站共享安装/卸载锁 `originalOwners`/`pendingOtherOriginalOwner`/`shareOriginal`/`uninstallUnlocked` |
| `http-cloud-client` | 3 函数 + net-retry | 待接：**会员面** `membershipPlans`/`membershipPortalUrl`/`accountAppSubscriptions`（眼镜 CRM 会员营销要用）；`fetchWithRetry` 未接 |
| `app-market` | 2 函数 | 待接：`listCatalogOnce`/`cachedCatalog`（目录单次拉取缓存）。退役门禁**已接** |
| `tab-registry` | 1 函数 + 重试 | 待接：`updateForReuse`；索引 rename **重试循环**（Windows 占用竞争） |
| `artifact-downloader` | 3 函数 + 回退 | 待接：`isRetryableDownloadError`/`formatDownloadError`/`sleep` + 整包回退路径（源码 370 行 vs 基准 625） |
| `dev-workbench/detector` | 3 函数 | 待接：`findRootBody`（缺导出）/`designSystem`/`unsafeWritePath` |
| `browser-panel/broker` | 1 导出 | 待接：`AUTOMATION_WRITES` |
| `backend-handoff-policy` | 1 导出 | 待接：`sessionCookieMaxAgeMs` |
| `preload` | 共享内存面 | 待接：`wanxiangSharedMemory` 暴露（依赖 C 组 IPC） |
| `payment-client` | 1 函数 | 待接：`attemptStateFromStatus` |

### C 组：基础设施（主线压根没有）

- `emitOpenProgress` / `openProgressId` / `localWebHostInflightWaiters` 整套打开进度上报
- `app:sharedMemoryContext` / `app:sharedMemoryInvoke` 两条 IPC + `notifySharedMemoryContextChanged`
- `bumpShellContextGeneration` 里原站实例拆除（`wanxiang-original-` partition detach + clearStorageData）
- `lastPlatformBootstrapProof` / `assistantSession` 两个平台块前置符号
- `appSdkHostRef.registerInstance` 后的 `bindPlatformAppInstance`
- `switchToInstance` 的内置页分支（`openBuiltinDeepMemoryPage`/`openBuiltinDesktopPage`/`releaseKnowledgePlatformForegroundForSelection`）

---

## 6. 方法论（**照这个干，别退回旧口径**）

### 6.1 三层验证，缺一不可

| 层 | 工具 | 作用 |
|---|---|---|
| 导出面 | `scan-exports.cjs` | 缺 API 一眼看到 |
| 内部函数名 | `audit-fnnames.cjs` | 抓"导出齐全但内部整套没实现" |
| **运行时同 realm 对拍** | 基准复制进 dist 再 require + 绝对断言 | **唯一定性依据** |

### 6.2 三条硬教训

1. **不能只数 import 层面统计进度。** 早期报"剩 13 个模块"漏掉了整层模块内部缺口。
2. **尺寸差有假阳性。** i18n 报少 94% 实为架构差。凡大缺口**必须再跑运行时对拍**才敢定性。
3. **IPC 通道对拍要扫全仓 `register('...')` / `ipcMain.handle`，不能只扫 main.ts。**
   早期"39 vs 39 无缺失"是假的齐全 —— 漏了 `commerce-orders-ipc` 内部注册的通道。

### 6.3 每小步流程

```
tsc --noEmit 零错 → tsc 编译 → copy-panel-ui + copy-shell-assets
→ 定向套件 → 全量回归 → 提交
```

**不要重编译 `packages/shell-renderer`**（会把已发布 i18n 从 1392 键打回 1140 键）。

---

## 7. 踩坑清单

### 7.1 系统性陷阱

| 坑 | 症状 | 处置 |
|---|---|---|
| **`core.autocrlf=true`** | 逐字节资产被转 CRLF，sha256/签名全崩 | 新增此类路径**必须**同时加 `.gitattributes -text`，并用 `git show :path` 校验 blob |
| **`node_modules/@jiuzhang/*` 是 junction** | 改了源码不生效 / 测试读到旧内容 | 已全部重指 `D:\wx-merge-120`；再出现先查 junction |
| **asar 偏移** | 提取出来的模块是乱码 | `dataStart = 8 + buf.readUInt32LE(4)`；`header = JSON.parse(buf.slice(16, 16 + buf.readUInt32LE(12)))` |
| **基准 main.js 行号** | 文件混用 CRLF/LF，`Get-Content` 索引与 ripgrep 行号不一致 | 取上下文**必须**用 Node `split(/\r\n|\n|\r/)`（已备 `bl.cjs`） |
| **PowerShell 读中文源文件** | `Get-Content -Raw` + `WriteAllText` 按 ANSI 读成乱码 | 用 edit 工具或 Node utf8 读写 |
| **PowerShell 重定向输出** | `> file` 产 UTF-16，Node 按 utf8 读全是空字符 | 读时判 BOM/空字符，回落 `utf16le` |
| **TS 收窄** | `error`/`deny`/`reject` 箭头函数丢上下文 | 写成**函数声明**；`Object.freeze({...})` 的方法参数需显式标注 |
| **TS 严格函数变型** | 接口里 `fn?: (x: unknown) => T` 与实现不兼容 | 用**方法语法** `fn?(x: unknown): T`（双变） |
| **类型守卫副作用** | `isInstallableAppId` 改成 `appId is string` 后，`if (!...)` 分支里 appId 收窄成 `never` | 错误文案里用 `String(appId).slice(...)` |

### 7.2 已钉定的逐字节资产（`.gitattributes`）

```
vendor/wanxiang-devkit/ARTIFACT-RECEIPT.json -text
vendor/wanxiang-devkit/wanxiang-devkit-0.1.3.tgz -text
schemas/app-manifest-v1.schema.json text eol=crlf      ← 故意 CRLF
apps/shell/renderer/category-vocabulary.js text eol=crlf ← 故意 CRLF
vendor/wanxiang-devkit/MIRRORS.json text eol=lf
apps/shell/src/vendor/** -text
apps/shell/src/dev-workbench/skills/** -text
apps/shell/src/browser-panel/ui/*.css -text
apps/shell/src/browser-panel/ui/*.js -text
apps/shell/src/*.html -text
apps/shell/src/*.css -text
apps/shell/src/*.js -text
apps/shell/renderer/app-icons/** -text
tests/fixtures/artifacts/** -text
tests/fixtures/** -text
```

### 7.3 既有失败（**不是本线引入，别浪费时间查**）

`test-browser-panel-view-drive` 6 条：
- 握柄页结束回调形态 / 指示线常态透明 / hover 现形 / 过渡 0.1s / 分隔线主色
  → 读 `browser-panel-gutter.html`，**本线从未改过该文件**（`git log 23ec7c0e..HEAD` 为空）
- 文件权限 0600 → Windows 不honor POSIX mode

追加组其余失败（全为环境/脚本自身）：
- `test-device-identity` DI-3 / `test-m4-localweb` L3 / `test-r17-guards` R17-17 → **symlink EPERM**（Windows 无符号链接权限）。同类已用 `CAN_SYMLINK` 能力探测降级修过 `test-market-purchase`，这三处可照做
- `test-dir-artifact` / `test-m2-update` / `test-wx12-prune-in-update` → **ESM URL scheme**（Windows 绝对路径 import 需 `pathToFileURL`）。同类已修 `test-default-install`
- `test-runtime-pack-store` → **`D:\D:\` 双盘符路径 bug**
- `test-m4-firstparty` F5.1 → harness 暴露面断言把 `module.exports` 算进去了
- `test-paid-lifecycle-chain` → 缺 `JZ_ACCEPTANCE_STORE_DIR`（需编排串跑）
- `test-staging-e2e` STG-8/19/21 → staging 未配置制品绑定

**这些值得修**（修完回归网才真可用），但属测试脚本层，不是产品缺口。

---

## 8. 环境事实

| 项 | 值 |
|---|---|
| 合并工作树 | `D:\wx-merge-120`，分支 `merge/1.2.0` |
| 基准包 | `.baseline/app.asar`（0.2.14）；`.baseline/modules/` 与 `.baseline/dist-full/` **逐字节一致**（已核 15 模块哈希） |
| 用户原工作树 | `D:\Codex-Wanxiang-cloud-delivery-20261118\shell-0.2.0-merge`、`...\web-market-membership-20261121` —— **不可改动**。里面有用户自己的未提交改动（crm-*/easel-runtime/after-pack），不是本线写的 |
| Windows 官方发布 | **0.2.14** |
| 本机装的 | **0.3.0-dsh.1**（exe 属性写 0.1.38 是错的，只认 asar 内 package.json） |
| Electron | 44.0.0 |
| 正式服 SSH | `ssh kaypal-prod` → root@118.178.108.44 |
| GitHub 中转 | 本机时通时断；推不上去走 bundle → scp → `/root/shell-src-fetch` fetch → push（已验证可用） |
| 平台源码 | 正式服 `/www/wwwroot/kaypal-ai` |
| DB | 容器 `kaypal-postgres-baota` / 库 `kaypal_db` / 用户 `kaypal_user` |
| 眼镜 CRM 应用服 | 101.37.128.23，`https://optical.opensource.kaypal.cn`，容器只绑 127.0.0.1:3120，宿主 nginx 反代 |
| 眼镜 CRM 现状 | 空库、密码 `admin123` 待用户改、店名「明视眼镜」、员工 0 人、双倍积分活动故意「已暂停」 |

---

## 9. 工具清单（可复跑）

全在 `C:\Users\ThinkPad\AppData\Local\Temp\opencode\`：

| 脚本 | 用途 |
|---|---|
| `run-all.cjs` | 33 套全量（新增 21 + 回归 12） |
| `run-extra.cjs` | 追加 34 套（installer/market/sdk/commerce 等） |
| `verify-both.cjs` | 依次跑上面两个，日志落 `verify-all.log` / `verify-extra.log` |
| `audit-sweep.cjs` | **全量归一化尺寸差**（236 模块） |
| `audit-fnnames.cjs` | **内部函数名集合对拍**（用法：`node audit-fnnames.cjs <模块名...>`） |
| `audit-normalized.cjs` | 单模块归一化 + 首分歧定位 |
| `audit-converge.cjs` | 我改过的模块 vs 基准差量 |
| `audit-i18n2.cjs` | i18n 运行时对拍（catalogFor 全键） |
| `scan-exports.cjs` | 导出面对拍（18 模块） |
| `scan-eol-bytes.cjs` | 工作区字节 vs git blob（用法：`node scan-eol-bytes.cjs <路径scope>`） |
| `restore-blob-bytes.cjs` | 把 EOL-only 差异恢复成 blob 原样（`--apply` 才写；有真实改动会跳过） |
| `scan-binary-bytes.cjs` | 全仓真二进制资产字节核查 |
| `bl.cjs` | 按逻辑行号打印基准文件（用法：`node bl.cjs <起> <止> [文件]`，默认基准 main.js） |
| `getmod.cjs` | 从基准 asar 取单个文件（用法：`node getmod.cjs <asar内路径> [输出]`） |
| `extract-dist.cjs` | 按正确偏移提取基准 dist 到 `.baseline/dist-full` |
| `wiring-left.cjs` | 统计 main.ts 尚未 import 的基准模块 |

---

## 10. 下一步顺序（用户已确认 A：全接完再打包）

1. **提交 B 块**（§4，已就绪）
2. **B 块收尾**：`emitDownloadsChanged`/`onDownloadsChanged` + `installPermissionPolicy`
   + `setAutomationProtected`/`applyBackgroundPolicy`（单视图版适配）
3. **`browser-panel/manager`** 任务控制族（12 函数）+ `browser-task-control`/`browser-tools` 接线
4. **本地宿主族**：`local-web-host`（API 反代 + 知识库品牌化）+ `knowledge-host-managed` + `knowledge-runtime`
5. **平台服务块**：13 模块接线 + 2 前置符号 + 内置页分支 + `bindPlatformAppInstance`
6. **商务/会员面**：`http-cloud-client` 会员三函数 + `net-retry` + `payment-client.attemptStateFromStatus`
7. **基础设施**：open-progress / 共享内存 IPC / 组织切换拆除
8. **零散缺口**：installer 共享锁 / tab-registry 重试 / app-market 缓存 / artifact-downloader / dev-workbench
9. **修既有测试脚本问题**（§7.3），让回归网真可用
10. **Phase 3** DSH 默认开启
11. **全量对拍 + 回归**
12. **Phase 4** 打 1.2.0 包 + **真机验收（需用户）**
13. **Phase 5** CI 门禁堵死 dist overlay + 三份扫描进门禁 + **布局分歧显式豁免**

**工期估计：约 9–13 个"今天这种强度"的工作段**（早期报 5–7 偏低，已修正）。

---

## 11. 需要用户参与/裁决的点

1. **真机验收**：包打出来要在装了壳的机器上真点开眼镜卡片。AI 看不到用户屏幕。
2. **`dev-workbench/writer` 判断题**：主线是另一套实现，不是缺失。先对拍定性，**再来问用户**，不擅自决定。
3. **布局分歧**：已选 B。若后面想要基准的布局模式 + 窄窗回退，需另开一轮（A 或 C），B 的键盘部分完全复用。

---

## 12. 相关文档

| 文件 | 内容 |
|---|---|
| `optical-crm\deploy\wanxiang-listing\MERGE-PLAN.md` | 合并方案、Phase 进度、踩坑记录 |
| `optical-crm\deploy\wanxiang-listing\AUDIT-20261127.md` | **自查报告**：方向性核查 + 完整缺口清单 + 修正工期 + 方法论修正 |
| `optical-crm\deploy\wanxiang-listing\APPLIED.md` | 市集上架落地记录与回滚 |
| `optical-crm\交付说明.md` | 眼镜 CRM 总交付文档 |
| 本文件 | 交接总览 |
