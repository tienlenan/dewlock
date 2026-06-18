import { describe, it, expect } from "vitest";
import { toSupported } from "@/components/chat/supported-protocols-card";
import type { ProtocolDto } from "@/components/protocols/protocol-list";

const P = (over: Partial<ProtocolDto>): ProtocolDto => ({
  id: "x",
  name: "X",
  category: "dex",
  status: "active",
  buildState: "built",
  targetCount: 1,
  ...over,
});

describe("toSupported", () => {
  it("keeps only active + built protocols (drops deferred / non-active)", () => {
    const active = [
      P({ id: "cetus", buildState: "built" }),
      P({ id: "scallop", buildState: "deferred" }),
      P({ id: "navi", buildState: "built" }),
    ];
    expect(toSupported(active).map((p) => p.id)).toEqual(["cetus", "navi"]);
  });
});
