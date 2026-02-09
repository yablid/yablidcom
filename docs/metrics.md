# Metrics

Footer popup shows lightweight runtime perf metrics for current page load.

## Current Metrics

- `TTFB` (Time to First Byte)
  - Source: `performance.getEntriesByType('navigation')[0].responseStart`
  - Meaning: request+server+network time until first byte returns.
- `LCP` (Largest Contentful Paint)
  - Source: `PerformanceObserver` with `largest-contentful-paint`
  - Meaning: when main visible content finished rendering.
- `INP` (Interaction to Next Paint)
  - Source: `PerformanceObserver` with `event` entries, max `entry.duration`
  - Meaning: worst interaction latency observed so far on this page.
- `CLS` (Cumulative Layout Shift)
  - Source: `PerformanceObserver` with `layout-shift`, sum values where `hadRecentInput === false`
  - Meaning: visual instability (layout jumps).

## Thresholds Used

- `TTFB`: good <= 800ms, needs work <= 1800ms
- `LCP`: good <= 2500ms, needs work <= 4000ms
- `INP`: good <= 200ms, needs work <= 500ms
- `CLS`: good <= 0.1, needs work <= 0.25

## Where It Lives

- UI + collection logic: `src/components/Footer.astro`
- Trigger interaction element for INP: `Interaction` button in metrics row

## Accuracy + Known Limits

These values are useful and directionally correct, but not lab-grade or analytics-grade.

- Not RUM aggregated:
  - single-user, single-load view only
  - no percentile reporting (p75, p95)
- Browser support variance:
  - `event` entries for INP differ across browsers/versions
- INP is approximate:
  - takes max observed interaction duration in-session
  - official INP in reporting tools may differ
- CLS can differ from CrUX/PageSpeed:
  - current code sums all qualifying shifts; official scoring uses session windows
- LCP finalization nuances:
  - LCP can update until page hidden; popup shows latest observed while page open
- Environment noise:
  - devtools open, CPU load, network variance, extensions, cache state all skew values

## Accuracy Check (Current)

- `TTFB` and `LCP` are generally solid for quick on-page checks.
- `INP` is approximate in current implementation:
  - uses max observed event duration in this session
  - CrUX/PageSpeed values can differ
- `CLS` may be overstated vs official Web Vitals:
  - current code sums qualifying shifts
  - official scoring uses session-window logic
- Values are local/runtime-sensitive:
  - device load, network, extensions, cache, devtools

## Potential Error Areas

- Browser support/behavior differences for event timing (`INP` path).
- Lifecycle timing nuances:
  - `LCP` and `INP` can finalize later than first display in popup.

## Production TODO

- Verify production parity:
  - confirm metrics match hosting/runtime reality (CDN, edge, cache headers, compression, image pipeline)
  - validate values against Lighthouse + PageSpeed + CrUX for same URL/build
- Tighten metric semantics:
  - consider `web-vitals` package for closer standards alignment (`INP` + `CLS` session-window behavior)
  - decide whether footer popup remains “debug-only” or “user-facing”
- Add observability beyond single session:
  - send metrics to backend/analytics endpoint
  - store/track p75 over time by route/device/network class
  - alert on regression thresholds
- Re-evaluate metric set at launch:
  - keep minimal set or add higher-level telemetry (error rate, availability, cache hit rate, backend timing breakdown)

## How To Interpret

- Use popup metrics for quick on-page sanity checks.
- Use Lighthouse/PageSpeed/CrUX for release gating and long-term trend decisions.
