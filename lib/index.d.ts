/**
 * dsh-web-search-tavily — Host 半区类型声明。
 *
 * 该包向 DSH 的 `ctx.web` 注册两个搜索提供方：
 *  - `tavily`：Tavily Search API，多 key 轮换 + 配额失败故障转移
 *  - `keenable`：Keenable Search API，多 key 轮换；无 key 时走免 key 公共端点
 * 并通过 `web-search-tavily` 设置命名空间提供「提供方选择 + 密钥管理」，
 * 变更通过 settings onChange 实时切换 `ctx.web.searchProviderId`。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { WebSearchProvider } from "@deepseek-ai/dsh-web";

/** Cordis 插件名（loader 诊断用）。 */
export const name: "web-search-tavily";
/** 该插件需要注入的服务。 */
export const inject: readonly ["web"];
/** 设置命名空间（client 设置卡的 key）。 */
export const TAVILY_SETTINGS_NAMESPACE: "web-search-tavily";
/** Tavily 环境变量名（管道分隔 key 列表）。 */
export const DEFAULT_API_KEYS_ENV: "TAVILY_API_KEYS";
/** Tavily 单 key 环境变量名。 */
export const DEFAULT_API_KEY_ENV: "TAVILY_API_KEY";
/** Tavily Search API 端点。 */
export const TAVILY_SEARCH_URL: string;
/** Keenable keyed Search API 端点。 */
export const KEENABLE_SEARCH_URL: string;
/** Keenable 免 key 公共端点。 */
export const KEENABLE_PUBLIC_URL: string;
/** Tavily 默认单次请求结果上限。 */
export const TAVILY_DEFAULT_MAX_RESULTS: number;
/** Tavily 默认超时（ms）。 */
export const TAVILY_DEFAULT_TIMEOUT_MS: number;
/** 触发「切换到下一把 key」的 HTTP 状态集合。 */
export const ROTATE_STATUSES: ReadonlySet<number>;

/** 将管道/逗号/空白分隔的 key 列表拆分为数组。 */
export function splitKeys(text: string | null | undefined): string[];

/** Tavily 搜索提供方（多 key 轮换 + 故障转移）。 */
export class TavilySearchProvider implements WebSearchProvider {
	readonly id: "tavily";
	available(): boolean;
	search(request: { query: string; maxResults?: number }, signal?: AbortSignal): Promise<{
		sources: Array<{ url: string; title?: string; snippet?: string; publishedAt?: string }>;
		truncated: boolean;
		content?: string;
	}>;
}

/** Keenable 搜索提供方（多 key 轮换；无 key 走公共端点）。 */
export class KeenableSearchProvider implements WebSearchProvider {
	readonly id: "keenable";
	available(): boolean;
	search(request: { query: string; maxResults?: number }, signal?: AbortSignal): Promise<{
		sources: Array<{ url: string; title?: string; snippet?: string; publishedAt?: string }>;
		truncated: boolean;
	}>;
}

/** Cordis 插件 apply 入口。 */
export function apply(ctx: Context, config?: Record<string, unknown>): void;
