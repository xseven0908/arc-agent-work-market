import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DomainError } from "../src/domain/errors.js";
import {
  MarketplaceService,
  type CreateJobInput,
} from "../src/services/marketplace.js";
import { SqliteMarketplaceStore } from "../src/store/sqlite-store.js";
import {
  acceptingAgentIdentityVerifier,
  acceptingSettlementVerifier,
} from "./helpers.js";

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "arc-agent-market-"));
  temporaryDirectories.push(directory);
  return join(directory, "marketplace.db");
}

const owner = "0x1111111111111111111111111111111111111111";
const client = "0x2222222222222222222222222222222222222222";
const evaluator = "0x3333333333333333333333333333333333333333";

describe("SqliteMarketplaceStore", () => {
  it("persists agents and jobs across store instances", async () => {
    const path = databasePath();
    const firstStore = new SqliteMarketplaceStore(path);
    const firstService = new MarketplaceService(firstStore, acceptingSettlementVerifier);
    const agent = await firstService.registerAgent({
      owner,
      name: "Persistent Agent",
      metadataUri: "ipfs://persistent-agent",
      capabilities: ["research"],
    });
    const job = await firstService.createJob({
      client,
      providerAgentId: agent.id,
      evaluator,
      description: "Persist this job",
      budgetUsdc: "2.5",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await firstService.markFunded(job.id, "500");
    firstStore.close();

    const secondStore = new SqliteMarketplaceStore(path);
    const secondService = new MarketplaceService(secondStore, acceptingSettlementVerifier);
    expect((await secondService.listAgents())[0]?.name).toBe("Persistent Agent");
    expect((await secondService.getJob(job.id)).chainJobId).toBe("500");
    expect(await secondService.listJobs()).toHaveLength(1);
    secondStore.close();
  });

  it("persists an invalidated identity state across restarts", async () => {
    const path = databasePath();
    const firstStore = new SqliteMarketplaceStore(path);
    const registrationService = new MarketplaceService(
      firstStore,
      acceptingSettlementVerifier,
      acceptingAgentIdentityVerifier,
    );
    const agent = await registrationService.registerAgent({
      owner,
      name: "Transferred Persistent Agent",
      metadataUri: "ipfs://transferred-persistent-agent",
      capabilities: ["research"],
      erc8004AgentId: "99",
    });
    const refreshService = new MarketplaceService(
      firstStore,
      acceptingSettlementVerifier,
      {
        async verifyIdentity() {
          throw new DomainError("owner changed", "IDENTITY_OWNER_MISMATCH");
        },
      },
    );
    await expect(refreshService.refreshAgentIdentity(agent.id)).rejects.toThrow(
      "owner changed",
    );
    firstStore.close();

    const secondStore = new SqliteMarketplaceStore(path);
    const stored = await secondStore.getAgent(agent.id);
    expect(stored).toMatchObject({
      identityStatus: "invalid",
      identityFailureCode: "IDENTITY_OWNER_MISMATCH",
    });
    expect(stored?.identityProof?.agentId).toBe("99");
    secondStore.close();
  });

  it("rejects reuse of one chain job ID across local jobs", async () => {
    const store = new SqliteMarketplaceStore(databasePath());
    const service = new MarketplaceService(store, acceptingSettlementVerifier);
    const agent = await service.registerAgent({
      owner,
      name: "Replay Guard Agent",
      metadataUri: "ipfs://replay-guard",
      capabilities: ["verification"],
    });
    const input: Omit<CreateJobInput, "description"> = {
      client,
      providerAgentId: agent.id,
      evaluator,
      budgetUsdc: "1",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const first = await service.createJob({ ...input, description: "First job" });
    const second = await service.createJob({ ...input, description: "Second job" });
    await service.markFunded(first.id, "777");
    await expect(service.markFunded(second.id, "777")).rejects.toThrow();
    expect((await service.getJob(second.id)).status).toBe("open");
    store.close();
  });

  it("rejects reuse of one settlement transaction across completed jobs", async () => {
    const store = new SqliteMarketplaceStore(databasePath());
    const service = new MarketplaceService(store, acceptingSettlementVerifier);
    const agent = await service.registerAgent({
      owner,
      name: "Evidence Guard Agent",
      metadataUri: "ipfs://evidence-guard",
      capabilities: ["settlement"],
    });
    const create = (description: string) =>
      service.createJob({
        client,
        providerAgentId: agent.id,
        evaluator,
        description,
        budgetUsdc: "1",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
    const first = await create("First settlement");
    const second = await create("Replay attempt");
    const digest = `0x${"a".repeat(64)}` as const;
    const transactionHash = `0x${"b".repeat(64)}` as const;

    await service.markFunded(first.id, "801");
    await service.submitDeliverable(first.id, "ipfs://first", digest);
    await service.completeJob(first.id, evaluator, transactionHash, 95);

    await service.markFunded(second.id, "802");
    await service.submitDeliverable(second.id, "ipfs://second", digest);
    await expect(
      service.completeJob(second.id, evaluator, transactionHash, 95),
    ).rejects.toThrow();
    expect((await service.getJob(second.id)).status).toBe("submitted");
    store.close();
  });
});
