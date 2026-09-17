import {
  createPublicClient,
  decodeFunctionData,
  http,
  parseAbi,
  parseEventLogs,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { agenticCommerceAbi, identityRegistryAbi } from "../chain/abi.js";
import { ARC_CONTRACTS, ARC_TESTNET_CHAIN_ID, arcTestnet } from "../chain/arc.js";
import type { TestnetEvidence } from "./schema.js";

const usdcAbi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);
const COMPLETED_STATUS = 3;

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function requireCondition(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export interface EvidenceVerificationReport {
  valid: true;
  chainId: number;
  jobId: string;
  firstBlock: string;
  lastBlock: string;
  verifiedTransactions: number;
  verifiedIdentities: number;
}

export async function verifyTestnetEvidence(
  evidence: TestnetEvidence,
  rpcUrl = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network",
): Promise<EvidenceVerificationReport> {
  const client = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
  const actualChainId = await client.getChainId();
  requireCondition(actualChainId === ARC_TESTNET_CHAIN_ID, "RPC is not Arc Testnet");

  async function transaction(
    hash: Hex,
    expectedFrom: Address,
    expectedTo: Address,
  ) {
    const [receipt, chainTransaction] = await Promise.all([
      client.getTransactionReceipt({ hash }),
      client.getTransaction({ hash }),
    ]);
    requireCondition(receipt.status === "success", `transaction reverted: ${hash}`);
    requireCondition(
      sameAddress(chainTransaction.from, expectedFrom),
      `unexpected sender for transaction ${hash}`,
    );
    requireCondition(
      chainTransaction.to !== null && sameAddress(chainTransaction.to, expectedTo),
      `unexpected target for transaction ${hash}`,
    );
    return { receipt, transaction: chainTransaction };
  }

  let verifiedIdentities = 0;
  for (const [role, identity, expectedOwner] of [
    ["client", evidence.identities.client, evidence.participants.client],
    ["provider", evidence.identities.provider, evidence.participants.provider],
  ] as const) {
    if (!identity) continue;
    const registered = await transaction(
      identity.transactionHash as Hex,
      expectedOwner as Address,
      ARC_CONTRACTS.identityRegistry,
    );
    const transferEvents = parseEventLogs({
      abi: identityRegistryAbi,
      eventName: "Transfer",
      logs: registered.receipt.logs,
    });
    requireCondition(
      transferEvents.some(
        (event) =>
          event.args.tokenId === BigInt(identity.agentId) &&
          sameAddress(event.args.to, expectedOwner),
      ),
      `${role} identity mint event does not match evidence`,
    );
    const [owner, metadataUri] = await Promise.all([
      client.readContract({
        address: ARC_CONTRACTS.identityRegistry,
        abi: identityRegistryAbi,
        functionName: "ownerOf",
        args: [BigInt(identity.agentId)],
      }),
      client.readContract({
        address: ARC_CONTRACTS.identityRegistry,
        abi: identityRegistryAbi,
        functionName: "tokenURI",
        args: [BigInt(identity.agentId)],
      }),
    ]);
    requireCondition(sameAddress(owner, expectedOwner), `${role} no longer owns identity`);
    requireCondition(metadataUri === identity.metadataUri, `${role} metadata URI changed`);
    verifiedIdentities += 1;
  }

  const createJob = await transaction(
    evidence.transactions.createJob as Hex,
    evidence.participants.client as Address,
    ARC_CONTRACTS.agenticCommerce,
  );
  const setBudget = await transaction(
    evidence.transactions.setBudget as Hex,
    evidence.participants.provider as Address,
    ARC_CONTRACTS.agenticCommerce,
  );
  const approve = await transaction(
    evidence.transactions.approve as Hex,
    evidence.participants.client as Address,
    ARC_CONTRACTS.usdc,
  );
  const fund = await transaction(
    evidence.transactions.fund as Hex,
    evidence.participants.client as Address,
    ARC_CONTRACTS.agenticCommerce,
  );
  const submit = await transaction(
    evidence.transactions.submit as Hex,
    evidence.participants.provider as Address,
    ARC_CONTRACTS.agenticCommerce,
  );
  const complete = await transaction(
    evidence.transactions.complete as Hex,
    evidence.participants.evaluator as Address,
    ARC_CONTRACTS.agenticCommerce,
  );

  const jobId = BigInt(evidence.job.jobId);
  const budget = parseUnits(evidence.job.budgetUsdc, 6);
  const createCall = decodeFunctionData({
    abi: agenticCommerceAbi,
    data: createJob.transaction.input,
  });
  requireCondition(createCall.functionName === "createJob", "invalid createJob call");
  requireCondition(
    sameAddress(createCall.args[0], evidence.participants.provider) &&
      sameAddress(createCall.args[1], evidence.participants.evaluator) &&
      createCall.args[2] === BigInt(evidence.job.expiredAt) &&
      createCall.args[3] === evidence.job.description,
    "createJob parameters do not match evidence",
  );

  const budgetCall = decodeFunctionData({
    abi: agenticCommerceAbi,
    data: setBudget.transaction.input,
  });
  requireCondition(
    budgetCall.functionName === "setBudget" &&
      budgetCall.args[0] === jobId &&
      budgetCall.args[1] === budget,
    "setBudget call does not match evidence",
  );

  const approveCall = decodeFunctionData({ abi: usdcAbi, data: approve.transaction.input });
  requireCondition(
    approveCall.functionName === "approve" &&
      sameAddress(approveCall.args[0], ARC_CONTRACTS.agenticCommerce) &&
      approveCall.args[1] === budget,
    "approve call does not match evidence",
  );

  const fundCall = decodeFunctionData({ abi: agenticCommerceAbi, data: fund.transaction.input });
  requireCondition(
    fundCall.functionName === "fund" && fundCall.args[0] === jobId,
    "fund call does not match evidence",
  );
  const submitCall = decodeFunctionData({
    abi: agenticCommerceAbi,
    data: submit.transaction.input,
  });
  requireCondition(
    submitCall.functionName === "submit" &&
      submitCall.args[0] === jobId &&
      submitCall.args[1] === evidence.job.deliverable,
    "submit call does not match evidence",
  );
  const completeCall = decodeFunctionData({
    abi: agenticCommerceAbi,
    data: complete.transaction.input,
  });
  requireCondition(
    completeCall.functionName === "complete" &&
      completeCall.args[0] === jobId &&
      completeCall.args[1] === evidence.job.reason,
    "complete call does not match evidence",
  );

  const receipts = [
    createJob.receipt,
    setBudget.receipt,
    approve.receipt,
    fund.receipt,
    submit.receipt,
    complete.receipt,
  ];
  for (let index = 1; index < receipts.length; index += 1) {
    const previous = receipts[index - 1]!;
    const current = receipts[index]!;
    requireCondition(
      current.blockNumber > previous.blockNumber ||
        (current.blockNumber === previous.blockNumber &&
          current.transactionIndex > previous.transactionIndex),
      "workflow transactions are not in the expected order",
    );
  }

  const job = await client.readContract({
    address: ARC_CONTRACTS.agenticCommerce,
    abi: agenticCommerceAbi,
    functionName: "getJob",
    args: [jobId],
  });
  requireCondition(
    job.id === jobId &&
      sameAddress(job.client, evidence.participants.client) &&
      sameAddress(job.provider, evidence.participants.provider) &&
      sameAddress(job.evaluator, evidence.participants.evaluator) &&
      job.budget === budget &&
      job.status === COMPLETED_STATUS,
    "final onchain job state does not match evidence",
  );

  return {
    valid: true,
    chainId: actualChainId,
    jobId: evidence.job.jobId,
    firstBlock: receipts[0]!.blockNumber.toString(),
    lastBlock: receipts.at(-1)!.blockNumber.toString(),
    verifiedTransactions: receipts.length,
    verifiedIdentities,
  };
}
