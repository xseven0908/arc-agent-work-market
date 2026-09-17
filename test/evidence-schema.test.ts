import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  publicRpcEndpoint,
  testnetEvidenceSchema,
} from "../src/evidence/schema.js";

const hash = `0x${"a".repeat(64)}`;
const evidence = {
  schemaVersion: 2,
  generatedAt: "2026-09-17T00:00:00.000Z",
  chainId: 5042002,
  rpcEndpoint: "https://rpc.testnet.arc.network",
  contracts: {
    usdc: "0x3600000000000000000000000000000000000000",
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    validationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
    agenticCommerce: "0x0747EEf0706327138c69792bF28Cd525089e4583",
  },
  participants: {
    client: "0x1111111111111111111111111111111111111111",
    provider: "0x2222222222222222222222222222222222222222",
    evaluator: "0x1111111111111111111111111111111111111111",
  },
  identities: {
    client: { agentId: "1", metadataUri: "ipfs://client", transactionHash: hash },
    provider: { agentId: "2", metadataUri: "ipfs://provider", transactionHash: hash },
  },
  job: {
    jobId: "3",
    budgetUsdc: "0.1",
    expiredAt: "1800000000",
    description: "Evidence test",
    artifactUri: "ipfs://artifact",
    deliverable: hash,
    reason: hash,
  },
  transactions: {
    createJob: hash,
    setBudget: hash,
    approve: hash,
    fund: hash,
    submit: hash,
    complete: hash,
  },
};

describe("Testnet evidence schema", () => {
  it("keeps the tracked example artifact schema-valid", () => {
    const example = JSON.parse(
      readFileSync(
        new URL("../deployments/arc-testnet.example.json", import.meta.url),
        "utf8",
      ),
    );
    expect(testnetEvidenceSchema.parse(example).schemaVersion).toBe(2);
  });

  it("accepts a complete version 2 evidence artifact", () => {
    expect(testnetEvidenceSchema.parse(evidence).schemaVersion).toBe(2);
  });

  it("rejects a substituted contract address", () => {
    const tampered = structuredClone(evidence);
    tampered.contracts.agenticCommerce =
      "0x9999999999999999999999999999999999999999";
    expect(() => testnetEvidenceSchema.parse(tampered)).toThrow();
  });

  it("redacts non-official RPC endpoints", () => {
    expect(publicRpcEndpoint("https://provider.example/v1/secret-key")).toBe(
      "custom-rpc-redacted",
    );
    expect(publicRpcEndpoint("https://rpc.testnet.arc.network")).toBe(
      "https://rpc.testnet.arc.network",
    );
  });
});
