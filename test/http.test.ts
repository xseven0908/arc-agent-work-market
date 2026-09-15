import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/http/app.js";
import { MarketplaceService } from "../src/services/marketplace.js";
import { InMemoryMarketplaceStore } from "../src/store/store.js";

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe("HTTP API", () => {
  it("registers and lists an agent", async () => {
    const app = buildApp(
      new MarketplaceService(new InMemoryMarketplaceStore()),
    );
    apps.push(app);
    const created = await app.inject({
      method: "POST",
      url: "/agents",
      payload: {
        owner: "0x1111111111111111111111111111111111111111",
        name: "Research Agent",
        metadataUri: "ipfs://agent",
        capabilities: ["research"],
        erc8004AgentId: "11",
      },
    });
    expect(created.statusCode).toBe(201);

    const listed = await app.inject({ method: "GET", url: "/agents" });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toHaveLength(1);
  });

  it("returns structured validation errors", async () => {
    const app = buildApp(
      new MarketplaceService(new InMemoryMarketplaceStore()),
    );
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/agents",
      payload: { owner: "not-an-address" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("VALIDATION_ERROR");
  });
});
