import { describe, it, expect, afterEach } from "vitest";
import { faucetHostFor, isTestWalletEnabled, rpcUrlFor, testNetwork } from "@/lib/dev/test-burner-keypair";

const ORIG = process.env.NEXT_PUBLIC_SUI_NETWORK;
afterEach(() => {
  process.env.NEXT_PUBLIC_SUI_NETWORK = ORIG;
  delete process.env.NEXT_PUBLIC_ENABLE_TEST_WALLET;
});

describe("test-burner-keypair helpers", () => {
  it("rpcUrlFor: localnet is the local fullnode port", () => {
    expect(rpcUrlFor("localnet")).toBe("http://127.0.0.1:9000");
    expect(rpcUrlFor("mainnet")).toContain("mainnet");
    expect(rpcUrlFor("devnet")).toContain("devnet");
  });

  it("faucetHostFor: mainnet has no faucet; devnet/localnet do", () => {
    expect(faucetHostFor("mainnet")).toBeNull();
    expect(faucetHostFor("devnet")).toContain("faucet");
    expect(faucetHostFor("localnet")).toContain("9123");
  });

  it("testNetwork: defaults to mainnet, honors devnet/localnet env", () => {
    delete process.env.NEXT_PUBLIC_SUI_NETWORK;
    expect(testNetwork()).toBe("mainnet");
    process.env.NEXT_PUBLIC_SUI_NETWORK = "localnet";
    expect(testNetwork()).toBe("localnet");
    process.env.NEXT_PUBLIC_SUI_NETWORK = "garbage";
    expect(testNetwork()).toBe("mainnet");
  });

  it("isTestWalletEnabled: false without the flag (and off-localhost / SSR)", () => {
    // No window + flag unset → never enabled (the deployed-app case).
    expect(isTestWalletEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_ENABLE_TEST_WALLET = "1";
    // Flag on but no window (SSR/node) → still false.
    expect(isTestWalletEnabled()).toBe(false);
  });
});
