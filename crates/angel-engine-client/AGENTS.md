# `angel-engine-client` Crate Notes

Scope: `crates/angel-engine-client/` only.

## Overview

This crate exposes ergonomic runtime/session primitives on top of engine + provider layers without re-parsing provider wire payloads.

## Where To Look

| Task                         | Location                             | Notes                       |
| ---------------------------- | ------------------------------------ | --------------------------- |
| Session lifecycle/runtime IO | `src/session.rs` and runtime modules | Keep orchestration here     |
| Snapshot/thread helpers      | `src/` client-facing modules         | Preserve API consistency    |
| Integration behavior         | `tests/`                             | Cover cross-layer workflows |

## Conventions

- Treat adapters as source of protocol normalization truth.
- Expose stable primitives (`model_list`, modes, reasoning levels, settings).
- Keep state snapshots protocol-neutral and desktop-friendly.
- Prefer explicit typed APIs over unstructured maps.

## Anti-Patterns

- Parsing provider-specific JSON in this layer.
- Reintroducing desktop projection policy inside Rust client APIs.
- Shadowing adapter normalization with local heuristics.

## Commands

```sh
cargo test -p angel-engine-client
```
