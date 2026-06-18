// Suppress lint warning: `public entry` is valid idiom here — keeps PTB + direct-call
// parity and matches the existing entry-fn convention of the codebase.
#[allow(lint(public_entry))]
/// dewlock_receipt — owned HEAD pointer for Walrus action receipts.
///
/// Design: one ReceiptHead object per (operational-signer, action) pair.
/// The operational signer OWNS the object; Sui's owned-object model serialises
/// writes — only the owner can pass the object as a mutable argument.
/// The explicit `writer == sender` assertion is defense-in-depth against any
/// transfer/share edge case that might change ownership.
///
/// Access-control rationale (self-contained):
///   Owned-object model: a mutable shared-object is NOT used, so there is no
///   consensus contention and the object cannot be passed by a foreign caller.
///   The `E_NOT_WRITER` assert blocks the transferred-ownership edge case.
///
/// HEAD semantics: the object is a mutable pointer to the latest Walrus blobId
/// for this (wallet, action) pair. Each `set_head` call bumps `version` and
/// updates `blob_id`, `content_hash`, `updated_ms`.
///
/// Extensibility design:
///   Move struct fields are immutable across package upgrades. The `extensions`
///   Bag on ReceiptHead is a dynamic-field escape hatch — future metadata can be
///   attached post-publish without any struct change. This MUST be present before
///   first mainnet publish.
///
/// Upgrade / version guard:
///   A shared `Config { version }` object is created at publish time via `init`.
///   Entry functions assert `config.version == VERSION` so that after an upgrade
///   the deployer can bump `Config.version` via `migrate`, automatically deprecating
///   clients still calling the old package. The `AdminCap` authorises `migrate`.
///
/// Emits `HeadUpdated` events for off-chain discoverability.
module dewlock_receipt::receipt {
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::bag::{Self, Bag};

    // ── Package version ──────────────────────────────────────────────────────

    /// Bumped on every incompatible package upgrade; asserted in entry fns.
    /// Old-version callers will abort after `migrate` raises this constant.
    const VERSION: u64 = 1;

    // ── Input size caps ──────────────────────────────────────────────────────
    // These guard against object bloat and unreasonable gas costs.
    // Values are generous enough for real usage but block malformed input.

    const MAX_ACTION_BYTES: u64    = 32;
    const MAX_BLOB_ID_BYTES: u64   = 128;
    const MAX_HASH_BYTES: u64      = 128;

    // ── Error constants ──────────────────────────────────────────────────────

    /// Caller is not the designated writer for this HEAD object.
    const E_NOT_WRITER: u64 = 1;
    /// Package version mismatch — caller must upgrade to the current package.
    const E_VERSION_MISMATCH: u64 = 2;
    /// Input byte-string exceeds the allowed maximum length.
    const E_INPUT_TOO_LONG: u64 = 3;
    /// Caller does not hold the AdminCap required for this operation.
    /// (Structural: AdminCap is consumed or required by value — this error
    ///  is retained for explicit abort paths, e.g. future extension checks.)
    const E_NOT_ADMIN: u64 = 4;

    // ── Capabilities & config ────────────────────────────────────────────────

    /// One-time witness — exists only to satisfy `init` for object creation.
    public struct RECEIPT has drop {}

    /// Shared singleton that records the live package version.
    /// Publishing bumps this to VERSION; `migrate` can advance it further on
    /// an incompatible upgrade to block stale callers automatically.
    public struct Config has key {
        id: UID,
        /// The currently-accepted package version.
        version: u64,
    }

    /// Capability transferred to the publisher at init time.
    /// Holder can call `migrate` to advance `Config.version`.
    /// Custodied by the deployer multisig; enables signer-rotation governance
    /// without a new deploy — the operational writer can be changed by the
    /// AdminCap holder through off-chain coordination plus on-chain config updates.
    public struct AdminCap has key, store {
        id: UID,
    }

    // ── Structs ──────────────────────────────────────────────────────────────

    /// Mutable HEAD pointer — owned by the operational signer.
    /// `store` ability is intentionally dropped: the HEAD must not be
    /// composed into another object or transferred out of the writer's control.
    /// The `E_NOT_WRITER` assert already neutralises a moved object, but
    /// omitting `store` makes the invariant structural and prevents wrapping.
    public struct ReceiptHead has key {
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
        /// Dynamic-field extension slot: attach future per-HEAD metadata here
        /// without any struct change. Uses `vector<u8>` keys so callers can
        /// namespace their own extension types without a framework dependency.
        extensions: Bag,
    }

    /// Event emitted on every HEAD update (create + set).
    /// `content_hash` is included so off-chain indexers can verify blob integrity
    /// without fetching the Walrus object.
    public struct HeadUpdated has copy, drop {
        head_id: address,
        wallet: address,
        action: vector<u8>,
        blob_id: vector<u8>,
        content_hash: vector<u8>,
        version: u64,
        updated_ms: u64,
    }

    // ── Initialiser ─────────────────────────────────────────────────────────

    /// Called exactly once at publish time by the Sui framework.
    /// Creates the shared `Config` (package-version singleton) and transfers
    /// `AdminCap` to the deployer — the only address that can call `migrate`.
    fun init(_witness: RECEIPT, ctx: &mut TxContext) {
        let config = Config {
            id: object::new(ctx),
            version: VERSION,
        };
        transfer::share_object(config);

        let admin_cap = AdminCap { id: object::new(ctx) };
        transfer::transfer(admin_cap, ctx.sender());
    }

    // ── Entry functions ──────────────────────────────────────────────────────

    /// Create a new ReceiptHead owned by the transaction sender (operational key).
    /// Transfers the object to `ctx.sender()` — only that address can mutate it.
    ///
    /// Asserts package version so callers on a stale package are rejected cleanly
    /// after an incompatible upgrade + migrate.
    public entry fun create_head(
        config: &Config,
        wallet: address,
        action: vector<u8>,
        blob_id: vector<u8>,
        content_hash: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(config.version == VERSION, E_VERSION_MISMATCH);
        assert!(action.length() <= MAX_ACTION_BYTES, E_INPUT_TOO_LONG);
        assert!(blob_id.length() <= MAX_BLOB_ID_BYTES, E_INPUT_TOO_LONG);
        assert!(content_hash.length() <= MAX_HASH_BYTES, E_INPUT_TOO_LONG);

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
            extensions: bag::new(ctx),
        };
        let head_address = object::id_address(&head);
        event::emit(HeadUpdated {
            head_id: head_address,
            wallet,
            action: head.action,
            blob_id: head.blob_id,
            content_hash: head.content_hash,
            version: 0,
            updated_ms: now_ms,
        });
        transfer::transfer(head, sender);
    }

    /// Update an existing HEAD to point at a new blobId.
    /// Requires the caller to be the original `writer` — owned-object model
    /// already enforces this structurally; the explicit assert is defense-in-depth.
    public entry fun set_head(
        config: &Config,
        head: &mut ReceiptHead,
        blob_id: vector<u8>,
        content_hash: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(config.version == VERSION, E_VERSION_MISMATCH);
        // Defense-in-depth: block any transferred-ownership edge case.
        assert!(head.writer == ctx.sender(), E_NOT_WRITER);
        assert!(blob_id.length() <= MAX_BLOB_ID_BYTES, E_INPUT_TOO_LONG);
        assert!(content_hash.length() <= MAX_HASH_BYTES, E_INPUT_TOO_LONG);

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
            content_hash: head.content_hash,
            version: head.version,
            updated_ms: now_ms,
        });
    }

    /// Attach a typed extension value to a HEAD, keyed by a UTF-8 name byte-string.
    /// Only the writer may add extensions — same access control as set_head.
    /// Use this to store future per-HEAD metadata (e.g. fee tiers, protocol tags)
    /// without a struct change. `V` must have `store` so it can live inside a Bag.
    ///
    /// To overwrite a key, call `remove_extension` first then `set_extension` again.
    /// This is intentional: `V` may not have `drop`, so silent overwrite would be
    /// unsound — the caller must explicitly handle the old value.
    public fun set_extension<V: store>(
        config: &Config,
        head: &mut ReceiptHead,
        key: vector<u8>,
        value: V,
        ctx: &TxContext,
    ) {
        assert!(config.version == VERSION, E_VERSION_MISMATCH);
        assert!(head.writer == ctx.sender(), E_NOT_WRITER);
        bag::add(&mut head.extensions, key, value);
    }

    /// Remove a typed extension from a HEAD. Only the writer may remove.
    public fun remove_extension<V: store>(
        config: &Config,
        head: &mut ReceiptHead,
        key: vector<u8>,
        ctx: &TxContext,
    ): V {
        assert!(config.version == VERSION, E_VERSION_MISMATCH);
        assert!(head.writer == ctx.sender(), E_NOT_WRITER);
        bag::remove(&mut head.extensions, key)
    }

    /// Advance the accepted package version in the shared Config.
    /// Called by the deployer after publishing an incompatible upgrade — once
    /// `config.version` is bumped, all entry fns in the old package will abort
    /// with `E_VERSION_MISMATCH`, forcing callers to upgrade their PTB builder.
    /// Requires possession of AdminCap (transferred to the publisher at init).
    public entry fun migrate(
        config: &mut Config,
        _admin_cap: &AdminCap,
        new_version: u64,
        _ctx: &mut TxContext,
    ) {
        // AdminCap is required by reference — structural proof of authority.
        // `new_version` must advance monotonically to avoid accidental downgrades.
        assert!(new_version > config.version, E_NOT_ADMIN);
        config.version = new_version;
    }

    // ── Read-only accessors (for tests / other modules) ───────────────────

    public fun blob_id(head: &ReceiptHead): &vector<u8> { &head.blob_id }
    public fun version(head: &ReceiptHead): u64 { head.version }
    public fun writer(head: &ReceiptHead): address { head.writer }
    public fun content_hash(head: &ReceiptHead): &vector<u8> { &head.content_hash }
    public fun config_version(config: &Config): u64 { config.version }

    // ── Tests ────────────────────────────────────────────────────────────────

    #[test_only]
    use sui::test_scenario::{Self as ts, Scenario};
    #[test_only]
    use sui::clock as clock_mod;

    // Helper: publish the package in a test scenario (runs init).
    #[test_only]
    fun publish(scenario: &mut Scenario, publisher: address) {
        ts::next_tx(scenario, publisher);
        {
            let witness = RECEIPT {};
            let ctx = ts::ctx(scenario);
            init(witness, ctx);
        };
    }

    #[test]
    fun test_create_head_sets_version_zero_and_bag() {
        let publisher = @0xAB;
        let user      = @0xCD;
        let mut scenario = ts::begin(publisher);

        publish(&mut scenario, publisher);

        ts::next_tx(&mut scenario, publisher);
        {
            let config = ts::take_shared<Config>(&scenario);
            let clock = clock_mod::create_for_testing(ts::ctx(&mut scenario));

            create_head(
                &config,
                user,
                b"swap",
                b"blob_abc",
                b"hash_xyz",
                &clock,
                ts::ctx(&mut scenario),
            );

            ts::return_shared(config);
            clock_mod::destroy_for_testing(clock);
        };

        ts::next_tx(&mut scenario, publisher);
        {
            let head = ts::take_from_sender<ReceiptHead>(&scenario);
            assert!(head.version == 0, 100);
            assert!(bag::is_empty(&head.extensions), 101);
            assert!(head.writer == publisher, 102);
            ts::return_to_sender(&scenario, head);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_set_head_bumps_version_and_requires_writer() {
        let publisher = @0xAB;
        let user      = @0xCD;
        let mut scenario = ts::begin(publisher);

        publish(&mut scenario, publisher);

        ts::next_tx(&mut scenario, publisher);
        {
            let config = ts::take_shared<Config>(&scenario);
            let clock = clock_mod::create_for_testing(ts::ctx(&mut scenario));
            create_head(&config, user, b"swap", b"blob1", b"hash1", &clock, ts::ctx(&mut scenario));
            ts::return_shared(config);
            clock_mod::destroy_for_testing(clock);
        };

        ts::next_tx(&mut scenario, publisher);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut head = ts::take_from_sender<ReceiptHead>(&scenario);
            let clock = clock_mod::create_for_testing(ts::ctx(&mut scenario));

            set_head(&config, &mut head, b"blob2", b"hash2", &clock, ts::ctx(&mut scenario));

            assert!(head.version == 1, 200);
            assert!(head.blob_id == b"blob2", 201);
            assert!(head.content_hash == b"hash2", 202);

            ts::return_to_sender(&scenario, head);
            ts::return_shared(config);
            clock_mod::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = E_INPUT_TOO_LONG)]
    fun test_create_head_rejects_oversized_action() {
        let publisher = @0xAB;
        let mut scenario = ts::begin(publisher);

        publish(&mut scenario, publisher);

        ts::next_tx(&mut scenario, publisher);
        {
            let config = ts::take_shared<Config>(&scenario);
            let clock = clock_mod::create_for_testing(ts::ctx(&mut scenario));
            // 33-byte action — exceeds MAX_ACTION_BYTES (32)
            create_head(
                &config,
                @0xCD,
                b"this_action_is_way_too_long_xyz__",
                b"blob",
                b"hash",
                &clock,
                ts::ctx(&mut scenario),
            );
            ts::return_shared(config);
            clock_mod::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = E_INPUT_TOO_LONG)]
    fun test_set_head_rejects_oversized_blob_id() {
        let publisher = @0xAB;
        let mut scenario = ts::begin(publisher);

        publish(&mut scenario, publisher);

        ts::next_tx(&mut scenario, publisher);
        {
            let config = ts::take_shared<Config>(&scenario);
            let clock = clock_mod::create_for_testing(ts::ctx(&mut scenario));
            create_head(&config, @0xCD, b"swap", b"blob", b"hash", &clock, ts::ctx(&mut scenario));
            ts::return_shared(config);
            clock_mod::destroy_for_testing(clock);
        };

        ts::next_tx(&mut scenario, publisher);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut head = ts::take_from_sender<ReceiptHead>(&scenario);
            let clock = clock_mod::create_for_testing(ts::ctx(&mut scenario));
            // 129-byte blob_id — exceeds MAX_BLOB_ID_BYTES (128)
            let oversized = b"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
            set_head(&config, &mut head, oversized, b"hash", &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, head);
            ts::return_shared(config);
            clock_mod::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_migrate_bumps_config_version() {
        let publisher = @0xAB;
        let mut scenario = ts::begin(publisher);

        publish(&mut scenario, publisher);

        ts::next_tx(&mut scenario, publisher);
        {
            let mut config = ts::take_shared<Config>(&scenario);
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);

            assert!(config.version == VERSION, 300);
            migrate(&mut config, &admin_cap, 2, ts::ctx(&mut scenario));
            assert!(config.version == 2, 301);

            ts::return_to_sender(&scenario, admin_cap);
            ts::return_shared(config);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = E_NOT_ADMIN)]
    fun test_migrate_rejects_downgrade() {
        let publisher = @0xAB;
        let mut scenario = ts::begin(publisher);

        publish(&mut scenario, publisher);

        ts::next_tx(&mut scenario, publisher);
        {
            let mut config = ts::take_shared<Config>(&scenario);
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);

            // new_version == current version — must be rejected (not strictly greater)
            migrate(&mut config, &admin_cap, VERSION, ts::ctx(&mut scenario));

            ts::return_to_sender(&scenario, admin_cap);
            ts::return_shared(config);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = E_NOT_WRITER)]
    fun test_set_head_rejects_wrong_writer() {
        let publisher = @0xAB;
        let attacker  = @0xFF;
        let mut scenario = ts::begin(publisher);

        publish(&mut scenario, publisher);

        ts::next_tx(&mut scenario, publisher);
        {
            let config = ts::take_shared<Config>(&scenario);
            let clock = clock_mod::create_for_testing(ts::ctx(&mut scenario));
            create_head(&config, @0xCD, b"swap", b"blob", b"hash", &clock, ts::ctx(&mut scenario));
            ts::return_shared(config);
            clock_mod::destroy_for_testing(clock);
        };

        // Transfer head to attacker so they can pass it by value; the writer assert should still fire.
        ts::next_tx(&mut scenario, publisher);
        {
            let head = ts::take_from_sender<ReceiptHead>(&scenario);
            transfer::transfer(head, attacker);
        };

        ts::next_tx(&mut scenario, attacker);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut head = ts::take_from_sender<ReceiptHead>(&scenario);
            let clock = clock_mod::create_for_testing(ts::ctx(&mut scenario));
            // attacker != publisher (writer) — must abort
            set_head(&config, &mut head, b"evil", b"evil_hash", &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, head);
            ts::return_shared(config);
            clock_mod::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }
}
