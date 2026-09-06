/**
 * 全量校验：typecheck → build → test（零第三方依赖，node 直调）。
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const node = process.execPath;

const steps = [
	["typecheck", [path.join(root, "scripts", "typecheck.mjs")]],
	["build", [path.join(root, "scripts", "build.mjs")]],
	["test", ["--test", "test/*.test.js"]],
];

for (const [label, args] of steps) {
	console.log(`\n===== ${label} =====`);
	const result = spawnSync(node, args, { stdio: "inherit", cwd: root });
	if (result.status !== 0) {
		console.error(`${label} 失败 (exit ${result.status})`);
		process.exit(result.status ?? 1);
	}
}
console.log("\nverify 全部通过 ✓");
