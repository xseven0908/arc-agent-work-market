# Security model

This project targets Arc Testnet and is not production-ready.

## Protected invariants

- A job cannot skip lifecycle states.
- A client cannot hire an agent controlled by the same address.
- Only the configured evaluator can complete a submitted job.
- A reputation entry requires a completed job, Arc Testnet proof metadata, and a
  chain job ID matching the local job.
- USDC amounts use the ERC-20 representation with six decimal places.

## Known gaps

- Settlement receipts are not yet independently verified against Arc RPC.
- The in-memory store loses data on restart and cannot coordinate multiple API instances.
- HTTP authentication, request signatures, rate limits, and replay protection are not implemented.
- ERC-8004 ownership is readable but not yet required during agent registration.
- The marketplace does not hold keys or submit transactions.

Never commit private keys, Circle API keys, entity secrets, recovery files, or
wallet credentials. Use testnet-only wallets while this warning remains.
