# DSH Web 搜索插件（dsh-web-search-tavily）

给 **DeepSeek Harness（DSH）** 提供可切换的 Web 搜索能力：注册 **Tavily** 与 **Keenable** 两个搜索提供方（均支持多 key 轮换），并在 DSH 设置里提供可视化卡片——切换提供方、管理密钥、查看 Tavily 各 key 剩余额度、复制/显示密钥。

> 本仓库是 DSH 插件包 `@deepseek-ai/dsh-web-search-tavily` 的源码与文档。
> 部署方式：将 `lib/` 两个文件放入 DSH profile 的
> `node_modules/@deepseek-ai/dsh-web-search-tavily/`，并按
> [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) 在 `cordis.patch.yml` 注册。

## 功能

- **两个搜索提供方，一键切换**（设置卡单选）：
  - `tavily`：Tavily Search API，多 key 轮换，每把 key 显示剩余额度（1000 credit/月免费档）
  - `keenable`：Keenable Search API，多 key 轮换；无 key 自动走免 key 公共端点（100K 次/月免费）
  - `deepseek-official`：DSH 官方 DeepSeek 搜索（由官方包提供，本包仅负责切换选择）
- **密钥管理**：每把 key 打码显示，支持 👁 显示/隐藏、⧉ 复制、删除、添加
- **实时生效**：设置卡改动写回 `web-search-tavily` 设置命名空间，Host 侧 `onChange` 即时切换 `ctx.web.searchProviderId`，无需重启
- **多 key 故障转移**：一把 key 配额耗尽 / 鉴权失败 / 5xx → 自动切下一把重试

## 常用命令

```bash
node scripts/typecheck.mjs   # 语法 + 导出 + classic-script 契约校验（零依赖）
node scripts/build.mjs       # 构建校验（同 typecheck + 包清单）
node --test "test/*.test.js" # 运行单元测试（node 内置 runner，零依赖）
node scripts/verify.mjs      # 依次执行以上全部
```

> 本机 npm/pnpm 的 `.cmd` 存在中文编码故障，故脚本全部用 `node` 直调、零第三方依赖；
> 测试用 Node 24 内置 `node:test`，不引入 vitest。

## 目录结构

```
lib/
  index.js         Host 半区：注册 tavily/keenable 两个 provider + provider 选择切换
  client.js        Client 半区：设置卡（classic-script，__ModuleLoader__ 包装）
  shared.js        零依赖纯函数（splitKeys 等），host 与测试复用
  index.d.ts       Host 半区类型声明
  client.d.ts      Client 半区类型声明
scripts/
  typecheck.mjs    语法 + 导出 + classic-script 契约校验
  build.mjs        构建校验
  check-classic.mjs client.js 的 classic-script 加载模拟（防「loaded without registering」）
test/              单元测试（node:test）
docs/              项目文档
```

## 关键设计

- **client.js 必须是 classic-script**：DSH 的 client 模块系统把 `client.js` 当 `<script>`
  执行，必须用 `window.__ModuleLoader__.load({ id, factory })` 注册。写成裸 ESM（`export` 结尾）
  会报 `loaded without registering ... via __ModuleLoader__.load`。见 [docs/DEV_NOTE.md](docs/DEV_NOTE.md)。
- **设置字段不能用 secret 角色**：`apiKeysText`/`keenableKeysText` 是卡片读写的明文列表，
  若标 `role("secret")` 会被 DSH 设置服务在 wire 视图上脱敏，卡片读回为空。见 [docs/DEV_NOTE.md](docs/DEV_NOTE.md)。
- **provider 切换**：`ctx.web.searchProviderId` 是可写实例属性，Host 在 settings onChange 时重新赋值即可实时切换。

## 环境变量

| 变量 | 用途 | 必填 | 示例 |
| --- | --- | --- | --- |
| `TAVILY_API_KEY` | Tavily 单 key 兜底 | 否 | `tvly-xxxxxxxx...` |
| `TAVILY_API_KEYS` | Tavily 多 key（`\|` 分隔）兜底 | 否 | `tvly-a\|tvly-b` |
| `KEENABLE_API_KEY` | Keenable 单 key 兜底 | 否 | `keen_xxxxxxxx...` |
| `KEENABLE_API_KEYS` | Keenable 多 key 兜底 | 否 | `keen-a\|keen-b` |

复制 `.env.example` 为 `.env.local` 填写；**推荐**通过 DSH 设置卡在线管理（写入 settings.yaml 的 `web-search-tavily` 段），环境变量仅作兜底读取源。

## 部署

- 平台：DeepSeek Harness（DSH Desktop / web profile）
- 详细步骤见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## AI 接手指南

1. 先读 [AGENTS.md](AGENTS.md)（行为约定）→ [docs/WIP.md](docs/WIP.md)（当前进度）→ [docs/PROJECT_MEMORY.md](docs/PROJECT_MEMORY.md)（环境/架构/踩坑）
2. 需要理解来龙去脉再读 [docs/BUILD_LOG.md](docs/BUILD_LOG.md)

## 更新规则

- 功能 / 目录结构 / 环境变量 / 部署方式变化 → 同步更新本文件与对应 docs
