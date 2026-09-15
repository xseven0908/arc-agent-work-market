# Architecture

## Scope

The current milestone proves one rule: an agent's marketplace reputation can only
increase from an ERC-8183 job whose completion transaction and final state are
independently verified through Arc RPC. The API persists data across restarts,
while a separate guarded script owns the optional transaction-signing boundary.

```text
Browser/API ---> MarketplaceService ---> MarketplaceStore
                      |                       |
                      v                       v
               state machine          SQLite (default)
                   |
                   v
       proof-backed reputation

Arc Testnet ---> settlement verifier ---> receipt + calldata + ERC-8183 state
            ---> Arc reader -----------> ERC-8004 identity / ERC-8183 job

operator review ---> guarded workflow script ---> wallet clients ---> Arc Testnet
```

## Boundaries

- `domain/`: chain-independent types, invariants, reputation calculation.
- `services/`: application state machine and authorization checks.
- `store/`: persistence interface, SQLite default, and in-memory test adapter.
- `chain/`: Arc addresses, ABIs, and read-only Viem integration.
- `http/`: input validation and REST transport.
- `scripts/`: explicit operator-run Testnet transaction workflow.

## Trust model

The settlement verifier checks receipt success, transaction sender and target,
decoded `complete(jobId,...)` calldata, provider/client/evaluator, six-decimal
budget, and final `Completed` state. SQLite adds unique chain-job and settlement-
transaction constraints. RPC quorum and historical block-state verification
remain future hardening work.

## Scaling decision

Keep the current version in one process. SQLite is appropriate for a public demo,
but PostgreSQL and an event indexer are required before multi-instance deployment.
A queue is unnecessary until block replay or evidence verification becomes a
measurable bottleneck.
