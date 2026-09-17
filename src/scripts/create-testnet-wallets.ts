import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const outputPath = process.env.WALLET_ENV_PATH ?? ".env";
const clientPrivateKey = generatePrivateKey();
const providerPrivateKey = generatePrivateKey();
const client = privateKeyToAccount(clientPrivateKey);
const provider = privateKeyToAccount(providerPrivateKey);

const contents = [
  "# Arc Testnet-only wallets. Never commit, share, or reuse these keys on mainnet.",
  "HOST=127.0.0.1",
  "PORT=3000",
  "ARC_RPC_URL=https://rpc.testnet.arc.network",
  "DATABASE_PATH=data/marketplace.db",
  "",
  "# Keep disabled until balances and the plan have been reviewed.",
  "EXECUTE_TESTNET=false",
  `CLIENT_PRIVATE_KEY=${clientPrivateKey}`,
  `PROVIDER_PRIVATE_KEY=${providerPrivateKey}`,
  "REGISTER_IDENTITIES=true",
  "CLIENT_AGENT_METADATA_URI=https://raw.githubusercontent.com/xseven0908/arc-agent-work-market/v0.5.1/metadata/client-agent.json",
  "PROVIDER_AGENT_METADATA_URI=https://raw.githubusercontent.com/xseven0908/arc-agent-work-market/v0.5.1/metadata/provider-agent.json",
  "JOB_BUDGET_USDC=0.1",
  "EVIDENCE_OUTPUT=deployments/arc-testnet.local.json",
  "",
].join("\n");

try {
  writeFileSync(outputPath, contents, { encoding: "utf8", flag: "wx", mode: 0o600 });
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === "EEXIST") {
    throw new Error(`${outputPath} already exists; refusing to overwrite wallet secrets`);
  }
  throw error;
}

console.log(JSON.stringify({
  envPath: resolve(outputPath),
  clientAddress: client.address,
  providerAddress: provider.address,
  evaluatorAddress: client.address,
  executeTestnet: false,
  message: "Private keys were written only to the ignored local env file. Fund both public addresses before execution.",
}, null, 2));
