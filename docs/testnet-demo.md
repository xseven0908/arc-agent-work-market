# Arc Testnet demonstration runbook

> [!CAUTION]
> This runbook is for isolated Arc Testnet wallets only. The code is unaudited.
> Never use a wallet that has held mainnet assets, and never commit or paste keys
> into issues, logs, screenshots, or shell commands.

## What the workflow does

The operator-run script can optionally register client and provider ERC-8004
identities, then executes the ERC-8183 lifecycle:

1. Create a job.
2. Let the provider set its USDC budget.
3. Approve the AgenticCommerce contract.
4. Fund escrow.
5. Submit a deliverable hash.
6. Complete settlement as the evaluator.
7. Write public addresses, job data, and transaction hashes to an evidence file.
8. Independently verify the evidence against Arc RPC.

The API server never reads wallet keys. Only this standalone script has a signing
boundary.

## Prepare safely

1. Generate fresh Testnet-only client and provider wallets with the command below.
   It creates an ignored `.env` with mode `600`, prints public addresses only, and
   refuses to overwrite an existing file:

   ```bash
   npm run wallets:create:testnet
   ```

2. Fund them through an official Arc/Circle Testnet faucet. The client needs the
   ERC-20 USDC job amount; every signing account needs native USDC for gas.
3. Check both public balances without exposing their private keys:

   ```bash
   npm run wallets:check:testnet
   ```

4. Leave `EXECUTE_TESTNET=false` and review the plan:

```bash
npm run demo:testnet
```

## Execute after review

Set these values inside the ignored `.env` file:

```dotenv
EXECUTE_TESTNET=true
CLIENT_PRIVATE_KEY=0x...
PROVIDER_PRIVATE_KEY=0x...
JOB_BUDGET_USDC=0.1
EVIDENCE_OUTPUT=deployments/arc-testnet.local.json
```

The evaluator defaults to the client. To use a separate evaluator, provide
`EVALUATOR_PRIVATE_KEY`. To mint fresh ERC-8004 identities during the same run,
also set `REGISTER_IDENTITIES=true` and both metadata URI variables.

Run the workflow once:

```bash
npm run demo:testnet
```

The script validates the RPC chain ID, distinct client/provider accounts, gas
balances, and client ERC-20 balance before the first transaction. Every contract
call is simulated before signing, and every receipt must succeed before the next
step begins.

Custom RPC URLs are never copied verbatim into the evidence file because they can
contain provider API keys. The official public endpoint is recorded as-is; every
other endpoint is represented as `custom-rpc-redacted`.

## Publish evidence

First run the independent verifier:

```bash
npm run evidence:verify -- deployments/arc-testnet.local.json
```

Then inspect the file, independently open every transaction in the official Arc
Explorer, and confirm that it contains no private information. Only after both
automated and manual verification should a sanitized copy be committed as
`deployments/arc-testnet.json`.

The evidence artifact intentionally contains no private keys, API keys, entity
secrets, or signatures beyond already-public transaction hashes.
