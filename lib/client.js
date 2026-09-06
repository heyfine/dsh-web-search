//#region lib/client.js
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-web-search-tavily",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var React = require("react");
/** Cordis plugin name used by loader diagnostics. */
const name = "web-search-tavily";
/** The settings namespace this card edits (matches the Host section). */
const NAMESPACE = "web-search-tavily";
/** Services required by the client half. */
const inject = ["settingsScope", "slots"];

/** Split a key list string on comma/pipe/whitespace, dropping empties. */
function splitKeys(text) {
	return (text ?? "").split(/[\s,|]+/u).map((value) => value.trim()).filter((value) => value.length > 0);
}
/** Mask a key for display: keep the head and tail only. */
function mask(key) {
	return key.length > 12 ? `${key.slice(0, 8)}…${key.slice(-4)}` : "••••••";
}
/** Section snapshot value or an empty object. */
function sectionValue(scope) {
	const snapshot = scope.getSnapshot();
	return snapshot && typeof snapshot.value === "object" && snapshot.value !== null ? snapshot.value : {};
}
/** Copy a key to the clipboard, falling back to execCommand. */
function copyKey(value) {
	if (navigator.clipboard && navigator.clipboard.writeText) {
		navigator.clipboard.writeText(value).catch(() => legacyCopy(value));
	} else {
		legacyCopy(value);
	}
}
function legacyCopy(value) {
	try {
		const ta = document.createElement("textarea");
		ta.value = value;
		ta.style.position = "fixed";
		ta.style.opacity = "0";
		document.body.appendChild(ta);
		ta.select();
		document.execCommand("copy");
		document.body.removeChild(ta);
	} catch (e) {}
}

/** One key row: masked (or revealed), eye toggle, copy, optional credits, remove. */
function KeyRow(props) {
	const item = props.item;
	const [revealed, setRevealed] = React.useState(false);
	const [copied, setCopied] = React.useState(false);
	const remaining = item.remaining != null ? `${item.remaining} / ${item.limit ?? "?"}` : item.error ? "查询失败" : null;
	const display = revealed ? item.full : item.masked;
	const doCopy = () => {
		copyKey(item.full);
		setCopied(true);
		setTimeout(() => setCopied(false), 1200);
	};
	return React.createElement("div", {
		key: item.index,
		style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(128,128,128,0.2)" }
	},
	React.createElement("span", { style: { fontFamily: "monospace", fontSize: 12.5, overflowWrap: "anywhere", wordBreak: "break-all" } }, display),
	React.createElement("span", { style: { display: "flex", alignItems: "center", gap: 6, flexShrink: 0 } },
		remaining != null ? React.createElement("span", { style: { fontSize: 12, opacity: 0.7, whiteSpace: "nowrap" } }, item.plan ? `${item.plan} · 剩余 ` : "剩余 " + remaining) : null,
		React.createElement("button", {
			type: "button",
			onClick: () => setRevealed(!revealed),
			title: revealed ? "隐藏" : "显示完整密钥",
			style: { cursor: "pointer", border: "1px solid rgba(128,128,128,0.35)", background: "transparent", borderRadius: 6, padding: "2px 8px", fontSize: 12, lineHeight: 1.4 }
		}, revealed ? "🙈" : "👁"),
		React.createElement("button", {
			type: "button",
			onClick: doCopy,
			title: "复制密钥",
			style: { cursor: "pointer", border: "1px solid rgba(128,128,128,0.35)", background: "transparent", borderRadius: 6, padding: "2px 8px", fontSize: 12, lineHeight: 1.4 }
		}, copied ? "✓" : "⧉"),
		React.createElement("button", {
			type: "button",
			onClick: () => props.onRemove(item.index),
			title: "删除",
			style: { cursor: "pointer", border: "1px solid rgba(128,128,128,0.35)", background: "transparent", borderRadius: 6, padding: "2px 8px", fontSize: 12, lineHeight: 1.4 }
		}, "删除")));
}

/** Provider selector: Tavily / Keenable / official DeepSeek. */
function ProviderSelect(props) {
	const { value, onChange } = props;
	const options = [
		["tavily", "Tavily（多 key 轮换）"],
		["keenable", "Keenable（多 key 轮换）"],
		["deepseek-official", "DeepSeek 官方搜索"]
	];
	return React.createElement("div", { style: { margin: "4px 0 10px" } },
		React.createElement("div", { style: { fontSize: 12, opacity: 0.7, marginBottom: 4 } }, "当前搜索提供方"),
		React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
			options.map(([id, label]) => React.createElement("label", {
				key: id,
				style: { display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(128,128,128,0.35)", cursor: "pointer", fontSize: 12.5 }
			},
			React.createElement("input", { type: "radio", name: "web-search-provider", checked: value === id, onChange: () => onChange(id) }),
			label))
		));
}

/** The combined web-search card. */
function SearchCard() {
	const scope = React.useContext(PluginServicesContext);
	const [state, setState] = React.useState({ loading: true, provider: "tavily", tavilyKeys: [], keenableKeys: [], text: "", keenableText: "", usage: {}, saving: false, error: "" });
	const refreshUsage = (text) => {
		const keys = splitKeys(text);
		const usage = {};
		keys.forEach((key, index) => {
			usage[index] = { status: "loading" };
			fetch("https://api.tavily.com/usage", { headers: { Authorization: `Bearer ${key}` } }).then((res) => res.ok ? res.json() : null).then((data) => {
				const acc = data && data.account;
				setState((s) => ({ ...s, usage: { ...s.usage, [index]: acc && Number.isFinite(acc.plan_limit) && Number.isFinite(acc.plan_usage) ? { status: "ok", plan: acc.current_plan ?? null, limit: acc.plan_limit, used: acc.plan_usage, remaining: acc.plan_limit - acc.plan_usage } : { status: "error" } } }));
			}).catch(() => setState((s) => ({ ...s, usage: { ...s.usage, [index]: { status: "error" } } })));
		});
		setState((s) => ({ ...s, usage }));
	};
	React.useEffect(() => {
		const apply = () => {
			const v = sectionValue(scope);
			setState((s) => ({
				...s,
				loading: false,
				provider: typeof v.provider === "string" && v.provider.length > 0 ? v.provider : "tavily",
				tavilyKeys: splitKeys(v.apiKeysText),
				keenableKeys: splitKeys(v.keenableKeysText),
				text: "",
				keenableText: ""
			}));
			refreshUsage(v.apiKeysText);
		};
		const dispose = scope.subscribe(apply);
		apply();
		return () => dispose();
	}, []);
	const setField = (field, value) => {
		setState((s) => ({ ...s, saving: true, error: "" }));
		scope.set(field, value).then(() => setState((s) => ({ ...s, saving: false }))).catch(() => setState((s) => ({ ...s, saving: false, error: "保存失败，请重试" })));
	};
	const addTavilyKey = () => {
		const key = state.text.trim();
		if (key.length === 0) return;
		if (state.tavilyKeys.includes(key)) { setState((s) => ({ ...s, error: "这把 key 已存在" })); return; }
		const next = [...state.tavilyKeys, key].join("|");
		setState((s) => ({ ...s, saving: true, error: "" }));
		scope.set("apiKeysText", next).then(() => {
			setState((s) => ({ ...s, text: "", saving: false, tavilyKeys: splitKeys(next) }));
			refreshUsage(next);
		}).catch(() => setState((s) => ({ ...s, saving: false, error: "保存失败，请重试" })));
	};
	const removeTavilyKey = (index) => {
		const next = state.tavilyKeys.filter((_, i) => i !== index).join("|");
		setState((s) => ({ ...s, saving: true, error: "" }));
		scope.set("apiKeysText", next).then(() => {
			setState((s) => ({ ...s, saving: false, tavilyKeys: splitKeys(next) }));
			refreshUsage(next);
		}).catch(() => setState((s) => ({ ...s, saving: false, error: "保存失败，请重试" })));
	};
	const addKeenableKey = () => {
		const key = state.keenableText.trim();
		if (key.length === 0) return;
		if (state.keenableKeys.includes(key)) { setState((s) => ({ ...s, error: "这把 key 已存在" })); return; }
		const next = [...state.keenableKeys, key].join("|");
		setState((s) => ({ ...s, saving: true, error: "" }));
		scope.set("keenableKeysText", next).then(() => {
			setState((s) => ({ ...s, keenableText: "", saving: false, keenableKeys: splitKeys(next) }));
		}).catch(() => setState((s) => ({ ...s, saving: false, error: "保存失败，请重试" })));
	};
	const removeKeenableKey = (index) => {
		const next = state.keenableKeys.filter((_, i) => i !== index).join("|");
		setState((s) => ({ ...s, saving: true, error: "" }));
		scope.set("keenableKeysText", next).then(() => {
			setState((s) => ({ ...s, saving: false, keenableKeys: splitKeys(next) }));
		}).catch(() => setState((s) => ({ ...s, saving: false, error: "保存失败，请重试" })));
	};
	const tavilyRows = state.tavilyKeys.map((key, index) => ({
		index,
		full: key,
		masked: mask(key),
		plan: state.usage[index]?.status === "ok" ? state.usage[index].plan : null,
		limit: state.usage[index]?.status === "ok" ? state.usage[index].limit : null,
		remaining: state.usage[index]?.status === "ok" ? state.usage[index].remaining : null,
		error: state.usage[index]?.status === "error"
	}));
	const keenableRows = state.keenableKeys.map((key, index) => ({ index, full: key, masked: mask(key), plan: null, limit: null, remaining: null, error: false }));
	const btn = { cursor: "pointer", border: "1px solid rgba(128,128,128,0.4)", background: "transparent", borderRadius: 6, padding: "6px 14px", fontSize: 13 };
	const input = { flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(128,128,128,0.4)", background: "transparent", fontSize: 13 };
	return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
		React.createElement("div", null,
			React.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, "Web 搜索（可切换提供方）"),
			React.createElement("div", { style: { fontSize: 12, opacity: 0.7, marginTop: 4 } }, "选择哪个引擎提供 web_search 结果；改动立即生效。")),
		React.createElement(ProviderSelect, { value: state.provider, onChange: (p) => setField("provider", p) }),
		state.provider === "tavily" ? React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
			React.createElement("div", { style: { fontSize: 12, opacity: 0.7 } }, "Tavily：每把 key 一个账号（免费档 1000 credit/月），搜索时一把用尽自动切下一把。"),
			state.loading ? React.createElement("div", { style: { fontSize: 12, opacity: 0.7 } }, "加载中…") : null,
			!state.loading && tavilyRows.length === 0 ? React.createElement("div", { style: { fontSize: 12, opacity: 0.7, padding: "4px 0" } }, "还没有配置 key。把 Tavily key（tvly-…）粘贴到下面添加。") : null,
			tavilyRows.map((item) => React.createElement(KeyRow, { key: item.index, item: item, onRemove: removeTavilyKey })),
			React.createElement("div", { style: { display: "flex", gap: 8 } },
				React.createElement("input", { type: "text", value: state.text, placeholder: "粘贴新的 Tavily key（tvly-…）", onChange: (e) => setState((s) => ({ ...s, text: e.target.value })), onKeyDown: (e) => { if (e.key === "Enter") addTavilyKey(); }, style: input }),
				React.createElement("button", { type: "button", onClick: addTavilyKey, disabled: state.saving || state.text.trim().length === 0, style: btn }, state.saving ? "保存中…" : "添加"),
				React.createElement("button", { type: "button", onClick: () => refreshUsage(state.tavilyKeys.join("|")), style: btn }, "刷新额度")))
		: null,
		state.provider === "keenable" ? React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
			React.createElement("div", { style: { fontSize: 12, opacity: 0.7 } }, "Keenable：免费 100,000 次/月。多 key 自动轮换；一把用尽/失效自动切下一把。余额需在 Console 查看。"),
			!state.loading && keenableRows.length === 0 ? React.createElement("div", { style: { fontSize: 12, opacity: 0.7, padding: "4px 0" } }, "还没有配置 key（留空则走免 key 公共端点）。把 Keenable key（keen_…）粘贴到下面添加。") : null,
			keenableRows.map((item) => React.createElement(KeyRow, { key: item.index, item: item, onRemove: removeKeenableKey })),
			React.createElement("div", { style: { display: "flex", gap: 8 } },
				React.createElement("input", { type: "text", value: state.keenableText, placeholder: "粘贴新的 Keenable key（keen_…）", onChange: (e) => setState((s) => ({ ...s, keenableText: e.target.value })), onKeyDown: (e) => { if (e.key === "Enter") addKeenableKey(); }, style: input }),
				React.createElement("button", { type: "button", onClick: addKeenableKey, disabled: state.saving || state.keenableText.trim().length === 0, style: btn }, state.saving ? "保存中…" : "添加")),
			React.createElement("div", { style: { display: "flex", gap: 8 } },
				React.createElement("a", { href: "https://app.keenable.ai/console", target: "_blank", rel: "noreferrer", style: { fontSize: 12, color: "#005cff" } }, "打开 Keenable Console 查看余额 →")))
		: null,
		state.provider === "deepseek-official" ? React.createElement("div", { style: { fontSize: 12, opacity: 0.7 } }, "DeepSeek 官方搜索：使用官方 Anthropic 端点的原生 web 搜索，按官方计费。无需在此配置。") : null,
		state.error ? React.createElement("div", { style: { fontSize: 12, color: "#e5484d" } }, state.error) : null);
}

/** Provide the bound settings scope to the card via React context. */
const PluginServicesContext = React.createContext(null);
function CardWithScope(props) {
	const scope = props.scope;
	return React.createElement(PluginServicesContext.Provider, { value: scope }, React.createElement(SearchCard, null));
}

/** Register the card into the Plugins settings section. */
function apply(ctx) {
	const scope = ctx.settingsScope.bind({ namespace: NAMESPACE });
	ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
		name: "settings.plugin.item",
		key: NAMESPACE,
		locale: NAMESPACE
	}, () => React.createElement(CardWithScope, { scope: scope })));
}
		exports.NAMESPACE = NAMESPACE;
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
//#endregion
