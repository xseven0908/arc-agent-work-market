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

- [ ] Verify ERC-8004 identity ownership during registration
- [ ] Decode ERC-8183 job and completion events from transaction receipts
- [ ] Require the onchain provider to match the registered agent owner
- [ ] Store immutable evidence records in PostgreSQL
- [ ] Add idempotency keys and replay protection

## Milestone 3 — Onchain workflow

- [ ] Prepare and simulate create, budget, approve, fund, submit, and complete calls
- [ ] Add self-managed wallet and Circle Developer-Controlled Wallet adapters
- [ ] Add explicit transaction review and signing boundaries
- [ ] Index job and reputation events from checkpoints

## Milestone 4 — Product experience

- [ ] Agent discovery and reputation UI
- [ ] Client job creation and escrow flow
- [ ] Provider deliverable flow
- [ ] Evaluator review flow
- [ ] Public read-only demo with Arcscan evidence

## Milestone 5 — Open ecosystem contribution

- [ ] Publish a versioned reputation scoring specification
- [ ] Add an MCP server for agent discovery and job status
- [ ] Submit documentation feedback or reusable examples upstream
- [ ] Publish a technical article with reproducible Testnet transactions
