# Styling

## Approach

Global styles in `src/styles/global.css`, imported in `src/layouts/Layout.astro`.
Wherever possible - ALL sizes/spaces/etc. should use or respect those.
Component-specific styles in scoped `<style>` blocks within `.astro` files.

## Design Principles

**Mobile-first, grid-based, F-pattern**
- Design for mobile column first
- Scale up with CSS Grid/Flexbox
- 8px strict grid system

**Accessibility: WCAG 2.2 AA**
- Keyboard navigable
- Visible focus states
- Proper semantics
- Good contrast
- No tiny touch targets

**Performance targets**
- LCP < 2.5s
- INP < 200ms
- CLS < 0.1
- Inline critical CSS
- Optimize images aggressively

**Progressive enhancement**
- Semantic HTML first
- Light CSS second
- Usable without JS

## Design Tokens (Coded in global.css)

### Grid & Spacing
```css
--grid-base: 8px
--space-1: 8px
--space-2: 16px
--space-3: 24px
```

### Typography
```css
--font-family: ui-monospace, "DejaVu Sans Mono", ...
--font-size-h1: 2.5rem
--font-size-h2: 1.625rem
--font-size-body: 1rem
--line-height-heading: 1.2
--line-height-body: 1.5
--max-width-text: 75ch
```

### Colors
```css
--background         /* page background */
--surface            /* raised elements (cards, dropdowns, inputs) */
--accent             /* links, CTAs, focus states */
--error              /* error states */
--neutral-light      /* subtle borders, dividers */
--neutral-mid        /* secondary text */
--neutral-dark       /* main text */

/* semantic aliases */
--text-primary       /* → neutral-dark */
--text-muted         /* → neutral-mid */
--border-subtle      /* → neutral-light */
```

**Color usage:**
- Use semantic aliases for text (`--text-primary`, `--text-muted`) and borders (`--border-subtle`)
- Accent: links, primary CTAs, focus states
- Error: error/destructive states

## Usage Examples

### Spacing
```css
padding: var(--space-2);
gap: var(--space-1);
```

### Typography
```css
font-size: var(--font-size-h2);
line-height: var(--line-height-body);
max-width: var(--max-width-text);
```

### Layout
```astro
<div class="container">Content</div>

<style>
  .container {
    padding: var(--space-2);
    background: var(--surface);
    color: var(--text-primary);
    border: 1px solid var(--border-subtle);
    max-width: var(--max-width-text);
  }
</style>
```

### Links and CTAs
Links automatically use `var(--accent)` per global styles.

## Modifying Design Tokens

Edit `src/styles/global.css` `:root` section to change values site-wide.
