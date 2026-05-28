# Crates Contributor Notes

Scope: `crates/*` only. Follow root `AGENTS.md` for global architecture and release gates.

## Overview

Rust crates are split by responsibility: protocol-neutral engine, provider adapters, client ergonomics, N-API bridge, and test/profiler consumers.

## Where To Look

| Task                                | Location                          | Notes                       |
| ----------------------------------- | --------------------------------- | --------------------------- |
| Engine state or reducer behavior    | `crates/angel-engine`             | Must stay protocol-neutral  |
| Provider wire parsing/normalization | `crates/angel-provider`           | Codex/ACP quirks live here  |
| Runtime process IO and snapshots    | `crates/angel-engine-client`      | Client primitives only      |
| Node bridge and TS type export      | `crates/angel-engine-client-napi` | Thin binding layer          |
| Profiling runtime behavior          | `crates/angel-profiler`           | Observability tooling       |
| Shared test helpers                 | `crates/test-cli`                 | Consumer-only support crate |

## Conventions

- Keep provider-specific wire semantics out of `angel-engine` and `angel-engine-client`.
- Use typed enums for closed protocol value sets; fail fast on unknown values.
- Do not backfill malformed input with silent defaults unless adapter-normalizing a documented provider quirk.
- Keep public APIs precise; avoid catch-all internal shapes.
- Prefer small targeted tests near changed behavior.

## Anti-Patterns

- Adding Codex/ACP-specific conditionals in engine reducers/state.
- Re-implementing adapter parsing logic inside client/NAPI layers.
- Treating `test-cli` as production behavior surface.
- Expanding NAPI crate with desktop policy or projection behavior.

## Commands

```sh
cargo test --workspace --all-targets
cargo fmt --all --check
```
