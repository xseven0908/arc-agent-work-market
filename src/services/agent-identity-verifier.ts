import type { Address } from "viem";
import type { AgentIdentityProof } from "../domain/types.js";

export interface AgentIdentityVerificationInput {
  agentId: string;
  owner: Address;
  metadataUri: string;
}

export interface AgentIdentityVerifier {
  verifyIdentity(
    input: AgentIdentityVerificationInput,
  ): Promise<AgentIdentityProof>;
}
