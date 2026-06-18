// Extract the exact MoveCall target(s) the aggregator emits for Cetus + DeepBook
// swaps, by scanning the SDK's compiled dist for target construction.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const dir = dirname(require.resolve("@cetusprotocol/aggregator-sdk"));

const src = readFileSync(join(dir, "index.js"), "utf8");
const ls = src.split("\n");

function ctxHits(re, ctx = 1, max = 40) {
  const out = [];
  for (let i = 0; i < ls.length && out.length < max; i++) {
    if (re.test(ls[i])) {
      const chunk = [];
      for (let j = Math.max(0, i - ctx); j <= Math.min(ls.length - 1, i + ctx); j++) chunk.push(`${j + 1}: ${ls[j].trim().slice(0, 160)}`);
      out.push(chunk.join("\n"));
    }
  }
  return out.join("\n---\n") || "(none)";
}

console.log("=== ::cetus:: / ::deepbookv3:: literal targets ===");
console.log(ctxHits(/::cetus::|::deepbookv3::|::deepbook::|cetus::swap|deepbookv3::swap/, 0, 30));

console.log("\n=== target/composeType build for swap (cetus module) ===");
console.log(ctxHits(/createTarget\([^)]*swap|composeType\([^)]*swap|target:\s*`\$\{[^}]*\}::\w+::swap|\.move[Cc]all\(\{/, 1, 25));

console.log("\n=== 'swap_a2b' / 'swap_b2a' / swap func names ===");
console.log(ctxHits(/swap_a2b|swap_b2a|"swap"|'swap'|`swap`|flash_swap/, 0, 30));
