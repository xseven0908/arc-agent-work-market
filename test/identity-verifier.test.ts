import { describe, expect, it } from "vitest";
import { buildArcIdentityProof } from "../src/chain/identity-verifier.js";

const owner = "0x1111111111111111111111111111111111111111";
const input = {
  agentId: "42",
  owner,
  metadataUri: "ipfs://verified-agent",
} as const;

describe("Arc identity proof", () => {
  it("builds evidence from matching IdentityRegistry state", () => {
    expect(
      buildArcIdentityProof(
        input,
        { owner, metadataUri: input.metadataUri },
        "2026-09-15T00:00:00.000Z",
      ),
    ).toMatchObject({
      chainId: 5042002,
      agentId: "42",
      owner,
      metadataUri: "ipfs://verified-agent",
      verifiedAt: "2026-09-15T00:00:00.000Z",
    });
  });

  it("rejects an ownership mismatch", () => {
    expect(() =>
      buildArcIdentityProof(input, {
        owner: "0x2222222222222222222222222222222222222222",
        metadataUri: input.metadataUri,
      }),
    ).toThrow("does not own");
  });

  it("rejects a metadata mismatch", () => {
    expect(() =>
      buildArcIdentityProof(input, {
        owner,
        metadataUri: "ipfs://different-agent",
      }),
    ).toThrow("does not match");
  });
});
