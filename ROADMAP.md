# Roadmap

## Milestone 1 — Domain foundation

- [x] Agent and job models
- [x] ERC-8004 and ERC-8183 Arc Testnet configuration
- [x] Strict job lifecycle
- [x] Proof-backed reputation calculation
- [x] REST API and validation
- [x] Unit and API tests
- [x] CI, architecture, and security documentation

## Milestone 2 — Verify, do not trust

- [x] Verify ERC-8004 identity ownership and metadata during registration
- [x] Verify receipt success and decode the expected `complete(jobId,...)` call
- [x] Require onchain client, provider, evaluator, budget, and final state to match
- [x] Store durable evidence records in SQLite
- [x] Reject reused chain job IDs and settlement transaction hashes
- [ ] Add HTTP idempotency keys and authenticated request replay protection

## Milestone 3 — Onchain workflow

- [x] Prepare and simulate create, budget, approve, fund, submit, and complete calls
- [x] Add an opt-in self-managed Testnet wallet workflow
- [ ] Add self-managed wallet and Circle Developer-Controlled Wallet adapters
- [x] Add explicit plan-only and transaction signing boundaries
- [ ] Index job and reputation events from checkpoints

## Milestone 4 — Product experience

- [x] Read-only agent, job, and evidence dashboard
- [ ] Agent discovery and reputation filtering UI
- [ ] Client job creation and escrow flow
- [ ] Provider deliverable flow
- [ ] Evaluator review flow
- [ ] Public read-only demo with Arcscan evidence

## Milestone 5 — Open ecosystem contribution

- [ ] Publish a versioned reputation scoring specification
- [ ] Add an MCP server for agent discovery and job status
- [ ] Submit documentation feedback or reusable examples upstream
- [ ] Publish a technical article with reproducible Testnet transactions
