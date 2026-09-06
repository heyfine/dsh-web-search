# 部署指南

本插件部署目标：**DeepSeek Harness（DSH）**，作为 web profile 的 out-of-tree cordis 插件包。

## 部署目标

- 平台：DeepSeek Harness（DSH Desktop，web profile）
- 仓库：https://github.com/heyfine/dsh-web-search.git
- 详细操作见下方「安装步骤」。

## 前置条件

- 已安装 DSH Desktop；web profile 目录：`$DSH_HOME/profiles/web/`（本机 `C:\Users\M\.dsh\profiles\web\`）
- 至少一个搜索 key：Tavily（`tvly-`）或 Keenable（`keen_`）；均可多个、用 `|` 分隔

## 安装步骤

### 1. 安装插件包

把 `lib/index.js` 与 `lib/client.js` 放入：

```
<profile>/node_modules/@deepseek-ai/dsh-web-search-tavily/lib/
```

（连同 package.json 一起放也可以；peer 依赖由 DSH 宿主提供，无需安装。）

### 2. 注册到组合

编辑 `<profile>/cordis.patch.yml`，追加：

```yaml
- id: web
  config:
    searchProvider: tavily
- insert:
    - id: web-search-tavily
      name: '@deepseek-ai/dsh-web-search-tavily'
```

- `searchProvider` 是启动默认提供方（tavily / keenable / deepseek-official 三选一）；之后可在设置卡实时切换，无需再改这里。
- 校验组合：`dsh --profile web --dump-config`（应看到 `searchProvider` 与 `web-search-tavily` 行）。

### 3. 配置密钥（二选一）

**方式 A（推荐，在线管理）**：重启 DSH 后打开 设置 → 插件 → Web 搜索，在卡片里粘贴 key、点添加/保存。

**方式 B（直接写入 settings.yaml）**：

```yaml
web-search-tavily:
  apiKeysText: tvly-xxx|tvly-yyy
  keenableKeysText: keen_xxx|keen_yyy
  provider: keenable
```

环境变量（`TAVILY_API_KEY` 等）仅作兜底读取源，见 `.env.example`。

### 4. 重启生效

重启 DSH Desktop；设置 → 插件 → Web 搜索 应出现三合一卡片。

## 验证

- 设置卡能切换提供方、增删 key、Tavily 行显示剩余额度（Keenable 无额度接口，需去 Console 查看）
- 新对话问一个时效性问题，AI 会调用 web_search 走当前提供方

## 回滚

- 删除 `cordis.patch.yml` 里新增的两段，或把 `searchProvider` 改回 `deepseek-official`
- 移除 profile 里的 `dsh-web-search-tavily` 目录
