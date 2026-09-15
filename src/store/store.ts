import type { AgentProfile, WorkJob } from "../domain/types.js";

export interface MarketplaceStore {
  saveAgent(agent: AgentProfile): Promise<void>;
  getAgent(id: string): Promise<AgentProfile | undefined>;
  listAgents(): Promise<AgentProfile[]>;
  saveJob(job: WorkJob): Promise<void>;
  getJob(id: string): Promise<WorkJob | undefined>;
  listJobs(): Promise<WorkJob[]>;
  listJobsForAgent(agentId: string): Promise<WorkJob[]>;
}

export class InMemoryMarketplaceStore implements MarketplaceStore {
  private readonly agents = new Map<string, AgentProfile>();
  private readonly jobs = new Map<string, WorkJob>();

  async saveAgent(agent: AgentProfile): Promise<void> {
    this.agents.set(agent.id, structuredClone(agent));
  }

  async getAgent(id: string): Promise<AgentProfile | undefined> {
    const agent = this.agents.get(id);
    return agent ? structuredClone(agent) : undefined;
  }

  async listAgents(): Promise<AgentProfile[]> {
    return [...this.agents.values()].map((agent) => structuredClone(agent));
  }

  async saveJob(job: WorkJob): Promise<void> {
    this.jobs.set(job.id, structuredClone(job));
  }

  async getJob(id: string): Promise<WorkJob | undefined> {
    const job = this.jobs.get(id);
    return job ? structuredClone(job) : undefined;
  }

  async listJobs(): Promise<WorkJob[]> {
    return [...this.jobs.values()].map((job) => structuredClone(job));
  }

  async listJobsForAgent(agentId: string): Promise<WorkJob[]> {
    return [...this.jobs.values()]
      .filter((job) => job.providerAgentId === agentId)
      .map((job) => structuredClone(job));
  }
}
