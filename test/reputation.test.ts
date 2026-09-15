import { describe, expect, it } from "vitest";
import { calculateReputation } from "../src/domain/reputation.js";
import type { AgentProfile, WorkJob } from "../src/domain/types.js";

const owner = "0x1111111111111111111111111111111111111111";
const evaluator = "0x2222222222222222222222222222222222222222";
const txHash = `0x${"a".repeat(64)}` as const;

const agent: AgentProfile = {
  id: "agent-1",
  owner,
  name: "Verifier",
  metadataUri: "ipfs://agent",
  capabilities: ["code-review"],
  erc8004AgentId: "7",
  createdAt: "2026-09-15T00:00:00.000Z",
};

function job(overrides: Partial<WorkJob>): WorkJob {
  return {
    id: "job-1",
    client: evaluator,
    providerAgentId: agent.id,
    evaluator,
    description: "Review a contract",
    budgetUsdc: "5",
    expiresAt: "2026-10-01T00:00:00.000Z",
    status: "funded",
    createdAt: "2026-09-15T00:00:00.000Z",
    updatedAt: "2026-09-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("calculateReputation", () => {
  it("ignores jobs without verified settlement evidence", () => {
    const reputation = calculateReputation(agent, [
      job({ status: "submitted", evaluatorScore: 100 }),
      job({ status: "completed", chainJobId: "1", evaluatorScore: 100 }),
    ]);

    expect(reputation.verifiedSettledJobs).toBe(0);
    expect(reputation.settledVolumeUsdc).toBe("0");
    expect(reputation.score).toBe(10);
  });

  it("scores only completed Arc jobs whose proof matches the chain job id", () => {
    const valid = job({
      status: "completed",
      chainJobId: "42",
      evaluatorScore: 90,
      settlement: {
        chainId: 5042002,
        contractAddress: "0x0747EEf0706327138c69792bF28Cd525089e4583",
        chainJobId: "42",
        transactionHash: txHash,
        evaluator,
        completedAt: "2026-09-15T00:05:00.000Z",
      },
    });
    const mismatched = job({
      id: "job-2",
      status: "completed",
      chainJobId: "43",
      budgetUsdc: "100",
      evaluatorScore: 100,
      settlement: { ...valid.settlement!, chainJobId: "44" },
    });

    const reputation = calculateReputation(agent, [valid, mismatched]);

    expect(reputation.verifiedSettledJobs).toBe(1);
    expect(reputation.settledVolumeUsdc).toBe("5");
    expect(reputation.averageEvaluatorScore).toBe(90);
    expect(reputation.score).toBe(63);
    expect(reputation.evidenceTransactionHashes).toEqual([txHash]);
  });
});
