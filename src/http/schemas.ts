import { z } from "zod";
import type { Address, Hex } from "viem";

const address = z.custom<Address>(
  (value) => typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value),
  "invalid EVM address",
);
const hash = z.custom<Hex>(
  (value) => typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value),
  "invalid transaction hash",
);
const positiveUsdc = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/)
  .refine((value) => Number(value) > 0, "must be greater than zero");

export const registerAgentSchema = z.object({
  owner: address,
  name: z.string().trim().min(1).max(100),
  metadataUri: z.string().trim().min(1).max(2048),
  capabilities: z.array(z.string().trim().min(1).max(64)).max(30),
  erc8004AgentId: z.string().regex(/^\d+$/).optional(),
});

export const createJobSchema = z.object({
  client: address,
  providerAgentId: z.string().uuid(),
  evaluator: address,
  description: z.string().trim().min(1).max(4000),
  budgetUsdc: positiveUsdc,
  expiresAt: z.iso.datetime(),
  chainJobId: z.string().regex(/^\d+$/).optional(),
});

export const fundJobSchema = z.object({
  chainJobId: z.string().regex(/^\d+$/),
});

export const submitJobSchema = z.object({
  artifactUri: z.string().trim().min(1).max(2048),
  digest: hash,
});

export const completeJobSchema = z.object({
  evaluator: address,
  transactionHash: hash,
  score: z.number().int().min(0).max(100),
});
