# `@angel-engine/claude-client` Notes

Scope: `packages/claude-client/`.

## Overview

Provider-focused TypeScript package for Claude runtime/session integration built on shared JS client abstractions.

## Where To Look

| Task                   | Location                       | Notes                               |
| ---------------------- | ------------------------------ | ----------------------------------- |
| Adapter behavior       | `src/` adapter/runtime modules | Keep provider-specific logic here   |
| Public package surface | `src/index.ts` and exports     | Preserve module contract            |
| Tests                  | `src/__tests__`                | Cover provider behavior regressions |

## Conventions

- Keep provider-specific logic local to this package.
- Maintain build outputs for both import/require consumers.
- Reuse shared neutral helpers from `@angel-engine/js-client` where appropriate.
- Prefer explicit discriminated unions and typed payloads.

## Anti-Patterns

- Moving provider quirks into shared packages or desktop projection code.
- Introducing loose JSON catch-all types for core client interfaces.
