// @dewlock/walrus — public API surface.
// Memory (mutable, cross-session): isMemoryEnabled, memNamespace, remember, rememberBulk, recall, memoryHealth.
// Blob (write-once receipts): publishJsonBlob, readJsonBlob, contentHash, WalrusBlobPointer.
export {
  isMemoryEnabled,
  memNamespace,
  remember,
  rememberBulk,
  recall,
  recallByPrefix,
  memoryHealth,
} from "./memory.js";

export {
  publishJsonBlob,
  readJsonBlob,
  contentHash,
  type WalrusBlobPointer,
} from "./blob.js";

export {
  buildAndPublishReceipt,
  type ActionReceiptPayload,
  type ReceiptPublishResult,
} from "./receipt.js";
