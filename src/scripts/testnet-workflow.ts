import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseAbi,
  parseEventLogs,
  parseUnits,
  toBytes,
  zeroAddress,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { agenticCommerceAbi, identityRegistryAbi } from "../chain/abi.js";
import { ARC_CONTRACTS, ARC_TESTNET_CHAIN_ID, arcTestnet } from "../chain/arc.js";

const usdcAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

function requirePrivateKey(name: string): Hex {
  const value = process.env[name];
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 32-byte 0x-prefixed private key`);
  }
  return value as Hex;
}

function requireMetadataUri(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required when REGISTER_IDENTITIES=true`);
  return value;
}

const rpcUrl = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const execute = process.env.EXECUTE_TESTNET === "true";
const registerIdentities = process.env.REGISTER_IDENTITIES === "true";
const budgetUsdc = process.env.JOB_BUDGET_USDC ?? "0.1";
const budget = parseUnits(budgetUsdc, 6);
const description = process.env.JOB_DESCRIPTION ?? "Arc Agent Work Market public Testnet demonstration";
const artifactUri = process.env.ARTIFACT_URI ?? "https://github.com/xseven0908/arc-agent-work-market";
const deliverable = keccak256(toBytes(artifactUri));
const reason = keccak256(toBytes("deliverable-approved"));
const evidenceOutput = process.env.EVIDENCE_OUTPUT ?? "deployments/arc-testnet.local.json";

if (!execute) {
  console.log(JSON.stringify({
    mode: "plan-only",
    message: "No transaction was signed or broadcast. Set EXECUTE_TESTNET=true only after reviewing this plan.",
    chainId: ARC_TESTNET_CHAIN_ID,
    rpcUrl,
    registerIdentities,
    contracts: ARC_CONTRACTS,
    job: { budgetUsdc, description, artifactUri, deliverable, reason },
    requiredSecretEnvironmentVariables: [
      "CLIENT_PRIVATE_KEY",
      "PROVIDER_PRIVATE_KEY",
      "EVALUATOR_PRIVATE_KEY (optional; defaults to client)",
    ],
    output: evidenceOutput,
  }, null, 2));
  process.exit(0);
}

const clientAccount = privateKeyToAccount(requirePrivateKey("CLIENT_PRIVATE_KEY"));
const providerAccount = privateKeyToAccount(requirePrivateKey("PROVIDER_PRIVATE_KEY"));
const evaluatorAccount = process.env.EVALUATOR_PRIVATE_KEY
  ? privateKeyToAccount(requirePrivateKey("EVALUATOR_PRIVATE_KEY"))
  : clientAccount;

const transport = http(rpcUrl);
const publicClient = createPublicClient({ chain: arcTestnet, transport });
const clientWallet = createWalletClient({ account: clientAccount, chain: arcTestnet, transport });
const providerWallet = createWalletClient({ account: providerAccount, chain: arcTestnet, transport });
const evaluatorWallet = createWalletClient({ account: evaluatorAccount, chain: arcTestnet, transport });

const actualChainId = await publicClient.getChainId();
if (actualChainId !== ARC_TESTNET_CHAIN_ID) {
  throw new Error(`RPC chain ID ${actualChainId} does not match Arc Testnet ${ARC_TESTNET_CHAIN_ID}`);
}
if (clientAccount.address.toLowerCase() === providerAccount.address.toLowerCase()) {
  throw new Error("client and provider must use different Testnet accounts");
}

const [clientGasBalance, providerGasBalance, evaluatorGasBalance, clientUsdcBalance] =
  await Promise.all([
    publicClient.getBalance({ address: clientAccount.address }),
    publicClient.getBalance({ address: providerAccount.address }),
    publicClient.getBalance({ address: evaluatorAccount.address }),
    publicClient.readContract({
      address: ARC_CONTRACTS.usdc,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [clientAccount.address],
    }),
  ]);
if (clientGasBalance === 0n || providerGasBalance === 0n || evaluatorGasBalance === 0n) {
  throw new Error("client, provider, and evaluator accounts all need native USDC for gas");
}
if (clientUsdcBalance < budget) {
  throw new Error(`client ERC-20 USDC balance is below the ${budgetUsdc} USDC job budget`);
}

async function successfulReceipt(hash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`transaction reverted: ${hash}`);
  return receipt;
}

async function registerIdentity(
  wallet: typeof clientWallet,
  metadataUri: string,
): Promise<{ agentId: string; transactionHash: Hex }> {
  const simulation = await publicClient.simulateContract({
    account: wallet.account,
    address: ARC_CONTRACTS.identityRegistry,
    abi: identityRegistryAbi,
    functionName: "register",
    args: [metadataUri],
  });
  const transactionHash = await wallet.writeContract(simulation.request);
  const receipt = await successfulReceipt(transactionHash);
  const events = parseEventLogs({
    abi: identityRegistryAbi,
    eventName: "Transfer",
    logs: receipt.logs,
  });
  const registration = events.find(
    (event) => event.args.from.toLowerCase() === zeroAddress,
  );
  if (!registration) throw new Error("identity registration receipt has no mint Transfer event");
  return { agentId: registration.args.tokenId.toString(), transactionHash };
}

let clientIdentity: { agentId: string; transactionHash: Hex } | undefined;
let providerIdentity: { agentId: string; transactionHash: Hex } | undefined;
if (registerIdentities) {
  clientIdentity = await registerIdentity(
    clientWallet,
    requireMetadataUri("CLIENT_AGENT_METADATA_URI"),
  );
  providerIdentity = await registerIdentity(
    providerWallet,
    requireMetadataUri("PROVIDER_AGENT_METADATA_URI"),
  );
}

const expiredAt = BigInt(Math.floor(Date.now() / 1000) + 3600);
const createSimulation = await publicClient.simulateContract({
  account: clientAccount,
  address: ARC_CONTRACTS.agenticCommerce,
  abi: agenticCommerceAbi,
  functionName: "createJob",
  args: [providerAccount.address, evaluatorAccount.address, expiredAt, description, zeroAddress],
});
const createJobHash = await clientWallet.writeContract(createSimulation.request);
const createReceipt = await successfulReceipt(createJobHash);
const jobCreatedEvents = parseEventLogs({
  abi: agenticCommerceAbi,
  eventName: "JobCreated",
  logs: createReceipt.logs,
});
const jobCreated = jobCreatedEvents[0];
if (!jobCreated) throw new Error("createJob receipt has no JobCreated event");
const jobId = jobCreated.args.jobId;

const budgetSimulation = await publicClient.simulateContract({
  account: providerAccount,
  address: ARC_CONTRACTS.agenticCommerce,
  abi: agenticCommerceAbi,
  functionName: "setBudget",
  args: [jobId, budget, "0x"],
});
const setBudgetHash = await providerWallet.writeContract(budgetSimulation.request);
await successfulReceipt(setBudgetHash);

const approveSimulation = await publicClient.simulateContract({
  account: clientAccount,
  address: ARC_CONTRACTS.usdc,
  abi: usdcAbi,
  functionName: "approve",
  args: [ARC_CONTRACTS.agenticCommerce, budget],
});
const approveHash = await clientWallet.writeContract(approveSimulation.request);
await successfulReceipt(approveHash);

const fundSimulation = await publicClient.simulateContract({
  account: clientAccount,
  address: ARC_CONTRACTS.agenticCommerce,
  abi: agenticCommerceAbi,
  functionName: "fund",
  args: [jobId, "0x"],
});
const fundHash = await clientWallet.writeContract(fundSimulation.request);
await successfulReceipt(fundHash);

const submitSimulation = await publicClient.simulateContract({
  account: providerAccount,
  address: ARC_CONTRACTS.agenticCommerce,
  abi: agenticCommerceAbi,
  functionName: "submit",
  args: [jobId, deliverable, "0x"],
});
const submitHash = await providerWallet.writeContract(submitSimulation.request);
await successfulReceipt(submitHash);

const completeSimulation = await publicClient.simulateContract({
  account: evaluatorAccount,
  address: ARC_CONTRACTS.agenticCommerce,
  abi: agenticCommerceAbi,
  functionName: "complete",
  args: [jobId, reason, "0x"],
});
const completeHash = await evaluatorWallet.writeContract(completeSimulation.request);
await successfulReceipt(completeHash);

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  chainId: ARC_TESTNET_CHAIN_ID,
  rpcUrl,
  contracts: ARC_CONTRACTS,
  participants: {
    client: clientAccount.address,
    provider: providerAccount.address,
    evaluator: evaluatorAccount.address,
  },
  identities: {
    client: clientIdentity ?? null,
    provider: providerIdentity ?? null,
  },
  job: {
    jobId: jobId.toString(),
    budgetUsdc,
    expiredAt: expiredAt.toString(),
    description,
    artifactUri,
    deliverable,
    reason,
  },
  transactions: {
    createJob: createJobHash,
    setBudget: setBudgetHash,
    approve: approveHash,
    fund: fundHash,
    submit: submitHash,
    complete: completeHash,
  },
};

mkdirSync(dirname(evidenceOutput), { recursive: true });
writeFileSync(evidenceOutput, `${JSON.stringify(evidence, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
console.log(JSON.stringify({
  success: true,
  jobId: jobId.toString(),
  completeTransactionHash: completeHash,
  evidenceOutput,
}, null, 2));
