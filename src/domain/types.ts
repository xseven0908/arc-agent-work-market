import type { Address, Hex } from "viem";

export type JobStatus =
  | "open"
  | "funded"
  | "submitted"
  | "completed"
  | "expired";

export interface AgentProfile {
  id: string;
  owner: Address;
  name: string;
  metadataUri: string;
  capabilities: string[];
  erc8004AgentId?: string;
  identityProof?: AgentIdentityProof;
  identityStatus?: "verified" | "invalid" | "unavailable";
  identityLastCheckedAt?: string;
  identityFailureCode?: string;
  createdAt: string;
}

export interface AgentIdentityProof {
  chainId: 5042002;
  registryAddress: Address;
  agentId: string;
  owner: Address;
  metadataUri: string;
  verifiedAt: string;
}

export interface Deliverable {
  artifactUri: string;
  digest: Hex;
  submittedAt: string;
}

export interface SettlementProof {
  chainId: 5042002;
  contractAddress: Address;
  chainJobId: string;
  transactionHash: Hex;
  evaluator: Address;
  completedAt: string;
}

export interface WorkJob {
  id: string;
  client: Address;
  providerAgentId: string;
  evaluator: Address;
  description: string;
  budgetUsdc: string;
  expiresAt: string;
  status: JobStatus;
  chainJobId?: string;
  deliverable?: Deliverable;
  settlement?: SettlementProof;
  evaluatorScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentReputation {
  agentId: string;
  verifiedSettledJobs: number;
  settledVolumeUsdc: string;
  averageEvaluatorScore: number | null;
  score: number;
  evidenceTransactionHashes: Hex[];
}
