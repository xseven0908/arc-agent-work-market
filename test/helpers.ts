import type { SettlementVerifier } from "../src/services/settlement-verifier.js";
import type { AgentIdentityVerifier } from "../src/services/agent-identity-verifier.js";
import { ARC_CONTRACTS } from "../src/chain/arc.js";

export const acceptingAgentIdentityVerifier: AgentIdentityVerifier = {
  async verifyIdentity(input) {
    return {
      chainId: 5042002,
      registryAddress: ARC_CONTRACTS.identityRegistry,
      agentId: input.agentId,
      owner: input.owner,
      metadataUri: input.metadataUri,
      verifiedAt: "2026-09-15T00:00:00.000Z",
    };
  },
};

export const acceptingSettlementVerifier: SettlementVerifier = {
  async verifyCompletion(input) {
    return {
      chainId: 5042002,
      contractAddress: "0x0747EEf0706327138c69792bF28Cd525089e4583",
      chainJobId: input.chainJobId,
      transactionHash: input.transactionHash,
      evaluator: input.evaluator,
      completedAt: "2026-09-15T00:05:00.000Z",
    };
  },
};
