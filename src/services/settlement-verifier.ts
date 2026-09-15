import type { Address, Hex } from "viem";
import type { SettlementProof } from "../domain/types.js";

export interface SettlementVerificationInput {
  chainJobId: string;
  transactionHash: Hex;
  client: Address;
  provider: Address;
  evaluator: Address;
  budgetUsdc: string;
}

export interface SettlementVerifier {
  verifyCompletion(
    input: SettlementVerificationInput,
  ): Promise<SettlementProof>;
}
