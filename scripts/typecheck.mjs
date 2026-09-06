/**
 * 类型/语法校验：零第三方依赖。
 *
 * 注意：lib/index.js 依赖 DSH 宿主提供的 peer 包（@deepseek-ai/schemastery 等），
 * 项目内不安装这些包，因此不能真实 import（会 ERR_MODULE_NOT_FOUND）。
 * 这里做三层静态/契约校验：
 *  1. lib/index.js（host ESM）：node --check 语法
 *  2. lib/client.js（client classic-script）：node --check 语法 + classic 加载契约（check-classic.mjs）
 *  3. host 导出完整性：静态解析 export 语句，断言关键导出名存在
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const node = process.execPath;

// 1. 语法检查两个半区（node --check 只解析不解析 import，无需依赖）
for (const file of ["lib/index.js", "lib/client.js"]) {
	execFileSync(node, ["--check", path.join(root, file)], { stdio: "pipe" });
	console.log(`语法检查通过: ${file}`);
}

// 2. host 导出完整性：解析 export {...} 语句里的名字
const hostSource = readFileSync(path.join(root, "lib", "index.js"), "utf8");
const exportMatch = hostSource.match(/export \{([^}]+)\}/);
if (!exportMatch) {
	console.error("lib/index.js 未找到 export 语句");
	process.exit(1);
}
const exported = new Set(exportMatch[1].split(",").map((name) => name.trim()).filter(Boolean));
for (const key of ["apply", "inject", "name", "TavilySearchProvider", "KeenableSearchProvider", "splitKeys", "Config", "TAVILY_SETTINGS_NAMESPACE"]) {
	if (!exported.has(key)) {
		console.error(`lib/index.js 缺少导出: ${key}`);
		process.exit(1);
	}
}
console.log("lib/index.js 导出完整性: 通过");

// 3. client 半区 classic-script 契约
await import(pathToFileURL(path.join(root, "scripts", "check-classic.mjs")).href);
console.log("typecheck 全部通过 ✓");
