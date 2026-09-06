/**
 * 构建校验：确认两个半区都可用，产出可安装包形态。
 *
 * 本插件是 cordis 双端包：host 半区为 ESM（lib/index.js），client 半区为
 * classic-script（lib/client.js）。"构建"不产生转译产物（源码即发布格式），
 * 这里做三件事：
 *  1. host 半区：ESM 语法 + 可导入
 *  2. client 半区：classic-script 语义校验（复用 check-classic 逻辑）
 *  3. 输出包清单（files 字段声明的文件必须存在）
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

// 1. host ESM 静态导出检查（不 import，避免 peerDeps 解析）
const hostSource = readFileSync(path.join(root, "lib", "index.js"), "utf8");
const exportMatch = hostSource.match(/export \{([^}]+)\}/);
if (!exportMatch) {
	console.error("lib/index.js 未找到 export 语句");
	process.exit(1);
}
const exported = new Set(exportMatch[1].split(",").map((name) => name.trim()).filter(Boolean));
for (const key of ["apply", "inject", "name", "TavilySearchProvider", "KeenableSearchProvider", "splitKeys"]) {
	if (!exported.has(key)) {
		console.error(`lib/index.js 缺少导出: ${key}`);
		process.exit(1);
	}
}
console.log("lib/index.js (host ESM): 导出完整性通过");

// 2. client classic-script 校验
await import(pathToFileURL(path.join(root, "scripts", "check-classic.mjs")).href);
console.log("lib/client.js (client classic-script): 校验通过");

// 3. files 声明检查
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
for (const file of pkg.files ?? []) {
	if (!existsSync(path.join(root, file))) {
		console.error(`files 声明但文件不存在: ${file}`);
		process.exit(1);
	}
}
console.log(`包清单检查通过: ${(pkg.files ?? []).join(", ")}`);
console.log("构建校验完成 ✓");
