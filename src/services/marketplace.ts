import { randomUUID } from "node:crypto";
import type { Address, Hex } from "viem";
import { DomainError } from "../domain/errors.js";
import { calculateReputation } from "../domain/reputation.js";
import type {
  AgentProfile,
  AgentReputation,
  SettlementProof,
  WorkJob,
} from "../domain/types.js";
import type { MarketplaceStore } from "../store/store.js";
import type { SettlementVerifier } from "./settlement-verifier.js";

export interface RegisterAgentInput {
  owner: Address;
  name: string;
  metadataUri: string;
  capabilities: string[];
  erc8004AgentId?: string | undefined;
}

export interface CreateJobInput {
  client: Address;
  providerAgentId: string;
  evaluator: Address;
  description: string;
  budgetUsdc: string;
  expiresAt: string;
  chainJobId?: string | undefined;
}

export class MarketplaceService {
  constructor(
    private readonly store: MarketplaceStore,
    private readonly settlementVerifier: SettlementVerifier,
  ) {}

  async registerAgent(input: RegisterAgentInput): Promise<AgentProfile> {
    const now = new Date().toISOString();
    const agent: AgentProfile = {
      id: randomUUID(),
      owner: input.owner,
      name: input.name,
      metadataUri: input.metadataUri,
      capabilities: [...new Set(input.capabilities)],
      ...(input.erc8004AgentId
        ? { erc8004AgentId: input.erc8004AgentId }
        : {}),
      createdAt: now,
    };
    await this.store.saveAgent(agent);
    return agent;
  }

  async listAgents(): Promise<AgentProfile[]> {
    return this.store.listAgents();
  }

  async createJob(input: CreateJobInput): Promise<WorkJob> {
    const agent = await this.requireAgent(input.providerAgentId);
    if (agent.owner.toLowerCase() === input.client.toLowerCase()) {
      throw new DomainError(
        "client and provider owner must be different",
        "SELF_DEALING",
      );
    }
    if (new Date(input.expiresAt).getTime() <= Date.now()) {
      throw new DomainError("expiresAt must be in the future", "INVALID_EXPIRY");
    }

    const now = new Date().toISOString();
    const job: WorkJob = {
      id: randomUUID(),
      client: input.client,
      providerAgentId: input.providerAgentId,
      evaluator: input.evaluator,
      description: input.description,
      budgetUsdc: input.budgetUsdc,
      expiresAt: input.expiresAt,
      status: "open",
      ...(input.chainJobId ? { chainJobId: input.chainJobId } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await this.store.saveJob(job);
    return job;
  }

  async markFunded(id: string, chainJobId: string): Promise<WorkJob> {
    const job = await this.requireJob(id);
    this.requireStatus(job, "open");
    job.status = "funded";
    job.chainJobId = chainJobId;
    job.updatedAt = new Date().toISOString();
    await this.store.saveJob(job);
    return job;
  }

  async submitDeliverable(
    id: string,
    artifactUri: string,
    digest: Hex,
  ): Promise<WorkJob> {
    const job = await this.requireJob(id);
    this.requireStatus(job, "funded");
    job.status = "submitted";
    job.deliverable = {
      artifactUri,
      digest,
      submittedAt: new Date().toISOString(),
    };
    job.updatedAt = new Date().toISOString();
    await this.store.saveJob(job);
    return job;
  }

  async completeJob(
    id: string,
    evaluator: Address,
    transactionHash: Hex,
    score: number,
  ): Promise<WorkJob> {
    const job = await this.requireJob(id);
    this.requireStatus(job, "submitted");
    if (job.evaluator.toLowerCase() !== evaluator.toLowerCase()) {
      throw new DomainError("only the evaluator can complete a job", "FORBIDDEN");
    }
    if (!job.chainJobId) {
      throw new DomainError(
        "a chain job id is required before settlement",
        "MISSING_CHAIN_JOB",
      );
    }

    const agent = await this.requireAgent(job.providerAgentId);
    const settlement: SettlementProof =
      await this.settlementVerifier.verifyCompletion({
        chainJobId: job.chainJobId,
        transactionHash,
        client: job.client,
        provider: agent.owner,
        evaluator,
        budgetUsdc: job.budgetUsdc,
      });
    const completedAt = settlement.completedAt;
    job.status = "completed";
    job.settlement = settlement;
    job.evaluatorScore = score;
    job.updatedAt = completedAt;
    await this.store.saveJob(job);
    return job;
  }

  async getJob(id: string): Promise<WorkJob> {
    return this.requireJob(id);
  }

  async getReputation(agentId: string): Promise<AgentReputation> {
    const agent = await this.requireAgent(agentId);
    const jobs = await this.store.listJobsForAgent(agentId);
    return calculateReputation(agent, jobs);
  }

  private async requireAgent(id: string): Promise<AgentProfile> {
    const agent = await this.store.getAgent(id);
    if (!agent) throw new DomainError("agent not found", "AGENT_NOT_FOUND");
    return agent;
  }

  private async requireJob(id: string): Promise<WorkJob> {
    const job = await this.store.getJob(id);
    if (!job) throw new DomainError("job not found", "JOB_NOT_FOUND");
    return job;
  }

  private requireStatus(job: WorkJob, expected: WorkJob["status"]): void {
    if (job.status !== expected) {
      throw new DomainError(
        `job must be ${expected}; current status is ${job.status}`,
        "INVALID_JOB_STATUS",
      );
    }
  }
}
