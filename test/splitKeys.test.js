import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { splitKeys } from "../lib/shared.js";

describe("splitKeys", () => {
	test("拆分管道分隔的 key 列表", () => {
		assert.deepEqual(splitKeys("key1|key2|key3"), ["key1", "key2", "key3"]);
	});

	test("容忍空格和多余分隔符", () => {
		assert.deepEqual(splitKeys("  key1 , key2 |  key3  "), ["key1", "key2", "key3"]);
	});

	test("空输入返回空数组", () => {
		assert.deepEqual(splitKeys(""), []);
		assert.deepEqual(splitKeys(undefined), []);
		assert.deepEqual(splitKeys(null), []);
	});

	test("全空白返回空数组", () => {
		assert.deepEqual(splitKeys("   "), []);
	});
});
