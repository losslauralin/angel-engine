# `apps/website` Notes

Scope: `apps/website/`.

## Overview

Next.js site for docs/marketing content. Keep this app independent from desktop runtime orchestration details.

## Where To Look

| Task          | Location                              | Notes                        |
| ------------- | ------------------------------------- | ---------------------------- |
| Routes/pages  | `src/app`                             | App Router conventions       |
| Static assets | `public/`                             | Site-only assets             |
| SEO metadata  | route metadata + sitemap/robots files | Keep consistent and explicit |

## Conventions

- Use Next.js app-router patterns for routing and metadata.
- Keep dependencies and scripts local to website use-cases.
- Prefer importing shared UI/util helpers from maintained packages over duplicating logic.

## Anti-Patterns

- Pulling Electron or N-API dependencies into website code.
- Embedding provider runtime behavior in marketing/docs pages.
