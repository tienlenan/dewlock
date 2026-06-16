/// dewlock_receipt — owned HEAD pointer for Walrus action receipts.
///
/// Design: one ReceiptHead object per (operational-signer, action) pair.
/// The operational signer OWNS the object; Sui's owned-object model serialises
/// writes — only the owner can pass the object as a mutable argument.
/// The explicit `writer == sender` assertion is defense-in-depth against any
/// transfer/share edge case that might change ownership.
///
/// Access-control rationale (self-contained, no plan references):
///   Owned-object model: a mutable shared-object is NOT used, so there is no
///   consensus contention and the object cannot be passed by a foreign caller.
///   The `E_NOT_WRITER` assert blocks the transferred-ownership edge case.
///
/// HEAD semantics: the object is a mutable pointer to the latest Walrus blobId
/// for this (wallet, action) pair. Each `set_head` call bumps `version` and
/// updates `blob_id`, `content_hash`, `updated_ms`.
///
/// Emits `HeadUpdated` events for off-chain discoverability.
module dewlock_receipt::receipt {
    use sui::clock::{Self, Clock};
    use sui::event;

    // ── Error constants ──────────────────────────────────────────────────────

    /// Caller is not the designated writer for this HEAD object.
    const E_NOT_WRITER: u64 = 1;

    // ── Structs ──────────────────────────────────────────────────────────────

    /// Mutable HEAD pointer — owned by the operational signer.
    public struct ReceiptHead has key, store {
        id: UID,
        /// The operational signer address that created and owns this object.
        writer: address,
        /// The user wallet address this receipt belongs to.
        wallet: address,
        /// Action identifier (e.g. b"swap", b"transfer", b"limit_order").
        action: vector<u8>,
        /// Walrus blobId of the latest action receipt for this (wallet, action).
        blob_id: vector<u8>,
        /// SHA-256 content hash of the blob payload (hex string).
        content_hash: vector<u8>,
        /// Monotonically increasing version counter (starts at 0).
        version: u64,
        /// Unix timestamp in milliseconds of the last update.
        updated_ms: u64,
    }

    /// Event emitted on every HEAD update (create + set).
    public struct HeadUpdated has copy, drop {
        head_id: address,
        wallet: address,
        action: vector<u8>,
        blob_id: vector<u8>,
        version: u64,
        updated_ms: u64,
    }

    // ── Entry functions ──────────────────────────────────────────────────────

    /// Create a new ReceiptHead owned by the transaction sender (operational key).
    /// Transfers the object to `ctx.sender()` — only that address can mutate it.
    public entry fun create_head(
        wallet: address,
        action: vector<u8>,
        blob_id: vector<u8>,
        content_hash: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let now_ms = clock::timestamp_ms(clock);
        let sender = ctx.sender();
        let head = ReceiptHead {
            id: object::new(ctx),
            writer: sender,
            wallet,
            action,
            blob_id,
            content_hash,
            version: 0,
            updated_ms: now_ms,
        };
        let head_address = object::id_address(&head);
        event::emit(HeadUpdated {
            head_id: head_address,
            wallet,
            action: head.action,
            blob_id: head.blob_id,
            version: 0,
            updated_ms: now_ms,
        });
        transfer::transfer(head, sender);
    }

    /// Update an existing HEAD to point at a new blobId.
    /// Requires the caller to be the original `writer` — owned-object model
    /// already enforces this structurally; the explicit assert is defense-in-depth.
    public entry fun set_head(
        head: &mut ReceiptHead,
        blob_id: vector<u8>,
        content_hash: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Defense-in-depth: block any transferred-ownership edge case.
        assert!(head.writer == ctx.sender(), E_NOT_WRITER);
        let now_ms = clock::timestamp_ms(clock);
        head.blob_id = blob_id;
        head.content_hash = content_hash;
        head.version = head.version + 1;
        head.updated_ms = now_ms;
        event::emit(HeadUpdated {
            head_id: object::id_address(head),
            wallet: head.wallet,
            action: head.action,
            blob_id: head.blob_id,
            version: head.version,
            updated_ms: now_ms,
        });
    }

    // ── Read-only accessors (for tests / other modules) ───────────────────

    public fun blob_id(head: &ReceiptHead): &vector<u8> { &head.blob_id }
    public fun version(head: &ReceiptHead): u64 { head.version }
    public fun writer(head: &ReceiptHead): address { head.writer }
}
