# `test-cli` Crate Notes

Scope: `crates/test-cli/`.

## Overview

`test-cli` provides support utilities for tests and verification workflows.

## Conventions

- Keep this crate as a consumer/helper of public APIs.
- Prefer reusable test helpers over embedding production behavior.
- Isolate test scaffolding from adapter/engine internals where possible.

## Anti-Patterns

- Adding production runtime policy here.
- Depending on undocumented internal fields from other crates.
