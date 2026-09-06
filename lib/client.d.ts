/**
 * dsh-web-search-tavily — Client 半区类型声明。
 *
 * 在 DSH 设置 → 插件 → Web 搜索 渲染设置卡：提供方选择（Tavily / Keenable /
 * DeepSeek 官方）、Tavily 多 key 列表（每把显示剩余额度 + 眼睛/复制/删除）、
 * Keenable 多 key 列表。所有编辑写回 `web-search-tavily` 设置命名空间，
 * Host 侧 onChange 实时生效。
 */

/** Cordis 插件名（loader 诊断用）。 */
export const name: "web-search-tavily";
/** 该插件需要注入的服务。 */
export const inject: readonly ["settingsScope", "slots"];
/** 设置命名空间（与 Host 一致）。 */
export const NAMESPACE: "web-search-tavily";

/** 注册设置卡到 `settings.plugin.item`。 */
export function apply(ctx: import("@deepseek-ai/cordis").Context): void;
