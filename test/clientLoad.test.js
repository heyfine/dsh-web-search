import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 在 classic-script 语义下加载 lib/client.js（DSH client 模块系统的真实加载方式），
 * 验证注册契约与导出完整性。若文件写成裸 ESM，这里会抛语法错误。
 */
let clientExports;

before(() => {
	const code = readFileSync(path.join(root, "lib", "client.js"), "utf8");
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
	vm.runInContext(code, sandbox);
	const factory = factories.get("@deepseek-ai/dsh-web-search-tavily");
	if (!factory) throw new Error("client.js 未注册 __ModuleLoader__");
	clientExports = factory(sandbox.require);
});

describe("client.js 加载契约", () => {
	test("导出齐全 (NAMESPACE / apply / inject / name)", () => {
		assert.equal(clientExports.NAMESPACE, "web-search-tavily");
		assert.equal(typeof clientExports.apply, "function");
		assert.ok(Array.isArray(clientExports.inject));
		assert.equal(clientExports.name, "web-search-tavily");
	});
});
