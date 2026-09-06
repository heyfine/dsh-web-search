import z from "@deepseek-ai/schemastery";
import { WebError } from "@deepseek-ai/dsh-web";
import { installSettingsSection } from "@deepseek-ai/dsh-settings";
import { splitKeys } from "./shared.js";
//#region lib/types/index.js
/**
 * Register Tavily- and Keenable-backed search providers in `ctx.web`, with a
 * user-selectable active provider. Tavily calls its Search API with multi-key
 * rotation and failover; Keenable calls its ranked Search API with an optional
 * key (keyless requests fall back to the public endpoint). The settings card
 * edits a shared namespace (`provider`, tavily `apiKeysText`, keenable key);
 * the active `ctx.web.searchProviderId` is re-selected whenever it changes.
 * @module @deepseek-ai/dsh-web-search-tavily
 */
/** Cordis plugin name used by loader diagnostics. */
const name = "web-search-tavily";
/** The web seam this provider registers into. */
const inject = ["web"];
/** Settings namespace this plugin serves (the settings card's key). */
const TAVILY_SETTINGS_NAMESPACE = "web-search-tavily";
/** Env/credential naming the pipe-separated key list (primary source). */
const DEFAULT_API_KEYS_ENV = "TAVILY_API_KEYS";
/** Env/credential naming a single fallback key. */
const DEFAULT_API_KEY_ENV = "TAVILY_API_KEY";
/** Tavily Search API endpoint (reachable directly, no proxy needed). */
const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
/** Keenable keyed Search API endpoint. */
const KEENABLE_SEARCH_URL = "https://api.keenable.ai/v1/search";
/** Keenable public (keyless) Search API endpoint. */
const KEENABLE_PUBLIC_URL = "https://api.keenable.ai/v1/search/public";
/** Default upper bound on sources one search requests from Tavily. */
const TAVILY_DEFAULT_MAX_RESULTS = 8;
/** Default cooperative timeout (ms) for one Tavily search request. */
const TAVILY_DEFAULT_TIMEOUT_MS = 30000;
/** Attribution header sent on every request. */
const USER_AGENT = "deepseek-harness/0.0.1";
/** HTTP statuses that trigger a rotation to the next key. */
const ROTATE_STATUSES = /* @__PURE__ */ new Set([401, 403, 429, 432, 500, 502, 503, 504]);
const Config = z.object({
	apiKey: z.string().role("secret"),
	apiKeys: z.array(z.string().role("secret")),
	/** Active provider id (`tavily` | `keenable` | `deepseek-official`); edited by the card. */
	provider: z.string().default("tavily"),
	/** Pipe-separated Tavily key list edited by the settings card (primary source). Plain string: a secret role would be redacted off the wire view the card reads. */
	apiKeysText: z.string().default(""),
	/** Pipe-separated Keenable key list edited by the settings card (multi-key rotation). Plain string for the same redaction reason. */
	keenableKeysText: z.string().default(""),
	/** Keenable API key (`keen_…`), legacy single field; multi-key uses `keenableKeysText`. */
	keenableApiKey: z.string().default(""),
	apiKeysEnv: z.string().role("credential-ref").default(DEFAULT_API_KEYS_ENV),
	apiKeyEnv: z.string().role("credential-ref").default(DEFAULT_API_KEY_ENV),
	baseURL: z.string().default(TAVILY_SEARCH_URL),
	maxResults: z.number().step(1).min(1).default(TAVILY_DEFAULT_MAX_RESULTS),
	timeoutMs: z.number().step(1).min(1).default(TAVILY_DEFAULT_TIMEOUT_MS)
});
/** Split a key list string on comma/pipe/whitespace, dropping empties. */
/** Read a response body as text best-effort (for error inspection). */
async function safeText(response) {
	try {
		return await response.text();
	} catch {
		return "";
	}
}
/** Whether a failed response should trigger the next key. */
function shouldRotate(status, bodyText) {
	if (ROTATE_STATUSES.has(status)) return true;
	return /(quota|credit|limit|exhaust|usage|monthly|upgrade|paid|rate|denied|invalid)/i.test(bodyText);
}
/** A Tavily-backed search provider with round-robin key failover. */
var TavilySearchProvider = class {
	/** Options snapshotted for one provider instance. */
	options;
	id = "tavily";
	/** Round-robin cursor persisted across searches for the process lifetime. */
	cursor = 0;
	constructor(options) {
		this.options = options;
	}
	/** Available when a literal key array, a single literal key, or a credential source can resolve keys. */
	available() {
		return this.options.available;
	}
	/** Run one search, rotating across configured keys on quota/auth failures. */
	async search(request, signal) {
		const keys = await this.options.resolveKeys();
		if (keys.length === 0) throw new WebError(`Tavily search has no API key configured (${this.options.apiKeysEnv} / ${this.options.apiKeyEnv})`, "WEB_PROVIDER_CREDENTIAL_MISSING");
		const maxResults = request.maxResults ?? this.options.maxResults;
		let lastError = "unknown";
		const attempts = keys.length;
		for (let i = 0; i < attempts; i++) {
			const index = (this.cursor + i) % keys.length;
			const apiKey = keys[index];
			let response;
			try {
				response = await fetch(this.options.baseURL, {
					method: "POST",
					headers: {
						"content-type": "application/json",
						"user-agent": USER_AGENT
					},
					body: JSON.stringify({
						api_key: apiKey,
						query: request.query,
						max_results: maxResults
					}),
					...(signal !== void 0 ? { signal } : {})
				});
			} catch (error) {
				if (signal?.aborted === true) throw error;
				lastError = `Tavily search request failed: ${String(error)}`;
				continue;
			}
			if (response.ok) {
				this.cursor = (index + 1) % keys.length;
				let data;
				try {
					data = await response.json();
				} catch (error) {
					throw new WebError(`Tavily returned an unprocessable response body: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
				}
				const sources = (data.results ?? []).map((result) => ({
					url: result.url,
					...(typeof result.title === "string" && result.title.length > 0 ? { title: result.title } : {}),
					...(typeof result.content === "string" && result.content.length > 0 ? { snippet: result.content } : {}),
					...(typeof result.published_date === "string" && result.published_date.length > 0 ? { publishedAt: String(result.published_date) } : {})
				}));
				return {
					sources,
					truncated: false,
					...(typeof data.answer === "string" && data.answer.length > 0 ? { content: data.answer } : {})
				};
			}
			const body = await safeText(response);
			if (response.status === 401) lastError = `Tavily rejected an API key (HTTP ${response.status}); it may be invalid or out of credits`;
			else lastError = `Tavily search error (HTTP ${response.status})`;
			if (!shouldRotate(response.status, body)) throw new WebError(lastError, "WEB_PROVIDER_ERROR");
		}
		throw new WebError(`Tavily search failed after trying ${attempts} key(s): ${lastError}`, "WEB_PROVIDER_ERROR");
	}
};
/** A Keenable-backed search provider with multi-key rotation; keyless requests use the public endpoint. */
var KeenableSearchProvider = class {
	/** Options snapshotted for one provider instance. */
	options;
	id = "keenable";
	/** Round-robin cursor persisted across searches for the process lifetime. */
	cursor = 0;
	constructor(options) {
		this.options = options;
	}
	/** Always available: with keys the keyed endpoint, without keys the public endpoint. */
	available() {
		return true;
	}
	/** Run one search, rotating across configured keys on quota/auth failures. */
	async search(request, signal) {
		const keys = await this.options.resolveKeys();
		const lastError = "unknown";
		if (keys.length === 0) {
			// No key configured: fall back to the keyless public endpoint.
			return this.request(request, "", true, signal);
		}
		const attempts = keys.length;
		for (let i = 0; i < attempts; i++) {
			const index = (this.cursor + i) % keys.length;
			const apiKey = keys[index];
			let result;
			try {
				result = await this.request(request, apiKey, false, signal);
			} catch (error) {
				if (signal?.aborted === true) throw error;
				lastError = `Keenable key failed: ${String(error.message ?? error)}`;
				continue;
			}
			this.cursor = (index + 1) % keys.length;
			return result;
		}
		throw new WebError(`Keenable search failed after trying ${attempts} key(s): ${lastError}`, "WEB_PROVIDER_ERROR");
	}
	/** Issue one Keenable Search API call with the given key (or the public endpoint when keyless). */
	async request(request, apiKey, keyless, signal) {
		const endpoint = keyless ? this.options.publicURL : this.options.baseURL;
		const headers = {
			"content-type": "application/json",
			"user-agent": USER_AGENT
		};
		if (keyless) headers["x-keenable-title"] = "DSH-Web-Search";
		else headers["x-api-key"] = apiKey;
		let response;
		try {
			response = await fetch(endpoint, {
				method: "POST",
				headers,
				body: JSON.stringify({ query: request.query }),
				...(signal !== void 0 ? { signal } : {})
			});
		} catch (error) {
			if (signal?.aborted === true) throw error;
			throw new WebError(`Keenable search request failed: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
		}
		if (!response.ok) {
			let message = `Keenable search error (HTTP ${response.status})`;
			const body = await safeText(response);
			try {
				const parsed = JSON.parse(body);
				const detail = parsed?.error?.message ?? parsed?.message ?? parsed?.detail;
				if (typeof detail === "string" && detail.length > 0) message = detail;
			} catch {}
			throw new WebError(message, "WEB_PROVIDER_ERROR");
		}
		let data;
		try {
			data = await response.json();
		} catch (error) {
			throw new WebError(`Keenable returned an unprocessable response body: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
		}
		const sources = (data.results ?? []).map((result) => ({
			url: result.url,
			...(typeof result.title === "string" && result.title.length > 0 ? { title: result.title } : {}),
			...(typeof result.snippet === "string" && result.snippet.length > 0 ? { snippet: result.snippet } : {}),
			...(typeof result.description === "string" && result.description.length > 0 && typeof result.snippet !== "string" ? { snippet: result.description } : {}),
			...(typeof result.acquired_at === "string" && result.acquired_at.length > 0 ? { publishedAt: String(result.acquired_at) } : {})
		}));
		return { sources, truncated: false };
	}
};
/** Register the Tavily + Keenable search providers and wire provider selection. */
function apply(ctx, config) {
	const apiKeysEnv = config.apiKeysEnv ?? DEFAULT_API_KEYS_ENV;
	const apiKeyEnv = config.apiKeyEnv ?? DEFAULT_API_KEY_ENV;
	const literalKeys = (config.apiKeys ?? []).filter((key) => key.length > 0);
	const literalSingle = config.apiKey !== void 0 && config.apiKey.length > 0 ? [config.apiKey] : [];
	const baseURL = config.baseURL ?? TAVILY_SEARCH_URL;
	const maxResults = config.maxResults ?? TAVILY_DEFAULT_MAX_RESULTS;
	/** The settings namespace's current section; card edits reach the next search without a restart. */
	let current = () => config;
	/** Re-select the active web provider whenever the settings section changes. */
	const reselectProvider = () => {
		const section = typeof current() === "object" && current() !== null ? current() : {};
		const selected = typeof section.provider === "string" && section.provider.length > 0 ? section.provider : "tavily";
		const web = ctx.get("web");
		if (web === void 0) return;
		web.searchProviderId = selected === "deepseek-official" || selected === "tavily" || selected === "keenable" ? selected : "tavily";
	};
	installSettingsSection(ctx, TAVILY_SETTINGS_NAMESPACE, Config, config, {
		setSource: (source) => {
			current = source;
			reselectProvider();
		},
		onChange: () => {
			reselectProvider();
		}
	});
	/** Re-resolved at each search: settings apiKeysText first, then credentials, then env. */
	const resolveKeys = async () => {
		if (literalKeys.length > 0) return literalKeys;
		if (literalSingle.length > 0) return literalSingle;
		const settings = ctx.get("settings");
		if (settings !== void 0) {
			const section = settings.get(TAVILY_SETTINGS_NAMESPACE);
			if (section !== void 0 && typeof section === "object" && !Array.isArray(section)) {
				const text = section.apiKeysText;
				if (typeof text === "string" && text.trim().length > 0) {
					const keys = splitKeys(text);
					if (keys.length > 0) return keys;
				}
			}
		}
		const cred = ctx.get("credentials");
		if (cred !== void 0) {
			const multi = await cred.resolve(apiKeysEnv);
			if (multi?.value !== void 0 && multi.value.length > 0) {
				const keys = splitKeys(multi.value);
				if (keys.length > 0) return keys;
			}
			const single = await cred.resolve(apiKeyEnv);
			if (single?.value !== void 0 && single.value.length > 0) {
				const keys = splitKeys(single.value);
				return keys.length > 0 ? keys : [single.value];
			}
		}
		const envMulti = process.env[apiKeysEnv];
		if (envMulti !== void 0 && envMulti.trim().length > 0) {
			const keys = splitKeys(envMulti);
			if (keys.length > 0) return keys;
		}
		const envSingle = process.env[apiKeyEnv];
		return envSingle !== void 0 && envSingle.length > 0 ? [envSingle] : [];
	};
	/** Keenable keys: settings keenableKeysText (pipe list) first, then legacy keenableApiKey, then env. */
	const resolveKeenableKeys = async () => {
		const settings = ctx.get("settings");
		if (settings !== void 0) {
			const section = settings.get(TAVILY_SETTINGS_NAMESPACE);
			if (section !== void 0 && typeof section === "object" && !Array.isArray(section)) {
				if (typeof section.keenableKeysText === "string" && section.keenableKeysText.trim().length > 0) {
					const keys = splitKeys(section.keenableKeysText);
					if (keys.length > 0) return keys;
				}
				if (typeof section.keenableApiKey === "string" && section.keenableApiKey.trim().length > 0) return [section.keenableApiKey.trim()];
			}
		}
		if (typeof config.keenableKeysText === "string" && config.keenableKeysText.trim().length > 0) {
			const keys = splitKeys(config.keenableKeysText);
			if (keys.length > 0) return keys;
		}
		if (typeof config.keenableApiKey === "string" && config.keenableApiKey.trim().length > 0) return [config.keenableApiKey.trim()];
		const envMulti = process.env.KEENABLE_API_KEYS;
		if (envMulti !== void 0 && envMulti.trim().length > 0) {
			const keys = splitKeys(envMulti);
			if (keys.length > 0) return keys;
		}
		const env = process.env.KEENABLE_API_KEY;
		return env !== void 0 && env.length > 0 ? [env] : [];
	};
	const provider = new TavilySearchProvider({
		apiKeysEnv,
		apiKeyEnv,
		available: literalKeys.length > 0 || literalSingle.length > 0 || ctx.get("settings") !== void 0 || ctx.get("credentials") !== void 0,
		baseURL,
		maxResults,
		resolveKeys
	});
	const keenable = new KeenableSearchProvider({
		baseURL: KEENABLE_SEARCH_URL,
		publicURL: KEENABLE_PUBLIC_URL,
		maxResults,
		resolveKeys: resolveKeenableKeys
	});
	ctx.web.registerSearchProvider(provider);
	ctx.web.registerSearchProvider(keenable);
	reselectProvider();
}
//#endregion
export { Config, DEFAULT_API_KEYS_ENV, DEFAULT_API_KEY_ENV, KEENABLE_PUBLIC_URL, KEENABLE_SEARCH_URL, ROTATE_STATUSES, TAVILY_DEFAULT_MAX_RESULTS, TAVILY_DEFAULT_TIMEOUT_MS, TAVILY_SEARCH_URL, TAVILY_SETTINGS_NAMESPACE, KeenableSearchProvider, TavilySearchProvider, apply, inject, name, splitKeys };
