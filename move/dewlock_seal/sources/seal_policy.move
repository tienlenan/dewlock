// Account-based Seal access policy for Dewlock.
//
// Personal data (conversation content) is Seal-encrypted to the identity
// `bcs::to_bytes(owner)` — the owner's 32-byte Sui address. Seal key servers call
// `seal_approve` (with the package prefix stripped from the id) and release a
// decryption-key share only when the requesting transaction's sender equals that
// owner. The result: the Dewlock server stores ciphertext it can never decrypt;
// only the owner's wallet can.
//
// Contract requirements honored: side-effect-free, aborts on denial, first arg is
// the requested identity bytes, declared as a non-public `entry` for upgrade safety.
module dewlock_seal::seal_policy;

use sui::bcs;

/// Decryption denied: the requested identity is not the caller's address.
const ENoAccess: u64 = 1;

/// key id = [pkg id][bcs::to_bytes(owner)]; Seal passes `id` = bcs::to_bytes(owner).
fun check_policy(id: vector<u8>, ctx: &TxContext): bool {
    id == bcs::to_bytes(&ctx.sender())
}

entry fun seal_approve(id: vector<u8>, ctx: &TxContext) {
    assert!(check_policy(id, ctx), ENoAccess);
}

#[test]
fun test_owner_matches_and_foreign_rejected() {
    let ctx = tx_context::dummy();
    // The caller can decrypt data encrypted to their own address.
    let own = bcs::to_bytes(&ctx.sender());
    assert!(check_policy(own, &ctx), 0);
    // A different address's identity is rejected.
    let foreign = bcs::to_bytes(&@0xdead);
    assert!(!check_policy(foreign, &ctx), 1);
}
