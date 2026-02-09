# Build

Build/develop docs for this Astro site.

## Stack

- Astro `5.x`
- TypeScript (`astro/tsconfigs/strict`)
- Package manager: `pnpm`
- Image pipeline dependency: `sharp`

## Prereqs

- Node.js `20+` (Node `22` tested locally)
- `pnpm`

## Install

```bash
pnpm install
```

## Commands

From repo root:

```bash
pnpm dev
```

- Starts local dev server (default `http://localhost:4321`)

```bash
pnpm build
```

- Production build to `dist/`
- Generates static routes + optimized images

```bash
pnpm preview
```

- Serves built output locally for final check

## Build Output

- Output mode: static
- Build directory: `dist/`

## Common Failure: Missing Sharp

Error:

```text
MissingSharp: Could not find Sharp.
```

Fix:

```bash
pnpm add sharp
```

Then rerun:

```bash
pnpm build
```

## Content/Image Notes

- Content images should live in `src/assets`
- MDX content can use `astro:assets` (`Picture`)
- `sharp` is required for Astro default image optimization
