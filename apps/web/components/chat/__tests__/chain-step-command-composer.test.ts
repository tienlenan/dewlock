/**
 * chain-step-command-composer — unit tests.
 *
 * Tests the two pure pieces added for the sequential chain sign loop:
 *  1. composeChainStepCommand — ChainStep + resolved amount → complete NL command string.
 *  2. nativeToHuman — bigint native units → human-readable decimal string.
 *
 * No React, no Sui SDK, no network — fully isolated.
 */

import { describe, it, expect } from "vitest";
import {
  composeChainStepCommand,
  nativeToHuman,
  extractDestinationSymbol,
  type ChainStepDef,
} from "../chain-step-command-composer";

// ---------------------------------------------------------------------------
// extractDestinationSymbol — the swap-output coin parse that lets the chain
// snapshot the right coin BEFORE the swap, so the prev-output delta isolates
// the swap output from pre-existing holdings (the delta-safety invariant).
// ---------------------------------------------------------------------------

describe("extractDestinationSymbol", () => {
  it("extracts the destination of a swap clause", () => {
    expect(extractDestinationSymbol("swap 5 SUI to USDC")).toBe("USDC");
  });
  it("is case-insensitive and uppercases", () => {
    expect(extractDestinationSymbol("swap 5 sui to usdc")).toBe("USDC");
  });
  it("supports 'into' and 'for' prepositions", () => {
    expect(extractDestinationSymbol("convert 5 SUI into USDT")).toBe("USDT");
    expect(extractDestinationSymbol("swap 5 SUI for DEEP")).toBe("DEEP");
  });
  it("returns null when there is no destination", () => {
    expect(extractDestinationSymbol("stake 10 SUI")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// composeChainStepCommand
// ---------------------------------------------------------------------------

describe("composeChainStepCommand — swap step (explicit amount)", () => {
  const swapStep: ChainStepDef = {
    category: "swap",
    clause: "swap 5 SUI to USDC",
    amountFrom: "explicit",
  };

  it("re-submits the original clause verbatim (no rewriting)", () => {
    expect(composeChainStepCommand(swapStep)).toBe("swap 5 SUI to USDC");
  });

  it("ignores resolvedAmountHuman for a swap step (amount is in the clause)", () => {
    expect(composeChainStepCommand(swapStep, { resolvedAmountHuman: "99" })).toBe(
      "swap 5 SUI to USDC",
    );
  });

  it("trims surrounding whitespace from the clause", () => {
    const padded: ChainStepDef = { ...swapStep, clause: "  swap 5 SUI to USDC  " };
    expect(composeChainStepCommand(padded)).toBe("swap 5 SUI to USDC");
  });
});

describe("composeChainStepCommand — lend step (prev-output, known protocol)", () => {
  const lendStep: ChainStepDef = {
    category: "lend",
    clause: "lend it on NAVI",
    amountFrom: "prev-output",
  };

  it("composes 'deposit <amount> <symbol> to <protocol>' from resolved amount + USDC default", () => {
    const cmd = composeChainStepCommand(lendStep, {
      resolvedAmountHuman: "18.5",
      symbolOverride: "USDC",
    });
    expect(cmd).toBe("deposit 18.5 USDC to navi");
  });

  it("lowercase-normalises the protocol from the clause", () => {
    const step: ChainStepDef = {
      category: "lend",
      clause: "deposit the output to SUILEND",
      amountFrom: "prev-output",
    };
    const cmd = composeChainStepCommand(step, { resolvedAmountHuman: "10", symbolOverride: "USDC" });
    expect(cmd).toBe("deposit 10 USDC to suilend");
  });

  it("extracts USDC symbol from clause when no symbolOverride provided", () => {
    const step: ChainStepDef = {
      category: "lend",
      clause: "lend USDC on NAVI",
      amountFrom: "prev-output",
    };
    const cmd = composeChainStepCommand(step, { resolvedAmountHuman: "20" });
    expect(cmd).toBe("deposit 20 USDC to navi");
  });

  it("falls back to 'all' amount when resolvedAmountHuman not provided", () => {
    const cmd = composeChainStepCommand(lendStep, { symbolOverride: "USDC" });
    expect(cmd).toBe("deposit all USDC to navi");
  });

  it("omits protocol when clause has no 'on <x>' or 'to <x>'", () => {
    const step: ChainStepDef = {
      category: "lend",
      clause: "lend the proceeds",
      amountFrom: "prev-output",
    };
    const cmd = composeChainStepCommand(step, {
      resolvedAmountHuman: "5",
      symbolOverride: "USDC",
    });
    // No protocol in clause → command without "to <protocol>"
    expect(cmd).toBe("deposit 5 USDC");
  });
});

describe("composeChainStepCommand — lend step (prev-output, no known symbol)", () => {
  it("defaults to USDC symbol when clause contains no recognisable symbol", () => {
    const step: ChainStepDef = {
      category: "lend",
      clause: "lend it on NAVI",
      amountFrom: "prev-output",
    };
    const cmd = composeChainStepCommand(step, { resolvedAmountHuman: "7" });
    // Clause has no symbol → falls back to "USDC" (default)
    expect(cmd).toBe("deposit 7 USDC to navi");
  });
});

describe("composeChainStepCommand — unknown category passthrough", () => {
  it("returns the original clause for an unrecognised category", () => {
    const step: ChainStepDef = {
      category: "bridge",
      clause: "bridge 10 SUI to Ethereum",
      amountFrom: "explicit",
    };
    expect(composeChainStepCommand(step)).toBe("bridge 10 SUI to Ethereum");
  });
});

// ---------------------------------------------------------------------------
// Delta → command round-trip (integration of resolveStepDelta + compose)
// ---------------------------------------------------------------------------

describe("delta→command round-trip: 18 USDC produced by swap → lend command", () => {
  it("produces the correct deposit command from the on-chain delta", () => {
    // Simulated scenario: wallet had 1000 USDC; swap produced 18 USDC delta.
    // resolveStepDelta(1_000_000_000n, 1_018_000_000n) = 18_000_000n
    // nativeToHuman(18_000_000n, 6) = "18"  (USDC has 6 decimals)

    const deltaUnits = 18_000_000n; // simulates resolveStepDelta output
    const humanAmount = nativeToHuman(deltaUnits, 6);

    const lendStep: ChainStepDef = {
      category: "lend",
      clause: "lend it on NAVI",
      amountFrom: "prev-output",
    };

    const cmd = composeChainStepCommand(lendStep, {
      resolvedAmountHuman: humanAmount,
      symbolOverride: "USDC",
    });

    expect(humanAmount).toBe("18");
    expect(cmd).toBe("deposit 18 USDC to navi");
  });
});

// ---------------------------------------------------------------------------
// nativeToHuman
// ---------------------------------------------------------------------------

describe("nativeToHuman — native bigint → human decimal string", () => {
  it("converts SUI (9 decimals) correctly", () => {
    // 5 SUI = 5_000_000_000n MIST
    expect(nativeToHuman(5_000_000_000n, 9)).toBe("5");
  });

  it("converts USDC (6 decimals) correctly", () => {
    // 18.5 USDC = 18_500_000n base units
    expect(nativeToHuman(18_500_000n, 6)).toBe("18.5");
  });

  it("handles fractional amounts with up to 6 decimal places", () => {
    // 0.000001 USDC = 1n base unit
    expect(nativeToHuman(1n, 6)).toBe("0.000001");
  });

  it("accepts a coin type string (6 decimals for USDC type)", () => {
    const USDC = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
    expect(nativeToHuman(20_000_000n, USDC)).toBe("20");
  });

  it("falls back to 9 decimals for an unknown coin type", () => {
    expect(nativeToHuman(1_000_000_000n, "0x::unknown::COIN")).toBe("1");
  });

  it("returns '0' for zero amount", () => {
    expect(nativeToHuman(0n, 6)).toBe("0");
  });
});
