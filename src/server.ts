import { buildApp } from "./http/app.js";
import { createArcSettlementVerifier } from "./chain/settlement-verifier.js";
import { createArcAgentIdentityVerifier } from "./chain/identity-verifier.js";
import { MarketplaceService } from "./services/marketplace.js";
import { SqliteMarketplaceStore } from "./store/sqlite-store.js";

const databasePath = process.env.DATABASE_PATH ?? "data/marketplace.db";
const service = new MarketplaceService(
  new SqliteMarketplaceStore(databasePath),
  createArcSettlementVerifier(),
  createArcAgentIdentityVerifier(),
);
const app = buildApp(service);

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "3000");

await app.listen({ host, port });
