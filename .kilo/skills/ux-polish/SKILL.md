---
name: ux-polish
description: Polish interactive web UI with tactile controls, .tabular-nums numeric readouts, zero horizontal overflow across 320px-1440px+, and subtle Web Audio micro-feedback. Use during UI/UX polish passes, layout refinements, or micro-interaction upgrades.
---

# UX Polish Checklist

1. **Tactile Controls & Focus States**
   - Give sliders, switches, presets, and buttons snappy hover, active/pressed feedback, and clear `:focus-visible` keyboard outlines without blocking smooth scrolling or frame rates.
   - Keep active/selected states unmistakable with strong contrast.

2. **Tabular Readouts & Layout Integrity**
   - Enforce `font-variant-numeric: tabular-nums` and `font-feature-settings: 'tnum'` with `.tabular-nums` on all changing readouts, outputs, and counters.
   - Keep `overflow-x: hidden` on `body`, preserve the fixed right sticky rail with `padding-left: var(--rail-width)` on `main` without overlapping controls, and ensure zero horizontal scrollbars from `320px` to `1440px+`.

3. **Optional Web Audio Micro-Feedback**
   - When adding synthesized Web Audio clicks or soft tones, lazily initialize or resume `AudioContext` on user interaction, keep volume subtle and brief, and respect the mute toggle without throwing errors.
