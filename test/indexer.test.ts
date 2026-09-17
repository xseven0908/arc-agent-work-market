import { describe, expect, it } from "vitest";
import type { ChainActivityEvent } from "../src/domain/types.js";
import {
  ArcEventIndexer,
  type ChainActivityReader,
} from "../src/indexer/indexer.js";
import { InMemoryMarketplaceStore } from "../src/store/store.js";

const contract = "0x0747EEf0706327138c69792bF28Cd525089e4583";

function event(blockNumber: bigint): ChainActivityEvent {
  const suffix = blockNumber.toString(16).padStart(64, "0");
  return {
    id: `0x${suffix}:0`,
    chainId: 5042002,
    source: "erc8183",
    contractAddress: contract,
    eventName: "JobCreated",
    blockNumber: blockNumber.toString(),
    logIndex: 0,
    transactionHash: `0x${suffix}`,
    jobId: blockNumber.toString(),
    details: { jobId: blockNumber.toString() },
    indexedAt: "2026-09-17T00:00:00.000Z",
  };
}

describe("ArcEventIndexer", () => {
  it("indexes chunks atomically and resumes from its checkpoint", async () => {
    const ranges: Array<[bigint, bigint]> = [];
    const reader: ChainActivityReader = {
      async latestBlock() {
        return 14n;
      },
      async readRange(fromBlock, toBlock) {
        ranges.push([fromBlock, toBlock]);
        return [event(fromBlock)];
      },
    };
    const store = new InMemoryMarketplaceStore();
    const indexer = new ArcEventIndexer(store, reader, {
      checkpointName: "test",
      startBlock: 10n,
      chunkSize: 2n,
    });

    await expect(indexer.sync()).resolves.toMatchObject({
      fromBlock: "10",
      toBlock: "14",
      chunks: 3,
      eventsIndexed: 3,
      alreadyCurrent: false,
    });
    expect(ranges).toEqual([[10n, 11n], [12n, 13n], [14n, 14n]]);
    expect(await store.listChainEvents(10)).toHaveLength(3);
    await expect(indexer.sync()).resolves.toMatchObject({
      fromBlock: null,
      chunks: 0,
      eventsIndexed: 0,
      alreadyCurrent: true,
    });
    expect(ranges).toHaveLength(3);
  });

  it("rejects an invalid chunk size", () => {
    const store = new InMemoryMarketplaceStore();
    const reader: ChainActivityReader = {
      latestBlock: async () => 1n,
      readRange: async () => [],
    };
    expect(
      () => new ArcEventIndexer(store, reader, {
        checkpointName: "test",
        startBlock: 1n,
        chunkSize: 0n,
      }),
    ).toThrow("chunkSize must be positive");
  });
});
