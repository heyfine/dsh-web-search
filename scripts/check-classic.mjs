/**
 * 验证 lib/client.js 能被 DSH 的 client 模块系统正确加载。
 *
 * DSH 把 client.js 当作 classic script（<script> 标签语义）执行，要求文件以
 * `window.__ModuleLoader__.load({ id, factory })` 注册。若写成了裸 ESM
 * （export 结尾），classic script 解析会抛语法错误 → 报
 * "loaded without registering ... via __ModuleLoader__.load"。
 *
 * 本脚本用 vm 模拟 harness 的真实加载：提供 __ModuleLoader__ + require 的
 * react stub，按 classic-script 语义执行整个文件，并 materialize 工厂，
 * 断言导出齐全。这是 client.js 的强制性校验，提交前必须通过。
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "lib", "client.js");
const ID = "@deepseek-ai/dsh-web-search-tavily";
const code = readFileSync(file, "utf8");

const factories = new Map();
const sandbox = {
	console,
	navigator: { clipboard: { writeText: () => Promise.resolve() } },
	document: {
		createElement: () => ({ style: {}, select() {}, remove() {} }),
		body: { appendChild() {}, removeChild() {} },
		execCommand: () => true,
	},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.__ModuleLoader__ = {
	load(handoff) {
		if (factories.has(handoff.id)) throw new Error(`duplicate ${handoff.id}`);
		factories.set(handoff.id, handoff.factory);
	},
};
const reactStub = {
	createElement() {
		return null;
	},
	useState() {
		return [null, () => {}];
	},
	useEffect() {},
	useContext() {
		return {
			getSnapshot() {
				return { value: {} };
			},
			set() {
				return Promise.resolve();
			},
			subscribe() {
				return () => {};
			},
		};
	},
	createContext() {
		return { Provider() { return null; } };
	},
};
sandbox.require = (spec) => {
	if (spec === "react") return reactStub;
	throw new Error(`missed module table: ${spec}`);
};

vm.createContext(sandbox);
try {
	vm.runInContext(code, sandbox);
} catch (error) {
	console.error(`client.js 不是合法 classic script: ${error.message}`);
	process.exit(1);
}
if (!factories.has(ID)) {
	console.error(`client.js 未通过 __ModuleLoader__.load 注册 ${ID}`);
	process.exit(1);
}
const exports_ = factories.get(ID)(sandbox.require);
for (const key of ["NAMESPACE", "apply", "inject", "name"]) {
	if (!exports_[key]) {
		console.error(`client.js 工厂导出缺失: ${key}`);
		process.exit(1);
	}
}
console.log("client.js classic-script 校验通过: 注册成功, 导出齐全");
