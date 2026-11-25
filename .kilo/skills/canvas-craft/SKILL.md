---
name: canvas-craft
description: Build and polish crisp, responsive, high-DPI HTML5 Canvas simulations with setupHiDPI(), ResizeObserver, clamped delta time, and rock-solid math. Use when creating, debugging, or upgrading Canvas circuits, logic/signal displays, CPU thermal sims, or 2D neural network plots.
---

# Canvas Craft Checklist

1. **High-DPI & ResizeObserver Lifecycle**
   - Always scale every `<canvas>` via `setupHiDPI()` and pair it with `ResizeObserver` so resizing updates dimensions cleanly without stale backing stores or duplicate observers.
   - Keep simulation state intact across resizes.

2. **Frame Timing & Numerical Safety**
   - Run animations via `requestAnimationFrame` with clamped frame delta time (`dt`, e.g., `Math.min(dt, 0.05)`), and pause or cancel offscreen loops.
   - Guard electrical, logic, thermal/clock, and neural network math against `NaN`, `Infinity`, division by zero, or empty datasets.

3. **Tactile Visual Feedback**
   - Make state changes immediately readable at a glance (current drift speed/glow, resistor heat tint, active signal pulses, thermal throttling cues, and neural decision contours).
   - Keep per-frame drawing lightweight so frame rates stay smooth across desktop and mobile.
