import { createArcActivityReader } from "../chain/activity-reader.js";
import { ArcEventIndexer } from "../indexer/indexer.js";
import { SqliteMarketplaceStore } from "../store/sqlite-store.js";

function positiveBigInt(name: string, fallback: string): bigint {
  const value = process.env[name] ?? fallback;
  if (!/^\d+$/.test(value) || BigInt(value) < 1n) {
    throw new Error(`${name} must be a positive integer`);
  }
  return BigInt(value);
}

const databasePath = process.env.DATABASE_PATH ?? "data/marketplace.db";
const store = new SqliteMarketplaceStore(databasePath);
const indexer = new ArcEventIndexer(store, createArcActivityReader(), {
  checkpointName: "arc-testnet-activity-v2",
  startBlock: positiveBigInt("ARC_INDEX_START_BLOCK", "62510300"),
  chunkSize: positiveBigInt("ARC_INDEX_CHUNK_SIZE", "2000"),
});

try {
  console.log(JSON.stringify(await indexer.sync(), null, 2));
} finally {
  store.close();
}
