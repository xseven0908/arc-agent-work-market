# Architecture

## Scope

The first milestone proves one rule: an agent's marketplace reputation can only
increase from an ERC-8183 job with Arc Testnet settlement evidence. The API does
not yet broadcast transactions or persist data across restarts.

```text
REST API ---> MarketplaceService ---> MarketplaceStore
                   |                       |
                   v                       v
            state machine             in-memory MVP
                   |
                   v
       proof-backed reputation

Arc Testnet ---> Arc reader ---> ERC-8004 identity / ERC-8183 job
```

## Boundaries

- `domain/`: chain-independent types, invariants, reputation calculation.
- `services/`: application state machine and authorization checks.
- `store/`: persistence interface; in-memory adapter for milestone 1.
- `chain/`: Arc addresses, ABIs, and read-only Viem integration.
- `http/`: input validation and REST transport.

## Trust model

The API accepts a settlement transaction hash in milestone 1, but does not yet
verify its receipt. Therefore the output is a domain-level proof candidate, not
production-grade proof. Milestone 2 must fetch the receipt, verify chain ID,
contract address, `Completed` event, evaluator, provider, job ID, and final state
before storing it.

## Scaling decision

Keep the first version in one process. Add PostgreSQL and an event indexer before
multi-instance deployment. A queue is unnecessary until block replay or evidence
verification becomes a measurable bottleneck.
