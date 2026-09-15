import { describe, expect, it } from "vitest";
import { MarketplaceService } from "../src/services/marketplace.js";
import { InMemoryMarketplaceStore } from "../src/store/store.js";

const owner = "0x1111111111111111111111111111111111111111";
const client = "0x2222222222222222222222222222222222222222";
const evaluator = "0x3333333333333333333333333333333333333333";

async function setup() {
  const service = new MarketplaceService(new InMemoryMarketplaceStore());
  const agent = await service.registerAgent({
    owner,
    name: "Build Agent",
    metadataUri: "ipfs://agent",
    capabilities: ["typescript", "typescript"],
    erc8004AgentId: "9",
  });
  const job = await service.createJob({
    client,
    providerAgentId: agent.id,
    evaluator,
    description: "Build an Arc integration",
    budgetUsdc: "12.5",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  return { service, agent, job };
}

describe("MarketplaceService", () => {
  it("runs the verified job lifecycle and produces proof-backed reputation", async () => {
    const { service, agent, job } = await setup();
    await service.markFunded(job.id, "100");
    await service.submitDeliverable(
      job.id,
      "ipfs://artifact",
      `0x${"b".repeat(64)}`,
    );
    await service.completeJob(
      job.id,
      evaluator,
      `0x${"c".repeat(64)}`,
      95,
    );

    const reputation = await service.getReputation(agent.id);
    expect(reputation.verifiedSettledJobs).toBe(1);
    expect(reputation.settledVolumeUsdc).toBe("12.5");
    expect(reputation.score).toBe(66);
  });

  it("rejects self-dealing between client and provider owner", async () => {
    const { service, agent } = await setup();
    await expect(
      service.createJob({
        client: owner,
        providerAgentId: agent.id,
        evaluator,
        description: "Fake job",
        budgetUsdc: "1",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    ).rejects.toMatchObject({ code: "SELF_DEALING" });
  });

  it("enforces the job state machine", async () => {
    const { service, job } = await setup();
    await expect(
      service.submitDeliverable(
        job.id,
        "ipfs://too-early",
        `0x${"d".repeat(64)}`,
      ),
    ).rejects.toMatchObject({ code: "INVALID_JOB_STATUS" });
  });
});
