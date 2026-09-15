import { describe, expect, it } from "vitest";
import { MarketplaceService } from "../src/services/marketplace.js";
import { InMemoryMarketplaceStore } from "../src/store/store.js";
import {
  acceptingAgentIdentityVerifier,
  acceptingSettlementVerifier,
} from "./helpers.js";

const owner = "0x1111111111111111111111111111111111111111";
const client = "0x2222222222222222222222222222222222222222";
const evaluator = "0x3333333333333333333333333333333333333333";

async function setup() {
  const service = new MarketplaceService(
    new InMemoryMarketplaceStore(),
    acceptingSettlementVerifier,
    acceptingAgentIdentityVerifier,
  );
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
    expect(agent.identityProof).toMatchObject({
      agentId: "9",
      owner,
      metadataUri: "ipfs://agent",
    });
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

  it("rejects an ERC-8004 identity that is not owned by the supplied owner", async () => {
    const service = new MarketplaceService(
      new InMemoryMarketplaceStore(),
      acceptingSettlementVerifier,
      {
        async verifyIdentity() {
          throw new Error("owner mismatch");
        },
      },
    );

    await expect(
      service.registerAgent({
        owner,
        name: "Impersonated Agent",
        metadataUri: "ipfs://agent",
        capabilities: ["typescript"],
        erc8004AgentId: "9",
      }),
    ).rejects.toThrow("owner mismatch");
    expect(await service.listAgents()).toEqual([]);
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

  it("does not complete or score a job when chain verification fails", async () => {
    const rejectingService = new MarketplaceService(
      new InMemoryMarketplaceStore(),
      {
        async verifyCompletion() {
          throw new Error("receipt mismatch");
        },
      },
    );
    const agent = await rejectingService.registerAgent({
      owner,
      name: "Build Agent",
      metadataUri: "ipfs://agent",
      capabilities: ["typescript"],
    });
    const job = await rejectingService.createJob({
      client,
      providerAgentId: agent.id,
      evaluator,
      description: "Build an Arc integration",
      budgetUsdc: "1",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await rejectingService.markFunded(job.id, "101");
    await rejectingService.submitDeliverable(
      job.id,
      "ipfs://artifact",
      `0x${"a".repeat(64)}`,
    );

    await expect(
      rejectingService.completeJob(
        job.id,
        evaluator,
        `0x${"b".repeat(64)}`,
        100,
      ),
    ).rejects.toThrow("receipt mismatch");
    expect((await rejectingService.getJob(job.id)).status).toBe("submitted");
    expect((await rejectingService.getReputation(agent.id)).verifiedSettledJobs).toBe(0);
  });
});
