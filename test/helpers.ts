import type { SettlementVerifier } from "../src/services/settlement-verifier.js";

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
