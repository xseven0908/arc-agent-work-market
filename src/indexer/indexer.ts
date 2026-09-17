import type {
  ChainActivityEvent,
  ChainSyncCheckpoint,
} from "../domain/types.js";
import type { MarketplaceStore } from "../store/store.js";

export interface ChainActivityReader {
  latestBlock(): Promise<bigint>;
  readRange(fromBlock: bigint, toBlock: bigint): Promise<ChainActivityEvent[]>;
}

export interface IndexSummary {
  checkpoint: string;
  fromBlock: string | null;
  toBlock: string;
  chunks: number;
  eventsIndexed: number;
  alreadyCurrent: boolean;
}

export class ArcEventIndexer {
  constructor(
    private readonly store: MarketplaceStore,
    private readonly reader: ChainActivityReader,
    private readonly options: {
      checkpointName: string;
      startBlock: bigint;
      chunkSize: bigint;
    },
  ) {
    if (options.chunkSize < 1n) throw new Error("chunkSize must be positive");
  }

  async sync(): Promise<IndexSummary> {
    const latest = await this.reader.latestBlock();
    const previous = await this.store.getChainCheckpoint(
      this.options.checkpointName,
    );
    const firstBlock = previous
      ? BigInt(previous.blockNumber) + 1n
      : this.options.startBlock;

    if (firstBlock > latest) {
      return {
        checkpoint: this.options.checkpointName,
        fromBlock: null,
        toBlock: latest.toString(),
        chunks: 0,
        eventsIndexed: 0,
        alreadyCurrent: true,
      };
    }

    let chunks = 0;
    let eventsIndexed = 0;
    for (
      let fromBlock = firstBlock;
      fromBlock <= latest;
      fromBlock += this.options.chunkSize
    ) {
      const toBlock = fromBlock + this.options.chunkSize - 1n > latest
        ? latest
        : fromBlock + this.options.chunkSize - 1n;
      const events = await this.reader.readRange(fromBlock, toBlock);
      const checkpoint: ChainSyncCheckpoint = {
        name: this.options.checkpointName,
        blockNumber: toBlock.toString(),
        updatedAt: new Date().toISOString(),
      };
      await this.store.saveChainEvents(events, checkpoint);
      chunks += 1;
      eventsIndexed += events.length;
    }

    return {
      checkpoint: this.options.checkpointName,
      fromBlock: firstBlock.toString(),
      toBlock: latest.toString(),
      chunks,
      eventsIndexed,
      alreadyCurrent: false,
    };
  }
}
