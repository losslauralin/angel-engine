# `@angel-engine/js-client` Notes

Scope: `packages/js-client/`.

## Overview

Protocol-neutral JavaScript client surface and utilities for consumers like desktop and provider-specific packages.

## Where To Look

| Task                   | Location                                  | Notes                                           |
| ---------------------- | ----------------------------------------- | ----------------------------------------------- |
| Public API + exports   | `src/index.ts` and `package.json` exports | Avoid accidental surface changes                |
| Projection helpers     | `src/projection.ts`                       | Keep aligned with NAPI snapshot semantics       |
| Shared utility modules | `src/utils/*`                             | Reused broadly; changes have large blast radius |
| Tests                  | `src/**/__tests__`                        | Keep colocated and behavior-focused             |

## Conventions

- Preserve protocol-neutral behavior in shared utils.
- Keep package exports and typing stable across ESM/CJS targets.
- Favor precise typed fields and direct property access.
- Update tests when utility semantics change.

## Anti-Patterns

- Encoding provider-specific behavior in shared neutral utilities.
- Silent fallback defaults for malformed payload shapes.
- Untracked changes to export-map paths.
