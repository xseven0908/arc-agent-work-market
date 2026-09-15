import { createPublicClient, http } from "viem";
import { DomainError } from "../domain/errors.js";
import type { AgentIdentityProof } from "../domain/types.js";
import type {
  AgentIdentityVerificationInput,
  AgentIdentityVerifier,
} from "../services/agent-identity-verifier.js";
import { identityRegistryAbi } from "./abi.js";
import { ARC_CONTRACTS, ARC_TESTNET_CHAIN_ID, arcTestnet } from "./arc.js";

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

interface ArcIdentitySnapshot {
  owner: `0x${string}`;
  metadataUri: string;
}

export function buildArcIdentityProof(
  input: AgentIdentityVerificationInput,
  snapshot: ArcIdentitySnapshot,
  verifiedAt = new Date().toISOString(),
): AgentIdentityProof {
  if (!sameAddress(snapshot.owner, input.owner)) {
    throw new DomainError(
      "the supplied owner does not own this ERC-8004 identity",
      "IDENTITY_OWNER_MISMATCH",
    );
  }
  if (snapshot.metadataUri !== input.metadataUri) {
    throw new DomainError(
      "metadataUri does not match the ERC-8004 token URI",
      "IDENTITY_METADATA_MISMATCH",
    );
  }
  return {
    chainId: ARC_TESTNET_CHAIN_ID,
    registryAddress: ARC_CONTRACTS.identityRegistry,
    agentId: input.agentId,
    owner: snapshot.owner,
    metadataUri: snapshot.metadataUri,
    verifiedAt,
  };
}

export function createArcAgentIdentityVerifier(
  rpcUrl = process.env.ARC_RPC_URL,
): AgentIdentityVerifier {
  const client = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  return {
    async verifyIdentity(input) {
      if (!/^\d+$/.test(input.agentId)) {
        throw new DomainError("ERC-8004 agent ID must be an integer", "INVALID_IDENTITY");
      }

      let owner;
      let metadataUri;
      try {
        [owner, metadataUri] = await Promise.all([
          client.readContract({
            address: ARC_CONTRACTS.identityRegistry,
            abi: identityRegistryAbi,
            functionName: "ownerOf",
            args: [BigInt(input.agentId)],
          }),
          client.readContract({
            address: ARC_CONTRACTS.identityRegistry,
            abi: identityRegistryAbi,
            functionName: "tokenURI",
            args: [BigInt(input.agentId)],
          }),
        ]);
      } catch {
        throw new DomainError(
          "unable to resolve the ERC-8004 identity on Arc Testnet",
          "IDENTITY_LOOKUP_FAILED",
        );
      }

      return buildArcIdentityProof(input, { owner, metadataUri });
    },
  };
}
