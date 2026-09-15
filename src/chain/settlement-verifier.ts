import {
  createPublicClient,
  decodeFunctionData,
  http,
  parseUnits,
} from "viem";
import { DomainError } from "../domain/errors.js";
import type { SettlementProof } from "../domain/types.js";
import type {
  SettlementVerificationInput,
  SettlementVerifier,
} from "../services/settlement-verifier.js";
import { agenticCommerceAbi } from "./abi.js";
import { ARC_CONTRACTS, arcTestnet } from "./arc.js";

const COMPLETED_STATUS = 3;

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export function createArcSettlementVerifier(
  rpcUrl = process.env.ARC_RPC_URL,
): SettlementVerifier {
  const client = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  return {
    async verifyCompletion(
      input: SettlementVerificationInput,
    ): Promise<SettlementProof> {
      const jobId = BigInt(input.chainJobId);
      const [receipt, transaction, job] = await Promise.all([
        client.getTransactionReceipt({ hash: input.transactionHash }),
        client.getTransaction({ hash: input.transactionHash }),
        client.readContract({
          address: ARC_CONTRACTS.agenticCommerce,
          abi: agenticCommerceAbi,
          functionName: "getJob",
          args: [jobId],
        }),
      ]);

      if (receipt.status !== "success") {
        throw new DomainError("settlement transaction reverted", "INVALID_SETTLEMENT");
      }
      if (
        transaction.to === null ||
        !sameAddress(transaction.to, ARC_CONTRACTS.agenticCommerce) ||
        !sameAddress(transaction.from, input.evaluator)
      ) {
        throw new DomainError(
          "settlement transaction sender or target does not match the job",
          "INVALID_SETTLEMENT",
        );
      }

      let call;
      try {
        call = decodeFunctionData({
          abi: agenticCommerceAbi,
          data: transaction.input,
        });
      } catch {
        throw new DomainError(
          "settlement transaction calldata is not an ERC-8183 call",
          "INVALID_SETTLEMENT",
        );
      }
      if (call.functionName !== "complete" || call.args[0] !== jobId) {
        throw new DomainError(
          "transaction does not complete the expected job",
          "INVALID_SETTLEMENT",
        );
      }

      if (
        job.id !== jobId ||
        job.status !== COMPLETED_STATUS ||
        !sameAddress(job.client, input.client) ||
        !sameAddress(job.provider, input.provider) ||
        !sameAddress(job.evaluator, input.evaluator) ||
        job.budget !== parseUnits(input.budgetUsdc, 6)
      ) {
        throw new DomainError(
          "onchain job state does not match the local job",
          "INVALID_SETTLEMENT",
        );
      }

      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      return {
        chainId: 5042002,
        contractAddress: ARC_CONTRACTS.agenticCommerce,
        chainJobId: input.chainJobId,
        transactionHash: input.transactionHash,
        evaluator: input.evaluator,
        completedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
      };
    },
  };
}
