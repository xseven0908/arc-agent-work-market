# Security model

This project targets Arc Testnet and is not production-ready.

## Protected invariants

- A job cannot skip lifecycle states.
- A client cannot hire an agent controlled by the same address.
- Only the configured evaluator can complete a submitted job.
- A reputation entry requires a completed job, Arc Testnet proof metadata, and a
  chain job ID matching the local job.
- SQLite rejects reuse of a chain job ID or settlement transaction across records.
- USDC amounts use the ERC-20 representation with six decimal places.
- Testnet transaction broadcasting requires an explicit `EXECUTE_TESTNET=true`.

## Known gaps

- SQLite cannot safely coordinate a horizontally scaled API deployment.
- HTTP authentication, request signatures, rate limits, and replay protection are not implemented.
- ERC-8004 ownership is readable but not yet required during agent registration.
- A single configured RPC is trusted; RPC quorum is not implemented.
- The API does not hold keys or submit transactions. The separate operator script
  accepts environment-provided Testnet keys and must not run on an exposed server.

Never commit private keys, Circle API keys, entity secrets, recovery files, or
wallet credentials. Use testnet-only wallets while this warning remains.
