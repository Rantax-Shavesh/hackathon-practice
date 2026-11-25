/**
 * Inside a Machine: From Electron to AI — App Module
 * Modular simulation engines for Chapter 1 (Electrons & Voltage) and Chapter 2 (Logic Gates & Adder)
 * Pass 2: High-craft UI/UX, tactile micro-interactions, visual juice, Web Audio feedback
 * Designed for extensibility: Chapters 3–5 can be added by registering new simulation modules.
 */

// ==========================================================================
// Utility Functions
// ==========================================================================

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (min, max) => Math.random() * (max - min) + min;

function setupHiDPI(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  return { ctx, width: rect.width, height: rect.height, dpr };
}

function onResize(canvas, callback) {
  const ro = new ResizeObserver(() => {
    const { ctx, width, height, dpr } = setupHiDPI(canvas);
    callback(ctx, width, height, dpr);
  });
  ro.observe(canvas);
  return () => ro.disconnect();
}

// ==========================================================================
// Web Audio API — Micro-feedback sound engine
// ==========================================================================

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.initPromise = null;
  }

  ensure() {
    if (this.ctx) return Promise.resolve();
    if (!this.initPromise) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return Promise.reject(new Error('No AudioContext'));
      this.initPromise = new Ctx().then(c => { this.ctx = c; }).catch(() => {});
    }
    return this.initPromise;
  }

  async start() {
    try {
      await this.ensure();
      if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
    } catch (e) { /* audio not available */ }
  }

  setEnabled(on) {
    this.enabled = on;
  }

  // Short switch click
  click() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + 0.05);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  // Soft feedback tone on interaction
  tone(freq = 600, type = 'sine', duration = 0.1, vol = 0.05) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  // Rising chime for high signal
  chime() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + i * 0.04);
      gain.gain.setValueAtTime(0.03, t + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + i * 0.04);
      osc.stop(t + i * 0.04 + 0.15);
    });
  }
}

const sound = new SoundEngine();

// ==========================================================================
// Chapter 1: Electrons & Voltage — Circuit Simulation
// ==========================================================================

class CircuitSim {
  constructor(canvas) {
    this.canvas = canvas;
    this.setupCanvas();
    this.setupState();
    this.bindControls();
    this.animate();
  }

  setupCanvas() {
    const { ctx, width, height, dpr } = setupHiDPI(this.canvas);
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    onResize(this.canvas, (ctx, w, h, dpr) => {
      this.ctx = ctx;
      this.width = w;
      this.height = h;
      this.dpr = dpr;
      this.layoutComponents();
    });
  }

  setupState() {
    this.voltage = 5;
    this.resistance = 100;
    this.switchOn = true;
    this.time = 0;
    this.electrons = [];
    this.maxElectrons = 60;
    this.layoutComponents();
    this.spawnElectrons();
  }

  layoutComponents() {
    const w = this.width, h = this.height;
    const cx = w / 2, cy = h / 2;
    const spacing = Math.min(w, h) * 0.28;

    this.battery = {
      x: cx - spacing * 1.5, y: cy,
      w: 50, h: 80,
      cx: cx - spacing * 1.5, cy: cy
    };

    this.switch = {
      x: cx - spacing * 0.5, y: cy - spacing,
      w: 60, h: 30,
      cx: cx - spacing * 0.5 + 30, cy: cy - spacing + 15
    };

    this.resistor = {
      x: cx + spacing * 0.5, y: cy,
      w: 50, h: 80,
      cx: cx + spacing * 0.5 + 25, cy: cy
    };

    this.wirePaths = [
      { start: { x: this.battery.x + this.battery.w/2, y: this.battery.y }, end: { x: this.switch.x, y: this.switch.y + this.switch.h/2 } },
      { start: { x: this.switch.x + this.switch.w, y: this.switch.y + this.switch.h/2 }, end: { x: this.resistor.x, y: this.resistor.y } },
      { start: { x: this.resistor.x + this.resistor.w/2, y: this.resistor.y + this.resistor.h }, end: { x: this.battery.x + this.battery.w/2, y: this.battery.y + this.battery.h } }
    ];
  }

  spawnElectrons() {
    this.electrons = [];
    for (let i = 0; i < this.maxElectrons; i++) {
      this.electrons.push(this.createElectron(i));
    }
  }

  createElectron(index) {
    const pathIndex = Math.floor(Math.random() * this.wirePaths.length);
    const path = this.wirePaths[pathIndex];
    const t = Math.random();
    return {
      pathIndex,
      t,
      baseSpeed: 0.0008,
      offset: rand(-3, 3),
      phase: rand(0, Math.PI * 2),
      size: rand(2.5, 4),
      glow: rand(0.5, 1.5)
    };
  }

  getCurrent() {
    if (!this.switchOn) return 0;
    return this.voltage / this.resistance;
  }

  getPower() {
    const i = this.getCurrent();
    return this.voltage * i;
  }

  getDriftSpeed() {
    const currentMA = this.getCurrent() * 1000;
    return clamp(currentMA * 0.00015, 0, 0.02);
  }

  updateElectrons(dt) {
    const driftSpeed = this.getDriftSpeed();
    if (driftSpeed === 0) return;

    for (const e of this.electrons) {
      const path = this.wirePaths[e.pathIndex];
      const speed = driftSpeed * e.baseSpeed * (0.8 + 0.4 * Math.sin(this.time * 2 + e.phase));
      e.t += speed * dt * 60;

      if (e.t >= 1) {
        e.t = 0;
        e.pathIndex = (e.pathIndex + 1) % this.wirePaths.length;
      }
    }
  }

  getElectronPos(e) {
    const path = this.wirePaths[e.pathIndex];
    const sx = path.start.x, sy = path.start.y;
    const ex = path.end.x, ey = path.end.y;

    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2 - 30 * Math.sign(sy - ey);

    const t = e.t;
    const invT = 1 - t;
    const x = invT * invT * sx + 2 * invT * t * mx + t * t * ex;
    const y = invT * invT * sy + 2 * invT * t * my + t * t * ey;

    return { x: x + e.offset, y: y };
  }

  bindControls() {
    const voltageSlider = $('#ch1-voltage');
    const voltageVal = $('#ch1-voltage-val');
    const resistanceSlider = $('#ch1-resistance');
    const resistanceVal = $('#ch1-resistance-val');
    const switchInput = $('#ch1-switch');
    const switchState = $('#ch1-switch-state');
    const currentOut = $('#ch1-current');
    const powerOut = $('#ch1-power');

    voltageSlider.addEventListener('input', () => {
      this.voltage = parseFloat(voltageSlider.value);
      voltageVal.textContent = this.voltage.toFixed(1) + ' V';
      this.updateReadouts(currentOut, powerOut);
      sound.tone(400 + this.voltage * 20, 'sine', 0.03, 0.03);
    });

    resistanceSlider.addEventListener('input', () => {
      this.resistance = parseInt(resistanceSlider.value, 10);
      resistanceVal.textContent = this.resistance + ' Ω';
      this.updateReadouts(currentOut, powerOut);
      sound.tone(800 - this.resistance * 0.5, 'sine', 0.03, 0.02);
    });

    switchInput.addEventListener('change', () => {
      const wasOn = this.switchOn;
      this.switchOn = switchInput.checked;
      switchState.textContent = this.switchOn ? 'ON' : 'OFF';
      this.updateReadouts(currentOut, powerOut);
      if (this.switchOn !== wasOn) {
        sound.click();
        if (this.switchOn) sound.chime();
      }
    });

    this.currentOut = currentOut;
    this.powerOut = powerOut;
    this.updateReadouts(currentOut, powerOut);
  }

  updateReadouts(currentOut, powerOut) {
    const current = this.getCurrent() * 1000;
    const power = this.getPower() * 1000;
    currentOut.textContent = current.toFixed(1) + ' mA';
    powerOut.textContent = power.toFixed(1) + ' mW';
  }

  draw() {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    this.drawWires();
    this.drawBattery();
    this.drawSwitch();
    this.drawResistor();

    if (this.switchOn) {
      this.drawElectrons();
      this.drawCurrentArrows();
    }
  }

  drawWires() {
    const { ctx } = this;
    const currentMA = this.getCurrent() * 1000;
    const active = this.switchOn && currentMA > 0;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const path of this.wirePaths) {
      const mx = (path.start.x + path.end.x) / 2;
      const my = (path.start.y + path.end.y) / 2 - 30 * Math.sign(path.start.y - path.end.y);

      // Base wire
      ctx.strokeStyle = '#232a36';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(path.start.x, path.start.y);
      ctx.quadraticCurveTo(mx, my, path.end.x, path.end.y);
      ctx.stroke();

      // Active glow
      if (active) {
        ctx.shadowColor = 'rgba(0, 212, 170, 0.35)';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = 'rgba(0, 212, 170, 0.5)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(path.start.x, path.start.y);
        ctx.quadraticCurveTo(mx, my, path.end.x, path.end.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }

  drawBattery() {
    const { ctx } = this;
    const b = this.battery;

    ctx.fillStyle = '#161c26';
    ctx.strokeStyle = '#333e4d';
    ctx.lineWidth = 2;
    this.roundRect(ctx, b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ff6b6b';
    this.roundRect(ctx, b.x + b.w/2 - 8, b.y - 8, 16, 10, 3);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', b.x + b.w/2, b.y - 3);

    ctx.fillStyle = '#4da6ff';
    this.roundRect(ctx, b.x + b.w/2 - 8, b.y + b.h - 2, 16, 10, 3);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('−', b.x + b.w/2, b.y + b.h + 3);

    ctx.fillStyle = '#8c96a4';
    ctx.font = '11px monospace';
    ctx.fillText(`${this.voltage.toFixed(1)}V`, b.x + b.w/2, b.y + b.h/2 + 4);
  }

  drawSwitch() {
    const { ctx } = this;
    const s = this.switch;
    const on = this.switchOn;

    ctx.fillStyle = '#161c26';
    ctx.strokeStyle = '#333e4d';
    ctx.lineWidth = 2;
    this.roundRect(ctx, s.x, s.y, s.w, s.h, 6);
    ctx.fill();
    ctx.stroke();

    const leverX = on ? s.x + s.w - 18 : s.x + 18;
    const leverY = s.y + s.h/2;

    ctx.fillStyle = on ? '#00d4aa' : '#5c6674';
    ctx.beginPath();
    ctx.arc(leverX, leverY, 14, 0, Math.PI * 2);
    ctx.fill();

    if (on) {
      ctx.shadowColor = 'rgba(0, 212, 170, 0.5)';
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = on ? '#00ffc8' : '#aaa';
    ctx.beginPath();
    ctx.arc(leverX, leverY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#8c96a4';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(on ? 'CLOSED' : 'OPEN', s.x + s.w/2, s.y - 8);
  }

  drawResistor() {
    const { ctx } = this;
    const r = this.resistor;
    const power = this.getPower() * 1000;
    const maxPower = 12 * 12 / 10 * 1000;
    const heatRatio = clamp(power / maxPower, 0, 1);

    // Thermal color transition: dark → orange → red → white-hot
    let bodyColor;
    if (heatRatio < 0.33) {
      bodyColor = this.interpolateColor('#161c26', '#ff8c00', heatRatio / 0.33);
    } else if (heatRatio < 0.66) {
      bodyColor = this.interpolateColor('#ff8c00', '#ff3333', (heatRatio - 0.33) / 0.33);
    } else {
      bodyColor = this.interpolateColor('#ff3333', '#ffffff', (heatRatio - 0.66) / 0.34);
    }

    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = '#333e4d';
    ctx.lineWidth = 2;
    this.roundRect(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.fill();
    ctx.stroke();

    // Resistor zigzag
    ctx.strokeStyle = '#8c96a4';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const cx = r.x + r.w/2;
    const cy = r.y + r.h/2;
    const segW = 10, segH = 12;
    const startX = cx - segW * 2.5;
    ctx.moveTo(startX, cy);
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(startX + segW * (i + 0.5), cy - segH/2);
      ctx.lineTo(startX + segW * (i + 1), cy + segH/2);
    }
    ctx.lineTo(startX + segW * 5.5, cy);
    ctx.stroke();

    // Heat glow
    if (heatRatio > 0.1) {
      const glowAlpha = heatRatio * 0.4;
      ctx.shadowColor = `rgba(255, 107, 107, ${glowAlpha})`;
      ctx.shadowBlur = 20 * heatRatio;
      this.roundRect(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 8);
      ctx.strokeStyle = `rgba(255, 107, 107, ${glowAlpha * 0.5})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#8c96a4';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${power.toFixed(0)}mW`, r.x + r.w/2, r.y + r.h + 18);
  }

  drawElectrons() {
    const { ctx } = this;
    const currentMA = this.getCurrent() * 1000;

    for (const e of this.electrons) {
      const pos = this.getElectronPos(e);
      const path = this.wirePaths[e.pathIndex];

      // Electron color based on energy/current
      const hue = 180 + 60 * Math.sin(this.time * 3 + e.phase);
      const alpha = 0.6 + 0.4 * Math.sin(this.time * 5 + e.phase);

      ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
      ctx.shadowColor = `hsla(${hue}, 80%, 60%, 0.6)`;
      ctx.shadowBlur = 8 * (currentMA / 100);

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, e.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
    }
  }

  drawCurrentArrows() {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(0, 212, 170, 0.5)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(0, 212, 170, 0.5)';

    for (const path of this.wirePaths) {
      const mx = (path.start.x + path.end.x) / 2;
      const my = (path.start.y + path.end.y) / 2 - 30 * Math.sign(path.start.y - path.end.y);

      for (let i = 0; i < 3; i++) {
        const t = (this.time * 0.05 + i / 3) % 1;
        const invT = 1 - t;
        const x = invT * invT * path.start.x + 2 * invT * t * mx + t * t * path.end.x;
        const y = invT * invT * path.start.y + 2 * invT * t * my + t * t * path.end.y;

        const dt = 0.01;
        const t2 = (t + dt) % 1;
        const invT2 = 1 - t2;
        const x2 = invT2 * invT2 * path.start.x + 2 * invT2 * t2 * mx + t2 * t2 * path.end.x;
        const y2 = invT2 * invT2 * path.start.y + 2 * invT2 * t2 * my + t2 * t2 * path.end.y;

        const angle = Math.atan2(y2 - y, x2 - x);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-8, -4);
        ctx.lineTo(0, 0);
        ctx.lineTo(-8, 4);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  interpolateColor(c1, c2, t) {
    const hex1 = c1.replace('#', '');
    const hex2 = c2.replace('#', '');
    const r1 = parseInt(hex1.slice(0,2), 16), g1 = parseInt(hex1.slice(2,4), 16), b1 = parseInt(hex1.slice(4,6), 16);
    const r2 = parseInt(hex2.slice(0,2), 16), g2 = parseInt(hex2.slice(2,4), 16), b2 = parseInt(hex2.slice(4,6), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${b})`;
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  animate() {
    const now = performance.now();
    const dt = (now - (this.lastTime || now)) / 1000;
    this.lastTime = now;
    this.time += dt;

    this.updateElectrons(dt);
    this.draw();

    requestAnimationFrame(() => this.animate());
  }
}

// ==========================================================================
// Chapter 2: Logic Gates & 4-Bit Binary Adder
// ==========================================================================

class LogicSim {
  constructor(canvas) {
    this.canvas = canvas;
    this.setupCanvas();
    this.setupState();
    this.bindControls();
    this.animate();
  }

  setupCanvas() {
    const { ctx, width, height, dpr } = setupHiDPI(this.canvas);
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    onResize(this.canvas, (ctx, w, h, dpr) => {
      this.ctx = ctx;
      this.width = w;
      this.height = h;
      this.dpr = dpr;
      this.layoutGates();
    });
  }

  setupState() {
    this.inputA = true;
    this.inputB = false;

    this.adderA = [true, false, false, true];
    this.adderB = [false, true, true, false];

    this.time = 0;
    this.pulsePhase = 0;
    this.layoutGates();
  }

  layoutGates() {
    const w = this.width, h = this.height;
    const cx = w / 2, cy = h / 2;

    this.gatePositions = {
      AND: { x: cx - 180, y: cy - 180, w: 80, h: 50 },
      OR:  { x: cx - 60,  y: cy - 180, w: 80, h: 50 },
      XOR: { x: cx + 60,  y: cy - 180, w: 80, h: 50 },
      NOT: { x: cx + 180, y: cy - 180, w: 80, h: 50 }
    };

    this.inputNodes = {
      A: { x: cx - 280, y: cy - 155, value: this.inputA },
      B: { x: cx - 280, y: cy - 105, value: this.inputB }
    };

    this.adderBitY = cy + 60;
    this.adderStartX = cx - 200;
    this.bitSpacing = 70;
    this.adderBits = [];

    for (let i = 3; i >= 0; i--) {
      const bitIndex = i;
      const x = this.adderStartX + (3 - i) * this.bitSpacing;
      this.adderBits.push({
        index: bitIndex,
        x,
        y: this.adderBitY,
        a: this.adderA[i],
        b: this.adderB[i],
        sum: false,
        carryIn: false,
        carryOut: false
      });
    }
  }

  and(a, b) { return a && b; }
  or(a, b) { return a || b; }
  xor(a, b) { return a !== b; }
  not(a) { return !a; }

  fullAdder(a, b, cin) {
    const sum = this.xor(this.xor(a, b), cin);
    const cout = this.or(this.and(a, b), this.or(this.and(a, cin), this.and(b, cin)));
    return { sum, cout };
  }

  computeBasicGates() {
    return {
      AND: this.and(this.inputA, this.inputB),
      OR: this.or(this.inputA, this.inputB),
      XOR: this.xor(this.inputA, this.inputB),
      NOT: this.not(this.inputA)
    };
  }

  computeAdder() {
    let carry = false;
    const results = [];

    for (let i = 0; i < 4; i++) {
      const bit = this.adderBits[i];
      const { sum, cout } = this.fullAdder(bit.a, bit.b, carry);
      results.push({ sum, carryOut: cout });
      carry = cout;
    }

    for (let i = 0; i < 4; i++) {
      this.adderBits[i].sum = results[i].sum;
      this.adderBits[i].carryOut = results[i].carryOut;
      this.adderBits[i].carryIn = i === 0 ? false : results[i-1].carryOut;
    }

    return { carry };
  }

  getAdderDecimal(bits) {
    return bits.reduce((acc, bit, i) => acc + (bit ? Math.pow(2, i) : 0), 0);
  }

  bindControls() {
    const inputA = $('#ch2-input-a');
    const inputB = $('#ch2-input-b');
    const aVal = $('#ch2-a-val');
    const bVal = $('#ch2-b-val');

    inputA.addEventListener('change', () => {
      this.inputA = inputA.checked;
      this.inputNodes.A.value = this.inputA;
      aVal.textContent = this.inputA ? '1' : '0';
      this.updateBasicOutputs();
      sound.click();
      if (this.inputA) sound.tone(700, 'sine', 0.05, 0.04);
    });

    inputB.addEventListener('change', () => {
      this.inputB = inputB.checked;
      this.inputNodes.B.value = this.inputB;
      bVal.textContent = this.inputB ? '1' : '0';
      this.updateBasicOutputs();
      sound.click();
      if (this.inputB) sound.tone(700, 'sine', 0.05, 0.04);
    });

    $$('#ch2-bits-a input').forEach((cb, idx) => {
      const bit = 3 - idx;
      cb.checked = this.adderA[bit];
      cb.addEventListener('change', () => {
        this.adderA[bit] = cb.checked;
        this.adderBits.find(b => b.index === bit).a = cb.checked;
        this.updateAdder();
        sound.click();
      });
    });

    $$('#ch2-bits-b input').forEach((cb, idx) => {
      const bit = 3 - idx;
      cb.checked = this.adderB[bit];
      cb.addEventListener('change', () => {
        this.adderB[bit] = cb.checked;
        this.adderBits.find(b => b.index === bit).b = cb.checked;
        this.updateAdder();
        sound.click();
      });
    });

    this.updateBasicOutputs();
    this.updateAdder();
  }

  updateBasicOutputs() {
    const gates = this.computeBasicGates();

    $('#ch2-and').textContent = gates.AND ? '1' : '0';
    $('#ch2-or').textContent = gates.OR ? '1' : '0';
    $('#ch2-xor').textContent = gates.XOR ? '1' : '0';
    $('#ch2-not').textContent = gates.NOT ? '1' : '0';

    $$('.gate-output').forEach(el => el.classList.remove('high'));
    if (gates.AND) $('#ch2-and').parentElement.classList.add('high');
    if (gates.OR) $('#ch2-or').parentElement.classList.add('high');
    if (gates.XOR) $('#ch2-xor').parentElement.classList.add('high');
    if (gates.NOT) $('#ch2-not').parentElement.classList.add('high');

    if (gates.AND || gates.OR || gates.XOR || gates.NOT) {
      sound.tone(600, 'sine', 0.04, 0.03);
    }
  }

  updateAdder() {
    this.computeAdder();

    $$('#ch2-bits-sum .sum-bit').forEach((el, idx) => {
      const bit = 3 - idx;
      const bitData = this.adderBits.find(b => b.index === bit);
      el.textContent = bitData.sum ? '1' : '0';
      el.classList.toggle('high', bitData.sum);
    });

    $('#ch2-dec-a').textContent = this.getAdderDecimal(this.adderA);
    $('#ch2-dec-b').textContent = this.getAdderDecimal(this.adderB);
    $('#ch2-dec-sum').textContent = this.getAdderDecimal(this.adderBits.map(b => b.sum));

    const carryContainer = $('#ch2-carries');
    carryContainer.innerHTML = '';
    this.adderBits.forEach(bit => {
      const carryEl = document.createElement('span');
      carryEl.className = 'carry-bit' + (bit.carryOut ? ' active' : '');
      carryEl.textContent = `C${bit.index}=${bit.carryOut ? '1' : '0'}`;
      carryContainer.appendChild(carryEl);
    });
  }

  draw() {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    this.drawBasicGates();
    this.drawAdder();
  }

  drawBasicGates() {
    const { ctx } = this;
    const gates = this.computeBasicGates();

    for (const [name, node] of Object.entries(this.inputNodes)) {
      this.drawWire(node.x + 20, node.y, this.gatePositions.AND.x, node.y, node.value);
      this.drawWire(node.x + 20, node.y, this.gatePositions.OR.x, node.y, node.value);
      this.drawWire(node.x + 20, node.y, this.gatePositions.XOR.x, node.y, node.value);
    }

    this.drawWire(this.inputNodes.A.x + 20, this.inputNodes.A.y, this.gatePositions.NOT.x, this.gatePositions.NOT.y + 25, this.inputA);

    for (const [name, pos] of Object.entries(this.gatePositions)) {
      const output = gates[name];
      this.drawGate(name, pos.x, pos.y, pos.w, pos.h, output);

      const wireEndX = pos.x + pos.w + 40;
      this.drawWire(pos.x + pos.w, pos.y + pos.h/2, wireEndX, pos.y + pos.h/2, output);
    }
  }

  drawGate(name, x, y, w, h, output) {
    const { ctx } = this;
    const high = output;
    const fillColor = high ? 'rgba(0, 212, 170, 0.12)' : '#161c26';
    const strokeColor = high ? '#00d4aa' : '#333e4d';
    const textColor = high ? '#00d4aa' : '#e8ebf0';

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = high ? 2.5 : 2;
    this.roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();

    if (high) {
      ctx.shadowColor = 'rgba(0, 212, 170, 0.4)';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#00d4aa';
      ctx.lineWidth = 2.5;
      this.roundRect(ctx, x, y, w, h, 8);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = textColor;
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const cx = x + w/2, cy = y + h/2;
    const s = Math.min(w, h) * 0.35;

    switch (name) {
      case 'AND':
        ctx.beginPath();
        ctx.moveTo(cx - s, cy - s);
        ctx.lineTo(cx - s, cy + s);
        ctx.quadraticCurveTo(cx + s, cy + s, cx + s, cy);
        ctx.quadraticCurveTo(cx + s, cy - s, cx - s, cy - s);
        ctx.stroke();
        break;
      case 'OR':
        ctx.beginPath();
        ctx.moveTo(cx - s, cy - s);
        ctx.quadraticCurveTo(cx, cy - s, cx + s*0.5, cy);
        ctx.quadraticCurveTo(cx, cy + s, cx - s, cy + s);
        ctx.quadraticCurveTo(cx - s*0.5, cy, cx - s, cy - s);
        ctx.stroke();
        break;
      case 'XOR':
        ctx.beginPath();
        ctx.moveTo(cx - s*1.2, cy - s);
        ctx.quadraticCurveTo(cx - s*0.2, cy - s, cx + s*0.5, cy);
        ctx.quadraticCurveTo(cx - s*0.2, cy + s, cx - s*1.2, cy + s);
        ctx.quadraticCurveTo(cx - s*0.7, cy, cx - s*1.2, cy - s);
        ctx.stroke();
        break;
      case 'NOT':
        ctx.beginPath();
        ctx.moveTo(cx - s, cy - s);
        ctx.lineTo(cx + s, cy);
        ctx.lineTo(cx - s, cy + s);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + s + 6, cy, 6, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }

    ctx.fillStyle = textColor;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, cx, y - 14);
  }

  drawWire(x1, y1, x2, y2, high) {
    const { ctx } = this;
    ctx.strokeStyle = high ? '#00d4aa' : '#333e4d';
    ctx.lineWidth = high ? 3 : 2;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const mx = (x1 + x2) / 2;
    ctx.lineTo(mx, y1);
    ctx.lineTo(mx, y2);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (high) {
      ctx.shadowColor = 'rgba(0, 212, 170, 0.4)';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#00d4aa';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(mx, y1);
      ctx.lineTo(mx, y2);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Animated signal pulse
      const pulseX = mx + Math.sin(this.time * 6) * 25;
      const pulseY = y1;
      ctx.fillStyle = '#00d4aa';
      ctx.shadowColor = '#00d4aa';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(pulseX, pulseY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  drawAdder() {
    const { ctx } = this;

    for (const bit of this.adderBits) {
      this.drawAdderBit(bit);
    }

    for (let i = 0; i < 3; i++) {
      const bit = this.adderBits[i];
      const nextBit = this.adderBits[i + 1];
      this.drawCarryWire(bit, nextBit);
    }
  }

  drawAdderBit(bit) {
    const { ctx } = this;
    const x = bit.x;
    const y = bit.y;
    const spacing = 35;

    this.drawBitInput(x - spacing * 1.5, y - spacing, bit.a, `A${bit.index}`);
    this.drawBitInput(x - spacing * 1.5, y + spacing, bit.b, `B${bit.index}`);

    const boxX = x - 30, boxY = y - 25, boxW = 60, boxH = 50;
    ctx.fillStyle = '#161c26';
    ctx.strokeStyle = '#333e4d';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, boxX, boxY, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#8c96a4';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FA', x, boxY - 8);

    if (bit.index > 0) {
      const cinY = boxY + boxH/2;
      this.drawWire(boxX - 30, cinY, boxX, cinY, bit.carryIn);
      ctx.fillStyle = bit.carryIn ? '#ffb84d' : '#5c6674';
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('Cin', boxX - 35, cinY + 3);
    }

    const sumX = boxX + boxW;
    const sumY = boxY + boxH/2 - 8;
    this.drawWire(sumX, sumY, sumX + 30, sumY, bit.sum);
    this.drawBitOutput(sumX + 30, sumY, bit.sum, `S${bit.index}`);

    const coutY = boxY + boxH/2 + 8;
    this.drawWire(sumX, coutY, sumX + 30, coutY, bit.carryOut);
    if (bit.index < 3) {
      ctx.fillStyle = bit.carryOut ? '#ffb84d' : '#5c6674';
      ctx.font = '8px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Cout', sumX + 35, coutY + 3);
    }
  }

  drawBitInput(x, y, value, label) {
    const { ctx } = this;
    const high = value;

    this.drawWire(x - 40, y, x, y, high);

    ctx.fillStyle = high ? 'rgba(0, 212, 170, 0.12)' : '#161c26';
    ctx.strokeStyle = high ? '#00d4aa' : '#333e4d';
    ctx.lineWidth = high ? 2.5 : 2;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (high) {
      ctx.shadowColor = 'rgba(0, 212, 170, 0.4)';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#00d4aa';
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = high ? '#00d4aa' : '#5c6674';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(high ? '1' : '0', x, y);

    ctx.fillStyle = '#8c96a4';
    ctx.font = '8px monospace';
    ctx.fillText(label, x, y + 22);
  }

  drawBitOutput(x, y, value, label) {
    const { ctx } = this;
    const high = value;

    ctx.fillStyle = high ? 'rgba(0, 212, 170, 0.12)' : '#161c26';
    ctx.strokeStyle = high ? '#00d4aa' : '#333e4d';
    ctx.lineWidth = high ? 2.5 : 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x + 12, y);
    ctx.lineTo(x, y + 12);
    ctx.lineTo(x - 12, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (high) {
      ctx.shadowColor = 'rgba(0, 212, 170, 0.4)';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#00d4aa';
      ctx.beginPath();
      ctx.moveTo(x, y - 12);
      ctx.lineTo(x + 12, y);
      ctx.lineTo(x, y + 12);
      ctx.lineTo(x - 12, y);
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = high ? '#00d4aa' : '#5c6674';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(high ? '1' : '0', x, y);

    ctx.fillStyle = '#8c96a4';
    ctx.font = '8px monospace';
    ctx.fillText(label, x, y + 22);
  }

  drawCarryWire(bit, nextBit) {
    const { ctx } = this;
    const high = bit.carryOut;

    const x1 = bit.x + 30;
    const y1 = bit.y;
    const x2 = nextBit.x - 30;
    const y2 = nextBit.y;

    ctx.strokeStyle = high ? '#ffb84d' : '#333e4d';
    ctx.lineWidth = high ? 3 : 2;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + 15, y1);
    ctx.lineTo(x1 + 15, y2);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (high) {
      ctx.shadowColor = 'rgba(255, 184, 77, 0.4)';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#ffb84d';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + 15, y1);
      ctx.lineTo(x1 + 15, y2);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      const pulseProgress = (this.time * 2) % 1;
      const px = x1 + 15 + (x2 - x1 - 30) * pulseProgress;
      const py = y1 + (y2 - y1) * pulseProgress;

      ctx.fillStyle = '#ffb84d';
      ctx.shadowColor = '#ffb84d';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  animate() {
    const now = performance.now();
    const dt = (now - (this.lastTime || now)) / 1000;
    this.lastTime = now;
    this.time += dt;
    this.pulsePhase += dt * 2;

    this.draw();
    requestAnimationFrame(() => this.animate());
  }
}

// ==========================================================================
// Chapter Navigation / Scroll Spy
// ==========================================================================

class ChapterNav {
  constructor() {
    this.chapters = $$('.chapter[data-chapter]');
    this.railItems = $$('.rail-chapters li[data-chapter]');
    this.heroProgressBar = $('#heroProgressBar');
    this.railProgress = $('.rail-progress');
    this.bindScroll();
    this.updateActive(1);
  }

  bindScroll() {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.onScroll();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  onScroll() {
    const scrollY = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = clamp(scrollY / docHeight, 0, 1);

    if (this.heroProgressBar) {
      this.heroProgressBar.style.width = `${progress * 100}%`;
    }

    if (this.railProgress) {
      this.railProgress.style.setProperty('--progress', progress);
    }

    let activeChapter = 1;
    for (const chapter of this.chapters) {
      const rect = chapter.getBoundingClientRect();
      const chapterNum = parseInt(chapter.dataset.chapter, 10);
      if (rect.top <= window.innerHeight * 0.4) {
        activeChapter = chapterNum;
      }
    }

    this.updateActive(activeChapter);
  }

  updateActive(chapterNum) {
    this.railItems.forEach(item => {
      const num = parseInt(item.dataset.chapter, 10);
      item.classList.toggle('active', num === chapterNum);
    });

    if (this.railProgress) {
      const totalChapters = 5;
      const progress = (chapterNum - 1) / (totalChapters - 1);
      this.railProgress.style.setProperty('--progress', progress);
    }
  }
}

// ==========================================================================
// Smooth Scroll for Rail Links
// ==========================================================================

function initSmoothScroll() {
  $$('.rail-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ==========================================================================
// Sound Toggle
// ==========================================================================

function initSoundToggle() {
  const btn = $('#btnSound');
  if (!btn) return;

  const updateUI = () => {
    btn.setAttribute('aria-pressed', sound.enabled);
    btn.querySelector('.sound-icon').textContent = sound.enabled ? '🔊' : '🔇';
  };

  btn.addEventListener('click', async () => {
    await sound.start();
    sound.setEnabled(!sound.enabled);
    updateUI();
    if (sound.enabled) {
      sound.chime();
    } else {
      sound.click();
    }
  });

  updateUI();
}

// ==========================================================================
// Main Initialization
// ==========================================================================

function init() {
  const ch1Canvas = $('#ch1-canvas');
  const ch2Canvas = $('#ch2-canvas');

  if (ch1Canvas) new CircuitSim(ch1Canvas);
  if (ch2Canvas) new LogicSim(ch2Canvas);

  new ChapterNav();
  initSmoothScroll();
  initSoundToggle();

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -100px 0px' });

  $$('.chapter').forEach(ch => observer.observe(ch));

  // Initialize audio context on first interaction
  const startAudio = async () => {
    await sound.start();
    document.removeEventListener('pointerdown', startAudio);
    document.removeEventListener('keydown', startAudio);
  };
  document.addEventListener('pointerdown', startAudio, { once: true });
  document.addEventListener('keydown', startAudio, { once: true });

  console.log('Inside a Machine: From Electron to AI — Initialized');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { CircuitSim, LogicSim, ChapterNav, SoundEngine, sound };