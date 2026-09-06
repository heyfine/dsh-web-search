/**
 * 零依赖纯函数，供 host 半区与测试复用。
 *
 * 注意：client 半区是 classic-script（不能用 import），因此 client.js 内保留了
 * 这些函数的本地副本；本文件是 host 半区与单测的单一事实来源。
 */

/** 将管道/逗号/空白分隔的 key 列表拆分为数组，丢弃空项。 */
export function splitKeys(text) {
	return (text ?? "").split(/[\s,|]+/u).map((value) => value.trim()).filter((value) => value.length > 0);
}
