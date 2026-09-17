import {
  createPublicClient,
  decodeEventLog,
  http,
  zeroAddress,
  type Address,
  type Hex,
  type Log,
} from "viem";
import type { ChainActivityEvent } from "../domain/types.js";
import type { ChainActivityReader } from "../indexer/indexer.js";
import { agenticCommerceAbi, identityRegistryAbi } from "./abi.js";
import { ARC_CONTRACTS, arcTestnet } from "./arc.js";

type DecodedArguments = Record<string, unknown>;

function normalizedDetails(args: DecodedArguments): Record<string, string> {
  return Object.fromEntries(
    Object.entries(args).flatMap(([key, value]) => {
      if (typeof value === "bigint") return [[key, value.toString()]];
      if (typeof value === "string") return [[key, value]];
      if (typeof value === "number" || typeof value === "boolean") {
        return [[key, String(value)]];
      }
      return [];
    }),
  );
}

function baseEvent(
  log: Log,
  source: ChainActivityEvent["source"],
  contractAddress: Address,
  eventName: string,
  details: Record<string, string>,
): ChainActivityEvent | undefined {
  if (
    log.blockNumber === null ||
    log.logIndex === null ||
    log.transactionHash === null
  ) {
    return undefined;
  }
  return {
    id: `${log.transactionHash.toLowerCase()}:${log.logIndex}`,
    chainId: 5042002,
    source,
    contractAddress,
    eventName,
    blockNumber: log.blockNumber.toString(),
    logIndex: log.logIndex,
    transactionHash: log.transactionHash,
    ...(details.jobId ? { jobId: details.jobId } : {}),
    ...(details.tokenId ? { identityId: details.tokenId } : {}),
    details,
    indexedAt: new Date().toISOString(),
  };
}

function decodeIdentityLog(log: Log): ChainActivityEvent | undefined {
  try {
    const decoded = decodeEventLog({
      abi: identityRegistryAbi,
      data: log.data as Hex,
      topics: log.topics,
    });
    if (decoded.eventName !== "Transfer") return undefined;
    const details = normalizedDetails(decoded.args as DecodedArguments);
    if (details.from?.toLowerCase() !== zeroAddress) return undefined;
    return baseEvent(
      log,
      "erc8004",
      ARC_CONTRACTS.identityRegistry,
      "IdentityRegistered",
      details,
    );
  } catch {
    return undefined;
  }
}

function decodeCommerceLog(log: Log): ChainActivityEvent | undefined {
  try {
    const decoded = decodeEventLog({
      abi: agenticCommerceAbi,
      data: log.data as Hex,
      topics: log.topics,
    });
    const details = normalizedDetails(decoded.args as DecodedArguments);
    return baseEvent(
      log,
      "erc8183",
      ARC_CONTRACTS.agenticCommerce,
      decoded.eventName,
      details,
    );
  } catch {
    return undefined;
  }
}

export function createArcActivityReader(
  rpcUrl = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network",
): ChainActivityReader {
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });
  return {
    latestBlock: () => publicClient.getBlockNumber(),
    async readRange(fromBlock, toBlock) {
      const [identityLogs, commerceLogs] = await Promise.all([
        publicClient.getLogs({
          address: ARC_CONTRACTS.identityRegistry,
          fromBlock,
          toBlock,
        }),
        publicClient.getLogs({
          address: ARC_CONTRACTS.agenticCommerce,
          fromBlock,
          toBlock,
        }),
      ]);
      return [
        ...identityLogs.map(decodeIdentityLog),
        ...commerceLogs.map(decodeCommerceLog),
      ]
        .filter((event): event is ChainActivityEvent => event !== undefined)
        .sort((left, right) => {
          const blockOrder = BigInt(left.blockNumber) < BigInt(right.blockNumber)
            ? -1
            : BigInt(left.blockNumber) > BigInt(right.blockNumber)
              ? 1
              : 0;
          return blockOrder || left.logIndex - right.logIndex;
        });
    },
  };
}
