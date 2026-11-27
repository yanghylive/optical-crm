# 第三方依赖许可清单

本项目（配镜 CRM 轻量版）自身代码采用 **MIT 许可证**（见 `LICENSE`）。

下列第三方依赖全部为**宽松型许可**（permissive），可自由用于商业用途、修改与再分发，
**不含 GPL / AGPL / LGPL 等 copyleft 传染条款**，闭源商用无任何开源义务。

## 直接依赖

| 包 | 版本 | 许可证 | 用途 |
|---|---|---|---|
| express | 4.22.3 | MIT | Web 服务框架 |
| multer | 2.5.0 | MIT | 文件上传（Excel 导入） |
| exceljs | 4.4.0 | MIT | Excel 读写（导入/导出/模板） |

## 传递依赖（完整依赖树 266 个包）

| 许可证 | 数量 | 说明 |
|---|---|---|
| MIT | 227 | 最宽松 |
| ISC | 26 | 宽松 |
| BlueOak-1.0.0 | 5 | 宽松（MIT 类） |
| BSD-3-Clause | 4 | 宽松 |
| Apache-2.0 | 2 | 宽松 |
| `(MIT OR GPL-3.0-or-later)` | 1 | **jszip**：双协议二选一，选 MIT 即可，无传染 |
| `(MIT AND Zlib)` | 1 | 双协议并存，均宽松 |
| **GPL / AGPL / LGPL（唯一）** | **0** | — |
| **无声明 / 不明协议** | **0** | — |

> 结论：**依赖树 100% 为宽松型许可，不含任何 copyleft 传染条款，闭源商用无开源义务。**

## 其他工具链

| 工具 | 许可证 | 用途 |
|---|---|---|
| Node.js | MIT | 运行时 |
| openpyxl | MIT | 仅开发期使用：生成带下拉/校验的导入模板 `templates/配镜记录_导入模板.xlsx` |

## 安全状态

`npm audit --omit=dev` → **0 vulnerabilities**（2026-11 审计）

> 说明：本项目早期版本曾使用 `xlsx`（SheetJS）。该库存在高危原型污染与 ReDoS 公告且 npm 版无修复，
> 而 SheetJS 新版改用了非 Apache 的自有协议。为同时满足「无已知高危」与「协议宽松」，
> 已改用 `exceljs`（MIT）。
>
> `exceljs` 默认依赖链中的 `unzipper@0.10.x → binary@0.3.0 → buffers@0.1.1`，
> 其中 `buffers` **未声明任何许可证**（法理上等同保留所有权利），已通过 `package.json` 的
> `overrides` 将 `unzipper` 提升至 `0.12.5`（MIT）来移除该链路——`0.12.5` 已不再依赖 `binary`。
> 同时用 `overrides` 将 `uuid` 提升至 `11.1.1` 以消除其 buffer 越界公告。

## overrides 说明（package.json）

```json
"overrides": {
  "uuid": "^11.1.1",     // 消除 uuid <11.1.1 的 buffer 越界公告
  "unzipper": "^0.12.5"   // 移除无许可证的 buffers@0.1.1
}
```

> `unzipper@0.12.5` 超出 exceljs 声明的 `^0.10.11` 范围，已通过导入/导出往返测试验证兼容性。

## 复核方法

```powershell
cd app
npm ls --all --json          # 查看完整依赖树
npm audit --omit=dev          # 安全审计
npm install --registry=https://registry.npmmirror.com   # 重装
```

逐包核对协议：

```powershell
node -e "const fs=require('fs');console.log(JSON.parse(fs.readFileSync('node_modules/exceljs/package.json','utf8')).license)"
```

## 许可类型说明（供法务/IT 审核参考）

- **MIT / BSD / ISC**：最宽松。允许闭源商用，唯一义务是保留版权声明。
- **Apache-2.0**：宽松。额外要求：保留 NOTICE、声明修改、不得用原作者商标背书。
- **GPL / AGPL / LGPL**：copyleft。对本项目**不适用**，无需考虑传染风险。
