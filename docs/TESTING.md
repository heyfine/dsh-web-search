# 测试指南

## 如何运行测试

零第三方依赖，用 Node 24 内置 `node:test`：

```bash
node --test "test/*.test.js"
```

或跑全量校验（typecheck + build + test）：

```bash
node scripts/verify.mjs
```

## 覆盖范围

| 文件 | 覆盖 |
| --- | --- |
| `test/splitKeys.test.js` | `lib/shared.js` 的 splitKeys（管道/逗号/空白分隔、空输入、全空白） |
| `test/clientLoad.test.js` | `lib/client.js` 的 classic-script 加载契约（注册 + 导出齐全） |

## 设计说明

- **不真实 import host 半区**：`lib/index.js` 依赖 DSH 宿主提供的 peer 包（`@deepseek-ai/schemastery` 等），项目内不安装；因此单测只 import 零依赖的 `lib/shared.js`。
- **client.js 用 vm 模拟 classic-script 加载**：DSH client 模块系统把 client.js 当 `<script>` 执行，必须用 `__ModuleLoader__.load` 注册；测试用 vm + react stub 模拟，若文件被写成裸 ESM 会直接抛语法错误（回归防护）。

## 新增用例规范

- 测试放 `test/`，文件名 `*.test.js`。
- 只测纯函数/契约，不发起真实网络请求（密钥不写入测试）。
