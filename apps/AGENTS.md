# Apps Contributor Notes

Scope: `apps/*`.

## Overview

`apps/` contains standalone app surfaces (currently website) that should stay decoupled from desktop/runtime internals unless explicitly required.

## Conventions

- Keep app-specific framework conventions local.
- Avoid pulling provider/engine internals into app-layer code.
- Treat app build and deployment scripts as app-owned, not desktop-owned.

## Anti-Patterns

- Sharing desktop process assumptions in web app code.
- Duplicating package logic instead of importing from maintained packages.
