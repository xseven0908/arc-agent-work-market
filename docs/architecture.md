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
            ---> identity verifier -----> ERC-8004 ownerOf + tokenURI
            ---> Arc reader ------------> ERC-8004 identity / ERC-8183 job

operator review ---> guarded workflow script ---> wallet clients ---> Arc Testnet
public evidence ---> schema validator ---> onchain verifier ---> Arc Testnet
Arc Testnet ---> chunked event reader ---> atomic checkpoint + event rows
```

## Boundaries

- `domain/`: chain-independent types, invariants, reputation calculation.
- `services/`: application state machine and authorization checks.
- `store/`: persistence interface, SQLite default, and in-memory test adapter.
- `chain/`: Arc addresses, ABIs, and read-only Viem integration.
- `http/`: input validation and REST transport.
- `scripts/`: explicit operator-run Testnet transaction workflow.
- `evidence/`: versioned public artifact schema and independent chain verifier.
- `indexer/`: bounded event-range orchestration and resumable checkpoints.

## Trust model

The identity verifier fails closed when an ERC-8004 ID is supplied: both the owner
address and case-sensitive metadata URI must match current IdentityRegistry state.
The resulting proof records the Arc chain ID, registry address, canonical identity
fields, and verification timestamp.

The service repeats this verification before every new job for a linked agent and
through an explicit refresh endpoint. Ownership or metadata mismatch changes the
profile status to `invalid`; lookup failure changes it to `unavailable`. Both states
block new jobs. The last successful proof remains stored as historical evidence.

The settlement verifier checks receipt success, transaction sender and target,
decoded `complete(jobId,...)` calldata, provider/client/evaluator, six-decimal
budget, and final `Completed` state. SQLite adds unique chain-job and settlement-
transaction constraints. RPC quorum and historical block-state verification
remain future hardening work.

## Scaling decision

Keep the current version in one process. SQLite is appropriate for a public demo,
and the event indexer writes every completed chunk and checkpoint in one database
transaction. PostgreSQL plus a single elected indexer worker are required before
multi-instance deployment. A queue is unnecessary until block replay or evidence
verification becomes a measurable bottleneck.
