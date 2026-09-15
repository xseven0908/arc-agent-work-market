import { createPublicClient, http } from "viem";
import { agenticCommerceAbi, identityRegistryAbi } from "./abi.js";
import { ARC_CONTRACTS, arcTestnet } from "./arc.js";

export function createArcReader(rpcUrl = process.env.ARC_RPC_URL) {
  const client = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  return {
    async getAgentIdentity(agentId: bigint) {
      const [owner, metadataUri] = await Promise.all([
        client.readContract({
          address: ARC_CONTRACTS.identityRegistry,
          abi: identityRegistryAbi,
          functionName: "ownerOf",
          args: [agentId],
        }),
        client.readContract({
          address: ARC_CONTRACTS.identityRegistry,
          abi: identityRegistryAbi,
          functionName: "tokenURI",
          args: [agentId],
        }),
      ]);
      return { agentId: agentId.toString(), owner, metadataUri };
    },

    async getJob(jobId: bigint) {
      return client.readContract({
        address: ARC_CONTRACTS.agenticCommerce,
        abi: agenticCommerceAbi,
        functionName: "getJob",
        args: [jobId],
      });
    },
  };
}
