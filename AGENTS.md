# Project Rules — Inside a Machine: From Electron to AI

## Stack, Cost & Dependencies
- Pure HTML, CSS, and vanilla JavaScript only. Zero backend, zero build steps/bundlers, zero paid dependencies, zero npm packages.
- Always use ** / free** models and endpoints; never add paid services or external assets that require paid accounts.
- No hardcoded API keys or secrets in frontend or committed files.

## Canvas & Rendering
- Enforce high-DPI (devicePixelRatio) canvas scaling on every `<canvas>` via `setupHiDPI()`.
- Always pair `setupHiDPI()` with `ResizeObserver` for resize cleanup; never leave stale canvas backing stores.
- Keep all canvas animation loops smooth via `requestAnimationFrame`; clamp frame delta time (`dt`, e.g., `Math.min(dt, 0.05)`) and pause or cancel loops when offscreen.
- Guard simulation physics, electrical/logic math, clock/thermal curves, and neural network training against `NaN`, `Infinity`, division by zero, or empty inputs.

## Typography & Readouts
- Enforce `font-variant-numeric: tabular-nums` (and `font-feature-settings: 'tnum'`) on all live numeric readouts so values never jitter as sliders move.
- Use `.tabular-nums` class on every `<output>`, `<span>`, or element displaying changing numbers.

## Layout, Tactile UI & Overflow
- Prevent horizontal overflow across desktop and mobile viewports (`overflow-x: hidden` on body, no fixed-width elements exceeding viewport).
- Keep the sticky chapter rail fixed at `right: 0` with `padding-left: var(--rail-width)` on `main` without overlapping key controls.
- Ensure tactile micro-interactions (sliders, switches, presets, buttons) have responsive hover/active/pressed states and clear `:focus-visible` keyboard focus indicators without blocking smooth scrolling or frame rates.
- Test at 320px–1440px+ widths; no horizontal scrollbars.

## Scope & Process
- Keep changes small, clean, and scoped to the active pass. Do not edit unrelated files.
- Do not edit `index.html`, `styles.css`, or `app.js` unless the current pass explicitly targets them.
- After code changes, verify syntax/build (`node --check` for JS, HTML tag balance) and suggest a concise Git commit message.
- Do not leave temporary, scratch, or broken files in the repository root.
- When asked to build or update a feature and ship it, stage (`git add .`), commit with a clear message, and push to `origin main`.

## Deployment
- Keep static web files (HTML, CSS, JS, assets) clean and well-structured for Cloudflare Pages deployment (`directory: .`).
