import Fastify from "fastify";
import { ZodError } from "zod";
import { DomainError } from "../domain/errors.js";
import type { MarketplaceService } from "../services/marketplace.js";
import {
  completeJobSchema,
  createJobSchema,
  fundJobSchema,
  registerAgentSchema,
  submitJobSchema,
} from "./schemas.js";
import { demoHtml } from "./demo.js";

export function buildApp(service: MarketplaceService) {
  const app = Fastify({ logger: false });

  app.get("/", async (_request, reply) =>
    reply.type("text/html; charset=utf-8").send(demoHtml),
  );
  app.get("/health", async () => ({ status: "ok", chainId: 5042002 }));

  app.get("/agents", async () => service.listAgents());
  app.post("/agents", async (request, reply) => {
    const agent = await service.registerAgent(registerAgentSchema.parse(request.body));
    return reply.code(201).send(agent);
  });
  app.get<{ Params: { id: string } }>("/agents/:id/reputation", async (request) =>
    service.getReputation(request.params.id),
  );

  app.post("/jobs", async (request, reply) => {
    const job = await service.createJob(createJobSchema.parse(request.body));
    return reply.code(201).send(job);
  });
  app.get("/jobs", async () => service.listJobs());
  app.get<{ Params: { id: string } }>("/jobs/:id", async (request) =>
    service.getJob(request.params.id),
  );
  app.post<{ Params: { id: string } }>("/jobs/:id/fund", async (request) => {
    const body = fundJobSchema.parse(request.body);
    return service.markFunded(request.params.id, body.chainJobId);
  });
  app.post<{ Params: { id: string } }>("/jobs/:id/submit", async (request) => {
    const body = submitJobSchema.parse(request.body);
    return service.submitDeliverable(
      request.params.id,
      body.artifactUri,
      body.digest,
    );
  });
  app.post<{ Params: { id: string } }>("/jobs/:id/complete", async (request) => {
    const body = completeJobSchema.parse(request.body);
    return service.completeJob(
      request.params.id,
      body.evaluator,
      body.transactionHash,
      body.score,
    );
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        issues: error.issues,
      });
    }
    if (error instanceof DomainError) {
      const status = error.code.endsWith("NOT_FOUND") ? 404 : 409;
      return reply.code(status).send({ error: error.code, message: error.message });
    }
    return reply.code(500).send({ error: "INTERNAL_ERROR" });
  });

  return app;
}
