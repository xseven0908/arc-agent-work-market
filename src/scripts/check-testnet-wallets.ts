import {
  createPublicClient,
  formatUnits,
  http,
  parseAbi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_CONTRACTS, ARC_TESTNET_CHAIN_ID, arcTestnet } from "../chain/arc.js";
import { publicRpcEndpoint } from "../evidence/schema.js";

const usdcAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

function requirePrivateKey(name: string): Hex {
  const value = process.env[name];
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 32-byte 0x-prefixed private key`);
  }
  return value as Hex;
}

const rpcUrl = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const client = privateKeyToAccount(requirePrivateKey("CLIENT_PRIVATE_KEY"));
const provider = privateKeyToAccount(requirePrivateKey("PROVIDER_PRIVATE_KEY"));
const evaluator = process.env.EVALUATOR_PRIVATE_KEY
  ? privateKeyToAccount(requirePrivateKey("EVALUATOR_PRIVATE_KEY"))
  : client;
const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });

const chainId = await publicClient.getChainId();
if (chainId !== ARC_TESTNET_CHAIN_ID) {
  throw new Error(`RPC chain ID ${chainId} does not match Arc Testnet ${ARC_TESTNET_CHAIN_ID}`);
}

async function balancesFor(address: `0x${string}`) {
  const [native, erc20] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.readContract({
      address: ARC_CONTRACTS.usdc,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [address],
    }),
  ]);
  return { native, erc20 };
}

const [clientBalances, providerBalances, evaluatorBalances] = await Promise.all([
  balancesFor(client.address),
  balancesFor(provider.address),
  balancesFor(evaluator.address),
]);

console.log(JSON.stringify({
  chainId,
  rpcEndpoint: publicRpcEndpoint(rpcUrl),
  wallets: {
    client: {
      address: client.address,
      nativeUsdc: formatUnits(clientBalances.native, 18),
      erc20Usdc: formatUnits(clientBalances.erc20, 6),
    },
    provider: {
      address: provider.address,
      nativeUsdc: formatUnits(providerBalances.native, 18),
      erc20Usdc: formatUnits(providerBalances.erc20, 6),
    },
    evaluator: {
      address: evaluator.address,
      nativeUsdc: formatUnits(evaluatorBalances.native, 18),
      erc20Usdc: formatUnits(evaluatorBalances.erc20, 6),
      reusesClientWallet: evaluator.address === client.address,
    },
  },
}, null, 2));
