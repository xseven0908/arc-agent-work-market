import { buildApp } from "./http/app.js";
import { MarketplaceService } from "./services/marketplace.js";
import { InMemoryMarketplaceStore } from "./store/store.js";

const service = new MarketplaceService(new InMemoryMarketplaceStore());
const app = buildApp(service);

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "3000");

await app.listen({ host, port });
