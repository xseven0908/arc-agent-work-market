import { z } from "zod";
import { ARC_CONTRACTS, ARC_TESTNET_CHAIN_ID } from "../chain/arc.js";

const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const hash = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const positiveUsdc = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/)
  .refine((value) => Number(value) > 0, "budget must be greater than zero");

const identityEvidence = z.object({
  agentId: z.string().regex(/^\d+$/),
  metadataUri: z.string().min(1),
  transactionHash: hash,
});

export const testnetEvidenceSchema = z.object({
  schemaVersion: z.literal(2),
  generatedAt: z.iso.datetime(),
  chainId: z.literal(ARC_TESTNET_CHAIN_ID),
  rpcEndpoint: z.string().min(1),
  contracts: z.object({
    usdc: z.literal(ARC_CONTRACTS.usdc),
    identityRegistry: z.literal(ARC_CONTRACTS.identityRegistry),
    reputationRegistry: z.literal(ARC_CONTRACTS.reputationRegistry),
    validationRegistry: z.literal(ARC_CONTRACTS.validationRegistry),
    agenticCommerce: z.literal(ARC_CONTRACTS.agenticCommerce),
  }),
  participants: z.object({
    client: address,
    provider: address,
    evaluator: address,
  }),
  identities: z.object({
    client: identityEvidence.nullable(),
    provider: identityEvidence.nullable(),
  }),
  job: z.object({
    jobId: z.string().regex(/^\d+$/),
    budgetUsdc: positiveUsdc,
    expiredAt: z.string().regex(/^\d+$/),
    description: z.string().min(1),
    artifactUri: z.string().min(1),
    deliverable: hash,
    reason: hash,
  }),
  transactions: z.object({
    createJob: hash,
    setBudget: hash,
    approve: hash,
    fund: hash,
    submit: hash,
    complete: hash,
  }),
});

export type TestnetEvidence = z.infer<typeof testnetEvidenceSchema>;

export function publicRpcEndpoint(rpcUrl: string): string {
  if (rpcUrl === "https://rpc.testnet.arc.network") return rpcUrl;
  return "custom-rpc-redacted";
}
