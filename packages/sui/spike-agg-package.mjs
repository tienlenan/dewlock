import { readFileSync } from "node:fs";
const raw = await import("@cetusprotocol/aggregator-sdk");
const m = raw.AggregatorClient ? raw : (raw.default ?? raw);

console.log("=== SDK package/module constants ===");
for (const k of ["AGGREGATOR", "INTEGRATE", "CETUS", "CETUS_MODULE", "CETUS_PUBLISHED_AT",
  "MAINNET_CETUS_V3_PUBLISHED_AT", "DEEPBOOKV3", "DEEPBOOK_PACKAGE_ID", "DEEPBOOK_PUBLISHED_AT",
  "DEFAULT_AGG_V3_ENDPOINT"]) {
  try { console.log(`${k} =`, m[k]); } catch {}
}
try {
  console.log("getAggregatorV2PublishedAt =", m.getAggregatorV2PublishedAt?.());
  console.log("getAggregatorV2ExtendPublishedAt =", m.getAggregatorV2ExtendPublishedAt?.());
  console.log("getAggregatorV2Extend2PublishedAt =", m.getAggregatorV2Extend2PublishedAt?.());
} catch (e) { console.log("pubAt err", e.message); }

console.log("\n=== our CETUS_AGGREGATOR_PACKAGE ===");
const pc = readFileSync(new URL("./src/protocol-constants.ts", import.meta.url), "utf8").split("\n");
for (let i = 90; i < 115 && i < pc.length; i++) if (pc[i]?.trim()) console.log(`${i + 1}: ${pc[i].trim()}`);
