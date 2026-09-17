import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  AgentProfile,
  ChainActivityEvent,
  ChainSyncCheckpoint,
  WorkJob,
} from "../domain/types.js";
import type { MarketplaceStore } from "./store.js";

interface JsonRow {
  payload: string;
}

export class SqliteMarketplaceStore implements MarketplaceStore {
  private readonly database: DatabaseSync;

  constructor(databasePath: string) {
    if (databasePath !== ":memory:") {
      mkdirSync(dirname(databasePath), { recursive: true });
    }
    this.database = new DatabaseSync(databasePath);
    this.database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        provider_agent_id TEXT NOT NULL REFERENCES agents(id),
        status TEXT NOT NULL,
        chain_job_id TEXT,
        updated_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS jobs_chain_job_id_unique
        ON jobs(chain_job_id) WHERE chain_job_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS settlement_evidence (
        job_id TEXT PRIMARY KEY REFERENCES jobs(id),
        transaction_hash TEXT NOT NULL UNIQUE,
        chain_job_id TEXT NOT NULL UNIQUE,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chain_events (
        id TEXT PRIMARY KEY,
        block_number INTEGER NOT NULL,
        log_index INTEGER NOT NULL,
        event_name TEXT NOT NULL,
        transaction_hash TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS chain_events_order
        ON chain_events(block_number DESC, log_index DESC);

      CREATE TABLE IF NOT EXISTS chain_sync_checkpoints (
        name TEXT PRIMARY KEY,
        block_number INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
    `);
  }

  async saveAgent(agent: AgentProfile): Promise<void> {
    this.database
      .prepare(`
        INSERT INTO agents (id, owner, created_at, payload)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          owner = excluded.owner,
          created_at = excluded.created_at,
          payload = excluded.payload
      `)
      .run(agent.id, agent.owner.toLowerCase(), agent.createdAt, JSON.stringify(agent));
  }

  async getAgent(id: string): Promise<AgentProfile | undefined> {
    const row = this.database
      .prepare("SELECT payload FROM agents WHERE id = ?")
      .get(id) as JsonRow | undefined;
    return row ? (JSON.parse(row.payload) as AgentProfile) : undefined;
  }

  async listAgents(): Promise<AgentProfile[]> {
    const rows = this.database
      .prepare("SELECT payload FROM agents ORDER BY created_at DESC, id")
      .all() as unknown as JsonRow[];
    return rows.map((row) => JSON.parse(row.payload) as AgentProfile);
  }

  async saveJob(job: WorkJob): Promise<void> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(`
          INSERT INTO jobs (id, provider_agent_id, status, chain_job_id, updated_at, payload)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            provider_agent_id = excluded.provider_agent_id,
            status = excluded.status,
            chain_job_id = excluded.chain_job_id,
            updated_at = excluded.updated_at,
            payload = excluded.payload
        `)
        .run(
          job.id,
          job.providerAgentId,
          job.status,
          job.chainJobId ?? null,
          job.updatedAt,
          JSON.stringify(job),
        );

      if (job.settlement) {
        this.database
          .prepare(`
            INSERT INTO settlement_evidence (job_id, transaction_hash, chain_job_id, payload)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
              transaction_hash = excluded.transaction_hash,
              chain_job_id = excluded.chain_job_id,
              payload = excluded.payload
          `)
          .run(
            job.id,
            job.settlement.transactionHash.toLowerCase(),
            job.settlement.chainJobId,
            JSON.stringify(job.settlement),
          );
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  async getJob(id: string): Promise<WorkJob | undefined> {
    const row = this.database
      .prepare("SELECT payload FROM jobs WHERE id = ?")
      .get(id) as JsonRow | undefined;
    return row ? (JSON.parse(row.payload) as WorkJob) : undefined;
  }

  async listJobs(): Promise<WorkJob[]> {
    const rows = this.database
      .prepare("SELECT payload FROM jobs ORDER BY updated_at DESC, id")
      .all() as unknown as JsonRow[];
    return rows.map((row) => JSON.parse(row.payload) as WorkJob);
  }

  async listJobsForAgent(agentId: string): Promise<WorkJob[]> {
    const rows = this.database
      .prepare(`
        SELECT payload FROM jobs
        WHERE provider_agent_id = ?
        ORDER BY updated_at DESC, id
      `)
      .all(agentId) as unknown as JsonRow[];
    return rows.map((row) => JSON.parse(row.payload) as WorkJob);
  }

  async saveChainEvents(
    events: ChainActivityEvent[],
    checkpoint: ChainSyncCheckpoint,
  ): Promise<void> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const saveEvent = this.database.prepare(`
        INSERT INTO chain_events (
          id, block_number, log_index, event_name, transaction_hash, payload
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          block_number = excluded.block_number,
          log_index = excluded.log_index,
          event_name = excluded.event_name,
          transaction_hash = excluded.transaction_hash,
          payload = excluded.payload
      `);
      for (const event of events) {
        saveEvent.run(
          event.id,
          Number(event.blockNumber),
          event.logIndex,
          event.eventName,
          event.transactionHash.toLowerCase(),
          JSON.stringify(event),
        );
      }
      this.database
        .prepare(`
          INSERT INTO chain_sync_checkpoints (name, block_number, updated_at, payload)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(name) DO UPDATE SET
            block_number = excluded.block_number,
            updated_at = excluded.updated_at,
            payload = excluded.payload
        `)
        .run(
          checkpoint.name,
          Number(checkpoint.blockNumber),
          checkpoint.updatedAt,
          JSON.stringify(checkpoint),
        );
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  async listChainEvents(limit: number): Promise<ChainActivityEvent[]> {
    const rows = this.database
      .prepare(`
        SELECT payload FROM chain_events
        ORDER BY block_number DESC, log_index DESC
        LIMIT ?
      `)
      .all(limit) as unknown as JsonRow[];
    return rows.map((row) => JSON.parse(row.payload) as ChainActivityEvent);
  }

  async getChainCheckpoint(
    name: string,
  ): Promise<ChainSyncCheckpoint | undefined> {
    const row = this.database
      .prepare("SELECT payload FROM chain_sync_checkpoints WHERE name = ?")
      .get(name) as JsonRow | undefined;
    return row ? (JSON.parse(row.payload) as ChainSyncCheckpoint) : undefined;
  }

  close(): void {
    this.database.close();
  }
}
