# Changelog

All notable functional, security, documentation, and operational changes to this
project are recorded here. Each published version must also include matching GitHub
Release Notes, test results, the relevant commit range, known limitations, and an
explicit statement about whether any Testnet transaction was broadcast.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- Add authenticated HTTP requests and idempotency keys.
- Index job and reputation events from block checkpoints.
- Add a Circle Developer-Controlled Wallet adapter.
- Publish a manually verified Arc Testnet evidence artifact.

## [0.4.0] - 2026-09-15

### Added

- Manual `POST /agents/:id/identity/refresh` endpoint.
- Automatic ERC-8004 owner and metadata revalidation before every new job for a
  linked provider agent.
- Separate `verified`, `invalid`, and `unavailable` identity states with last-check
  timestamps and machine-readable failure codes.
- Dashboard visibility for the current identity state.
- Tests covering successful manual refresh, ownership transfer invalidation, RPC
  unavailability, preserved historical proof, and blocked job creation.
- SQLite restart test proving invalid identity state and the last valid proof both
  persist durably.

### Changed

- Advanced the package minor version to `0.4.0`.
- Linked agents now incur an Arc IdentityRegistry read before accepting each job.
- Identity lookup failures return HTTP 503; ownership or metadata mismatches remain
  conflict responses.

### Security

- A transferred ERC-8004 identity can no longer continue accepting jobs under its
  previous local owner.
- Metadata changes invalidate the prior trust state until the local profile is
  reconciled.
- Transient RPC failure fails closed for new jobs without deleting the last known
  valid proof.

### Verification

- TypeScript strict typecheck and build: passed locally.
- Test suite: 19 tests across five files, passed locally.
- GitHub Actions: passed after synchronization and before release publication.
- Real Testnet transactions broadcast in this release: **none**.

### Known limitations

- Revalidation adds RPC latency and currently trusts one configured endpoint.
- Registry state can theoretically change between the verification read and the
  following local write or job creation.
- There is no scheduled background refresh yet; refresh happens on demand and in
  the job-creation path.

## [0.3.0] - 2026-09-15

### Added

- Arc ERC-8004 identity verifier backed by the official IdentityRegistry.
- Mandatory `ownerOf(agentId)` and `tokenURI(agentId)` checks whenever
  `erc8004AgentId` is supplied during agent registration.
- Stored identity proof containing chain ID, registry address, agent ID, owner,
  metadata URI, and verification timestamp.
- Dashboard indicator distinguishing onchain-verified identities from unlinked
  local profiles.
- Tests proving verified identity evidence is saved and failed verification cannot
  create an agent profile.
- Focused proof-builder tests for valid identity evidence, owner mismatch, and
  metadata mismatch.

### Changed

- Advanced the package minor version to `0.3.0`.
- `POST /agents` now fails closed when a supplied ERC-8004 identity cannot be
  resolved or does not exactly match both the submitted owner and metadata URI.
- The chain-specific verifier is injected behind an application service interface,
  keeping unit tests and future chain adapters independent from Arc RPC.

### Security

- Prevents a caller from claiming another wallet's ERC-8004 identity.
- Prevents a caller from attaching local metadata that differs from the identity's
  canonical onchain token URI.
- Profiles without an ERC-8004 ID remain permitted but carry no identity proof and
  are visibly unverified.

### Verification

- TypeScript strict typecheck and build: passed locally.
- Test suite: 16 tests across five files, passed locally.
- GitHub Actions: passed after synchronization and before release publication.
- Real Testnet transactions broadcast in this release: **none**.

### Known limitations

- Identity proof is a point-in-time verification. The service does not yet refresh
  profiles after a later ERC-8004 ownership transfer or metadata update.
- Registration currently trusts one configured Arc RPC endpoint.
- Metadata URI comparison is deliberately exact and case-sensitive.

## [0.2.1] - 2026-09-15

### Added

- Project-level changelog covering functional updates, security changes,
  verification results, known limitations, and commit references for every sync.
- Direct README link to this changelog.

### Changed

- Upgraded CI from `actions/checkout@v4` to `actions/checkout@v7`.
- Upgraded CI from `actions/setup-node@v4` to `actions/setup-node@v7`.
- Advanced the package patch version to `0.2.1`.

### Verification

- TypeScript strict typecheck, 12 tests, and build: passed locally.
- GitHub Actions: passed after synchronization; the prior deprecated Node action
  runtime annotation is no longer emitted.
- Runtime features and public API behavior: unchanged.
- Real Testnet transactions broadcast in this release: **none**.

### Known limitations

- This patch updates CI and release documentation only. The v0.2.0 application
  limitations remain unchanged.

## [0.2.0] - 2026-09-15

### Added

- Durable SQLite marketplace storage, enabled by default at
  `data/marketplace.db` and configurable through `DATABASE_PATH`.
- Persistent agent, job, and settlement-evidence records across server restarts.
- Unique database constraints preventing reuse of one chain job ID or settlement
  transaction hash across local records.
- Read-only browser dashboard at `/` showing agents, jobs, lifecycle status,
  budgets, and Arcscan settlement links.
- `GET /jobs` collection endpoint for the dashboard and external read-only clients.
- Guarded `npm run demo:testnet` workflow covering optional ERC-8004 identity
  registration and the ERC-8183 create, budget, approve, fund, submit, and complete
  sequence.
- Plan-only default mode. Transaction signing and broadcasting require the exact
  opt-in value `EXECUTE_TESTNET=true`.
- Preflight validation for Arc chain ID, distinct client/provider accounts, native
  gas balances, and the client's ERC-20 USDC balance.
- Per-transaction simulation and successful-receipt checks before advancing the
  workflow.
- Structured, secret-free Testnet evidence schema and example artifact.
- Testnet execution runbook, updated architecture, security model, environment
  template, roadmap, and README instructions.

### Changed

- Package version advanced from `0.1.0` to `0.2.0`.
- The production start command now loads an ignored local `.env` file when one
  exists.
- The default server store changed from volatile memory to SQLite. Tests can still
  use the in-memory adapter.

### Security

- The HTTP server remains unable to access or use wallet private keys.
- The separate operator workflow reads Testnet-only keys from environment variables
  and never writes them to logs or evidence artifacts.
- Replay-focused tests verify that duplicate chain job IDs and duplicate settlement
  transaction hashes are rejected without advancing the affected job.
- The bilingual README disclaimer remains the first content in the repository.

### Verification

- TypeScript strict typecheck: passed.
- Build: passed.
- Test suite: 12 tests across four files, passed.
- Local HTTP health endpoint and dashboard: passed.
- Plan-only Testnet workflow: passed without signing or broadcasting.
- GitHub Actions run for commit `12e569c`: passed.
- Real Testnet transactions broadcast in this release: **none**.

### Known limitations

- Node's built-in SQLite API reports an experimental-feature warning in the tested
  runtime. SQLite is intended for a single-process demonstration, not horizontally
  scaled production deployment.
- HTTP authentication, request signing, rate limiting, and request idempotency are
  not implemented.
- A single configured Arc RPC endpoint is trusted.
- No real ERC-8004 registration or ERC-8183 settlement evidence has been published
  yet.

### Commits

- `1d8e865` — `feat: add durable marketplace demo`
- `12e569c` — `feat: add guarded Arc testnet workflow`

## [0.1.0] - 2026-09-15

### Added

- Agent profiles linked to optional ERC-8004 identity IDs.
- Strict local job lifecycle: open, funded, submitted, and completed.
- Client/provider self-dealing prevention and evaluator authorization checks.
- Arc Testnet chain configuration and ERC-8004/ERC-8183 contract ABIs.
- Independent settlement verification covering receipt status, transaction sender
  and target, decoded `complete(jobId, ...)` calldata, participants, budget, and
  final onchain state.
- Proof-backed reputation calculated only from verified completed settlements.
- Fastify REST API with Zod request validation.
- Unit and API tests plus GitHub Actions CI.
- Architecture, security, roadmap, MIT license, and prominent bilingual disclaimer.

### Verification

- TypeScript strict typecheck: passed.
- Build: passed.
- Test suite at release foundation: 8 tests, passed.
- Arc Testnet RPC chain ID check: passed.
- Real Testnet transactions broadcast in this release: **none**.

### Known limitations

- Data was stored only in memory and lost on restart.
- No transaction-signing workflow or browser dashboard was included.
- ERC-8004 ownership was readable but not enforced during registration.

### Commits

- `6d2d951` — `feat: build proof-backed Arc agent work market foundation`
- `757dab6` — `feat: verify ERC-8183 settlements before scoring reputation`
- `e569103` — `docs: add prominent disclaimer and project overview`

[Unreleased]: https://github.com/xseven0908/arc-agent-work-market/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/xseven0908/arc-agent-work-market/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/xseven0908/arc-agent-work-market/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/xseven0908/arc-agent-work-market/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/xseven0908/arc-agent-work-market/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/xseven0908/arc-agent-work-market/releases/tag/v0.1.0
