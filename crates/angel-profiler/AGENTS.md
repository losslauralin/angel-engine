# `angel-profiler` Crate Notes

Scope: `crates/angel-profiler/`.

## Overview

Profiler crate consumes public engine-client APIs to record runtime timing and produce reports.

## Where To Look

| Task               | Location                          | Notes                                   |
| ------------------ | --------------------------------- | --------------------------------------- |
| Profiling flow     | `src/`                            | Keep as consumer of stable APIs         |
| CLI/report surface | crate binaries and report modules | Avoid coupling to internal engine state |

## Conventions

- Depend on public crate interfaces only.
- Keep instrumentation/reporting concerns separate from runtime behavior logic.
- Prefer additive telemetry fields over breaking schema changes.

## Anti-Patterns

- Moving core engine/client behavior into profiler crate.
- Accessing provider wire assumptions directly from profiler code.
