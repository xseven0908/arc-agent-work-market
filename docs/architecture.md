# Architecture

## Scope

The current milestone proves one rule: an agent's marketplace reputation can only
increase from an ERC-8183 job whose completion transaction and final state are
independently verified through Arc RPC. The API does not yet broadcast
transactions or persist data across restarts.

```text
REST API ---> MarketplaceService ---> MarketplaceStore
                   |                       |
                   v                       v
            state machine             in-memory MVP
                   |
                   v
       proof-backed reputation

Arc Testnet ---> settlement verifier ---> receipt + calldata + ERC-8183 state
            ---> Arc reader -----------> ERC-8004 identity / ERC-8183 job
```

## Boundaries

- `domain/`: chain-independent types, invariants, reputation calculation.
- `services/`: application state machine and authorization checks.
- `store/`: persistence interface; in-memory adapter for milestone 1.
- `chain/`: Arc addresses, ABIs, and read-only Viem integration.
- `http/`: input validation and REST transport.

## Trust model

The settlement verifier checks receipt success, transaction sender and target,
decoded `complete(jobId,...)` calldata, provider/client/evaluator, six-decimal
budget, and final `Completed` state. Persistent evidence storage, RPC quorum, and
historical block-state verification remain future hardening work.

## Scaling decision

Keep the first version in one process. Add PostgreSQL and an event indexer before
multi-instance deployment. A queue is unnecessary until block replay or evidence
verification becomes a measurable bottleneck.
