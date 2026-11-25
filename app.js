/**
 * Inside a Machine: From Electron to AI — App Module
 * Modular simulation engines for Chapters 1–4
 * Milestone 2: Chapters 3 (CPU) & 4 (Neural Network) added
 * Designed for extensibility: Chapter 5 can be added by registering new simulation modules.
 */

// ==========================================================================
// Utility Functions
// ==========================================================================

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Guard against NaN/Infinity in numeric outputs
const safeNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

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
    return safeNum(this.voltage / Math.max(this.resistance, 1));
  }

  getPower() {
    const i = this.getCurrent();
    return safeNum(this.voltage * i);
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

      ctx.strokeStyle = '#232a36';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(path.start.x, path.start.y);
      ctx.quadraticCurveTo(mx, my, path.end.x, path.end.y);
      ctx.stroke();

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
    const dt = Math.min((now - (this.lastTime || now)) / 1000, 0.05);
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
    this.resizeCleanup = onResize(this.canvas, (ctx, w, h, dpr) => {
      this.ctx = ctx;
      this.width = w;
      this.height = h;
      this.dpr = dpr;
      this.layoutComponents();
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
    const dt = Math.min((now - (this.lastTime || now)) / 1000, 0.05);
    this.lastTime = now;
    this.time += dt;
    this.pulsePhase += dt * 2;

    this.draw();
    requestAnimationFrame(() => this.animate());
  }
}

// ==========================================================================
// Chapter 3: CPU Clock Speed, Heat & Scale
// ==========================================================================

class CPUSim {
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
    this.clockMHz = 3000;      // 3.0 GHz
    this.voltage = 1.1;        // V
    this.cooling = 65;         // W
    this.workload = 0.8;       // 0-1
    this.throttleEnabled = true;
    this.time = 0;
    this.temperature = 45;     // °C
    this.throttleFactor = 1.0;
    this.history = { temp: [], power: [], throttle: [], throughput: [] };
    this.maxHistory = 120;
    this.chapterEl = this.canvas.closest('.chapter');
    this.layoutComponents();
  }

  layoutComponents() {
    const w = this.width, h = this.height;
    this.cpuRect = {
      x: w * 0.15, y: h * 0.2,
      w: w * 0.35, h: h * 0.5
    };
    this.graphRect = {
      x: w * 0.55, y: h * 0.1,
      w: w * 0.4, h: h * 0.7
    };
  }

  // CPU presets: { name, clockMHz, voltage, cooling, workload }
  presets = {
    '4004':    { clock: 0.74,  voltage: 1.5, cooling: 1,   workload: 0.3 },
    '8086':    { clock: 5,     voltage: 1.5, cooling: 2,   workload: 0.4 },
    'pentium': { clock: 60,    voltage: 1.8, cooling: 10,  workload: 0.5 },
    'core2':   { clock: 2600,  voltage: 1.2, cooling: 65,  workload: 0.7 },
    'ryzen':   { clock: 4700,  voltage: 1.25, cooling: 105, workload: 0.9 },
    'modern':  { clock: 5200,  voltage: 1.1, cooling: 150, workload: 0.8 }
  };

  applyPreset(key) {
    const p = this.presets[key];
    if (!p) return;
    this.clockMHz = p.clock;
    this.voltage = p.voltage;
    this.cooling = p.cooling;
    this.workload = p.workload;
    this.updateUI();
    sound.chime();
  }

  updateUI() {
    $('#ch3-clock').value = this.clockMHz;
    $('#ch3-clock-val').textContent = this.formatClock(this.clockMHz);
    $('#ch3-voltage').value = this.voltage;
    $('#ch3-voltage-val').textContent = this.voltage.toFixed(2) + ' V';
    $('#ch3-cooling').value = this.cooling;
    $('#ch3-cooling-val').textContent = this.cooling + ' W';
    $('#ch3-workload').value = this.workload * 100;
    $('#ch3-workload-val').textContent = Math.round(this.workload * 100) + '%';
    $$('input[name="cpu-preset"]').forEach(r => {
      r.checked = r.value === this.currentPreset;
      r.parentElement.classList.toggle('checked', r.checked);
    });
  }

  formatClock(mhz) {
    if (mhz < 1000) return mhz.toFixed(1) + ' MHz';
    return (mhz / 1000).toFixed(1) + ' GHz';
  }

  bindControls() {
    const clockSlider = $('#ch3-clock');
    const clockVal = $('#ch3-clock-val');
    const voltageSlider = $('#ch3-voltage');
    const voltageVal = $('#ch3-voltage-val');
    const coolingSlider = $('#ch3-cooling');
    const coolingVal = $('#ch3-cooling-val');
    const workloadSlider = $('#ch3-workload');
    const workloadVal = $('#ch3-workload-val');
    const throttleSwitch = $('#ch3-throttle');
    const throttleState = $('#ch3-throttle-state');

    clockSlider.addEventListener('input', () => {
      this.clockMHz = parseFloat(clockSlider.value);
      clockVal.textContent = this.formatClock(this.clockMHz);
      this.currentPreset = 'custom';
      this.updatePresetRadios();
      sound.tone(200 + this.clockMHz / 10, 'sine', 0.02, 0.02);
    });

    voltageSlider.addEventListener('input', () => {
      this.voltage = parseFloat(voltageSlider.value);
      voltageVal.textContent = this.voltage.toFixed(2) + ' V';
      this.currentPreset = 'custom';
      this.updatePresetRadios();
      sound.tone(400 + this.voltage * 200, 'sine', 0.02, 0.02);
    });

    coolingSlider.addEventListener('input', () => {
      this.cooling = parseInt(coolingSlider.value, 10);
      coolingVal.textContent = this.cooling + ' W';
      this.currentPreset = 'custom';
      this.updatePresetRadios();
    });

    workloadSlider.addEventListener('input', () => {
      this.workload = parseInt(workloadSlider.value, 10) / 100;
      workloadVal.textContent = Math.round(this.workload * 100) + '%';
      this.currentPreset = 'custom';
      this.updatePresetRadios();
    });

    throttleSwitch.addEventListener('change', () => {
      this.throttleEnabled = throttleSwitch.checked;
      throttleState.textContent = this.throttleEnabled ? 'ON' : 'OFF';
      sound.click();
    });

    $$('input[name="cpu-preset"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          this.currentPreset = radio.value;
          this.applyPreset(radio.value);
        }
      });
    });

    this.currentPreset = 'modern';
    this.updateUI();
  }

  updatePresetRadios() {
    $$('input[name="cpu-preset"]').forEach(r => {
      r.parentElement.classList.toggle('checked', r.checked);
    });
  }

  // Physics model
  computePower() {
    // P = C * V^2 * f * activity
    // Simplified: base capacitance factor * V^2 * f * workload
    const C = 1e-9; // Effective capacitance (normalized)
    const freqHz = this.clockMHz * 1e6;
    const dynamicPower = C * this.voltage * this.voltage * freqHz * this.workload;
    const staticPower = 0.5 * this.voltage * Math.exp((this.temperature - 25) / 50); // Leakage
    return safeNum((dynamicPower + staticPower) * 1e-3); // Convert to Watts (scaled)
  }

  computeThroughput() {
    // Instructions per second = clock * IPC * throttle
    // Assume base IPC of 2.0 for modern, lower for older
    const baseIPC = this.clockMHz > 1000 ? 2.0 : (this.clockMHz > 100 ? 1.0 : 0.5);
    return this.clockMHz * baseIPC * this.throttleFactor * this.workload; // MIPS
  }

  computeThermal() {
    const power = this.computePower();
    // Thermal model: dT/dt = (P - cooling) / thermal_mass
    // Steady state: T = ambient + P * R_th
    const ambient = 25;
    const Rth = 1.0 / (this.cooling / 100); // Thermal resistance
    const targetTemp = ambient + power * Rth;
    // Exponential approach to steady state
    const tau = 5.0; // Thermal time constant (seconds)
    this.temperature += (targetTemp - this.temperature) * (1 - Math.exp(-1/60 / tau));
    return this.temperature;
  }

  computeThrottle() {
    if (!this.throttleEnabled) return 1.0;
    const tjMax = 100; // °C
    const throttleStart = 85;
    if (this.temperature <= throttleStart) return 1.0;
    const factor = 1.0 - (this.temperature - throttleStart) / (tjMax - throttleStart) * 0.7;
    return clamp(factor, 0.3, 1.0);
  }

  updateReadouts() {
    const throughput = this.computeThroughput();
    const power = this.computePower();
    const throttlePct = Math.round((1 - this.throttleFactor) * 100);

    $('#ch3-throughput').textContent = (throughput / 1000).toFixed(1) + ' GIPS';
    $('#ch3-temp').textContent = this.temperature.toFixed(0) + ' °C';
    $('#ch3-power').textContent = power.toFixed(1) + ' W';
    $('#ch3-throttle-pct').textContent = throttlePct + '%';
    $('#ch3-throttle-pct').style.color = throttlePct > 0 ? 'var(--warn)' : 'var(--accent)';
  }

  draw() {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    this.drawGraphs();
    this.drawCPUDie();
    this.drawLegend();
  }

  drawCPUDie() {
    const { ctx } = this;
    const r = this.cpuRect;
    const temp = this.temperature;
    const throttle = this.throttleFactor < 1.0;

    // CPU package outline
    ctx.fillStyle = '#161c26';
    ctx.strokeStyle = '#333e4d';
    ctx.lineWidth = 2;
    this.roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.stroke();

    // Heat map - divide into cores
    const coresX = 4, coresY = 2;
    const coreW = r.w / coresX;
    const coreH = r.h / coresY;

    for (let cy = 0; cy < coresY; cy++) {
      for (let cx = 0; cx < coresX; cx++) {
        const x = r.x + cx * coreW;
        const y = r.y + cy * coreH;
        const variation = 0.85 + Math.sin(this.time * 2 + cx * 3 + cy * 5) * 0.15;
        const coreTemp = this.temperature * variation;
        const heatRatio = clamp((coreTemp - 30) / 80, 0, 1);

        let color;
        if (heatRatio < 0.4) color = this.interpolateColor('#00d4aa', '#ffb84d', heatRatio / 0.4);
        else if (heatRatio < 0.7) color = this.interpolateColor('#ffb84d', '#ff6b6b', (heatRatio - 0.4) / 0.3);
        else color = this.interpolateColor('#ff6b6b', '#ffffff', (heatRatio - 0.7) / 0.3);

        ctx.fillStyle = color;
        this.roundRect(ctx, x + 4, y + 4, coreW - 8, coreH - 8, 4);
        ctx.fill();

        // Core label
        ctx.fillStyle = '#8c96a4';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`C${cy * coresX + cx}`, x + coreW/2, y + coreH/2 + 3);
      }
    }

    // Throttle indicator
    if (this.throttleFactor < 1.0) {
      ctx.fillStyle = 'rgba(255, 184, 77, 0.3)';
      this.roundRect(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 12);
      ctx.fill();
      ctx.strokeStyle = '#ffb84d';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      this.roundRect(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 12);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // CPU label
    ctx.fillStyle = '#8c96a4';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.formatClock(this.clockMHz)} @ ${this.voltage.toFixed(2)}V`, r.x + r.w/2, r.y - 12);
  }

  drawGraphs() {
    const { ctx } = this;
    const g = this.graphRect;

    // Background
    ctx.fillStyle = '#080a0f';
    ctx.strokeStyle = '#232a36';
    ctx.lineWidth = 1;
    this.roundRect(ctx, g.x, g.y, g.w, g.h, 8);
    ctx.fill();
    ctx.stroke();

    // Grid
    ctx.strokeStyle = 'rgba(0, 212, 170, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = g.y + g.h * i / 4;
      ctx.beginPath();
      ctx.moveTo(g.x, y);
      ctx.lineTo(g.x + g.w, y);
      ctx.stroke();
    }
    for (let i = 1; i < 5; i++) {
      const x = g.x + g.w * i / 5;
      ctx.beginPath();
      ctx.moveTo(x, g.y);
      ctx.lineTo(x, g.y + g.h);
      ctx.stroke();
    }

    // Update history
    this.history.temp.push(this.temperature);
    this.history.power.push(this.computePower());
    this.history.throttle.push(this.throttleFactor);
    this.history.throughput.push(this.computeThroughput() / 1000); // GIPS

    for (const key of ['temp', 'power', 'throttle', 'throughput']) {
      if (this.history[key].length > this.maxHistory) this.history[key].shift();
    }

    // Draw lines
    const colors = {
      temp: '#ff6b6b',
      power: '#ffb84d',
      throttle: '#ffb84d',
      throughput: '#00d4aa'
    };
    const scales = {
      temp: { min: 20, max: 110 },
      power: { min: 0, max: 200 },
      throttle: { min: 0, max: 1 },
      throughput: { min: 0, max: 20 }
    };

    for (const key of ['temp', 'power', 'throttle', 'throughput']) {
      const data = this.history[key];
      if (data.length < 2) continue;
      const scale = scales[key];
      ctx.strokeStyle = colors[key];
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      data.forEach((val, i) => {
        const x = g.x + (i / (this.maxHistory - 1)) * g.w;
        const y = g.y + g.h - ((val - scale.min) / (scale.max - scale.min)) * g.h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = '#5c6674';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('110°C', g.x - 8, g.y + 12);
    ctx.fillText('200W', g.x - 8, g.y + g.h * 0.25 + 4);
    ctx.fillText('1.0', g.x - 8, g.y + g.h * 0.5 + 4);
    ctx.fillText('20 GIPS', g.x - 8, g.y + g.h * 0.75 + 4);
  }

  drawLegend() {
    const { ctx } = this;
    const g = this.graphRect;
    const items = [
      { label: 'Temp (°C)', color: '#ff6b6b' },
      { label: 'Power (W)', color: '#ffb84d' },
      { label: 'Throttle', color: '#ffb84d' },
      { label: 'Throughput (GIPS)', color: '#00d4aa' }
    ];

    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    items.forEach((item, i) => {
      const x = g.x + 10;
      const y = g.y + 20 + i * 20;
      ctx.fillStyle = item.color;
      ctx.fillRect(x, y - 8, 16, 4);
      ctx.fillStyle = '#8c96a4';
      ctx.fillText(item.label, x + 22, y);
    });
  }

  animate() {
    // Pause loop when chapter is offscreen
    if (this.chapterEl && !this.chapterEl.classList.contains('visible')) {
      requestAnimationFrame(() => this.animate());
      return;
    }

    const now = performance.now();
    const dt = Math.min((now - (this.lastTime || now)) / 1000, 0.05);
    this.lastTime = now;
    this.time += dt;

    // Thermal simulation step
    this.computeThermal();
    this.throttleFactor = this.computeThrottle();
    this.updateReadouts();

    // Thermal glow class toggling
    const throttlePct = Math.round((1 - this.throttleFactor) * 100);
    const throttleEl = $('#ch3-throttle-pct');
    if (throttlePct > 0) {
      throttleEl.setAttribute('data-throttling', 'true');
      throttleEl.classList.add('throttle-pulse');
    } else {
      throttleEl.setAttribute('data-throttling', 'false');
      throttleEl.classList.remove('throttle-pulse');
    }

    this.draw();
    requestAnimationFrame(() => this.animate());
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
}

// ==========================================================================
// Chapter 4: Neural Network Learning
// ==========================================================================

class NeuralNetSim {
  constructor(canvas) {
    this.canvas = canvas;
    this.setupCanvas();
    this.setupState();
    this.bindControls();
    this.draw();
    this.animate();
  }

  setupCanvas() {
    const { ctx, width, height, dpr } = setupHiDPI(this.canvas);
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.resizeCleanup = onResize(this.canvas, (ctx, w, h, dpr) => {
      this.ctx = ctx;
      this.width = w;
      this.height = h;
      this.dpr = dpr;
    });

    // Set up loss chart canvas separately
    const lossCanvas = $('#ch4-loss-chart');
    if (lossCanvas) {
      const { ctx: lossCtx, width: lw, height: lh, dpr: ldpr } = setupHiDPI(lossCanvas);
      this.lossCtx = lossCtx;
      this.lossWidth = lw;
      this.lossHeight = lh;
      this.lossResizeCleanup = onResize(lossCanvas, (ctx, w, h, dpr) => {
        this.lossCtx = ctx;
        this.lossWidth = w;
        this.lossHeight = h;
      });
    }
  }

  setupState() {
    this.points = []; // {x, y, label: 0|1}
    this.hiddenUnits = 8;
    this.hiddenLayers = 2;
    this.learningRate = 0.1;
    this.batchSize = 16;
    this.training = false;
    this.epoch = 0;
    this.loss = 0;
    this.accuracy = 0;
    this.lossHistory = [];
    this.maxHistory = 200;
    this.network = null;
    this.decisionGrid = null;
    this.gridResolution = 40;
    this.mode = 'class0'; // 'class0' or 'class1'
    this.chapterEl = this.canvas.closest('.chapter');
    this.buildNetwork();
  }

  buildNetwork() {
    const layers = [2]; // Input: 2D
    for (let i = 0; i < this.hiddenLayers; i++) {
      layers.push(this.hiddenUnits);
    }
    layers.push(1); // Output: binary classification

    this.network = {
      layers,
      weights: [],
      biases: []
    };

    for (let i = 0; i < layers.length - 1; i++) {
      const inSize = layers[i];
      const outSize = layers[i + 1];
      const w = [];
      for (let j = 0; j < outSize; j++) {
        const row = [];
        for (let k = 0; k < inSize; k++) {
          // Xavier initialization
          row.push(rand(-1, 1) * Math.sqrt(2 / inSize));
        }
        w.push(row);
      }
      this.network.weights.push(w);
      this.network.biases.push(new Array(outSize).fill(0));
    }
  }

  // Activation functions
  relu(x) { return Math.max(0, x); }
  reluDeriv(x) { return x > 0 ? 1 : 0; }
  sigmoid(x) {
    // Clamp input to prevent Math.exp overflow
    const xClamped = clamp(x, -700, 700);
    return safeNum(1 / (1 + Math.exp(-xClamped)));
  }
  sigmoidDeriv(x) { const s = this.sigmoid(x); return s * (1 - s); }

  forward(input) {
    let activations = [input];
    let zs = [];

    for (let i = 0; i < this.network.weights.length; i++) {
      const w = this.network.weights[i];
      const b = this.network.biases[i];
      const z = [];
      for (let j = 0; j < w.length; j++) {
        let sum = b[j];
        for (let k = 0; k < w[j].length; k++) {
          sum += w[j][k] * activations[i][k];
        }
        z.push(sum);
      }
      zs.push(z);
      const a = z.map((val, idx) => {
        if (i === this.network.weights.length - 1) return this.sigmoid(val);
        return this.relu(val);
      });
      activations.push(a);
    }

    return { activations, zs };
  }

  backward(input, target, activations, zs) {
    const grads = {
      weights: this.network.weights.map(w => w.map(row => row.map(() => 0))),
      biases: this.network.biases.map(b => b.map(() => 0))
    };

    // Output layer gradient
    const outputLayer = this.network.weights.length - 1;
    const outputAct = activations[outputLayer + 1][0];
    const outputZ = zs[outputLayer][0];
    let delta = (outputAct - target) * this.sigmoidDeriv(outputZ);

    // Output layer gradients
    for (let j = 0; j < this.network.weights[outputLayer].length; j++) {
      for (let k = 0; k < this.network.weights[outputLayer][j].length; k++) {
        grads.weights[outputLayer][j][k] = delta * activations[outputLayer][k];
      }
      grads.biases[outputLayer][j] = delta;
    }

    // Backpropagate through hidden layers
    for (let l = outputLayer - 1; l >= 0; l--) {
      const nextDelta = delta;
      delta = [];
      for (let j = 0; j < this.network.weights[l].length; j++) {
        let sum = 0;
        for (let k = 0; k < this.network.weights[l + 1].length; k++) {
          sum += this.network.weights[l + 1][k][j] * nextDelta[k];
        }
        delta[j] = sum * this.reluDeriv(zs[l][j]);
      }

      // Gradients for this layer
      for (let j = 0; j < this.network.weights[l].length; j++) {
        for (let k = 0; k < this.network.weights[l][j].length; k++) {
          grads.weights[l][j][k] = delta[j] * (l === 0 ? (k < 2 ? [1, 0][k] : 0) : activations[l][k]);
        }
        grads.biases[l][j] = delta[j];
      }
    }

    return grads;
  }

  trainBatch(batch) {
    let totalLoss = 0;
    let correct = 0;

    // Accumulate gradients
    const accGrads = {
      weights: this.network.weights.map(w => w.map(row => row.map(() => 0))),
      biases: this.network.biases.map(b => b.map(() => 0))
    };

    for (const { input, target } of batch) {
      const { activations, zs } = this.forward(input);
      const output = activations[activations.length - 1][0];
      const loss = -(target * Math.log(output + 1e-8) + (1 - target) * Math.log(1 - output + 1e-8));
      totalLoss += loss;
      if ((output > 0.5) === target) correct++;

      const grads = this.backward(input, target, activations, zs);
      for (let l = 0; l < grads.weights.length; l++) {
        for (let j = 0; j < grads.weights[l].length; j++) {
          for (let k = 0; k < grads.weights[l][j].length; k++) {
            accGrads.weights[l][j][k] += grads.weights[l][j][k];
          }
          accGrads.biases[l][j] += grads.biases[l][j];
        }
      }
    }

    // Apply gradients
    const batchSize = batch.length;
    for (let l = 0; l < this.network.weights.length; l++) {
      for (let j = 0; j < this.network.weights[l].length; j++) {
        for (let k = 0; k < this.network.weights[l][j].length; k++) {
          this.network.weights[l][j][k] -= this.learningRate * accGrads.weights[l][j][k] / batchSize;
        }
        this.network.biases[l][j] -= this.learningRate * accGrads.biases[l][j] / batchSize;
      }
    }

    return { loss: totalLoss / batchSize, accuracy: correct / batchSize };
  }

  predict(input) {
    const { activations } = this.forward(input);
    return activations[activations.length - 1][0];
  }

  computeDecisionGrid() {
    const grid = [];
    const margin = 0.1;
    for (let i = 0; i <= this.gridResolution; i++) {
      const row = [];
      for (let j = 0; j <= this.gridResolution; j++) {
        const x = margin + (1 - 2 * margin) * i / this.gridResolution;
        const y = margin + (1 - 2 * margin) * j / this.gridResolution;
        const pred = this.predict([x, y]);
        row.push(pred);
      }
      grid.push(row);
    }
    this.decisionGrid = grid;
  }

  bindControls() {
    // Canvas click to add points
    this.canvas.addEventListener('click', (e) => {
      if (this.training) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      const label = e.shiftKey ? 1 : 0;
      this.points.push({ x, y, label });
      this.updateReadouts();
      sound.tone(400 + label * 200, 'sine', 0.03, 0.03);
    });

    // Buttons
    $('#ch4-clear').addEventListener('click', () => {
      this.points = [];
      this.updateReadouts();
      sound.click();
    });

    $('#ch4-random').addEventListener('click', () => {
      this.points = [];
      for (let i = 0; i < 50; i++) {
        const label = randInt(0, 1);
        const angle = rand(0, Math.PI * 2);
        const r = rand(0.2, 0.4);
        const cx = label === 0 ? 0.3 : 0.7;
        const cy = 0.5;
        this.points.push({
          x: clamp(cx + r * Math.cos(angle), 0.1, 0.9),
          y: clamp(cy + r * Math.sin(angle), 0.1, 0.9),
          label
        });
      }
      this.updateReadouts();
      sound.chime();
    });

    $('#ch4-spiral').addEventListener('click', () => {
      this.points = [];
      for (let i = 0; i < 100; i++) {
        const label = i % 2;
        const t = i * 0.1;
        const r = 0.15 + t * 0.3;
        const angle = t * 4 + (label === 0 ? 0 : Math.PI);
        this.points.push({
          x: clamp(0.5 + r * Math.cos(angle), 0.1, 0.9),
          y: clamp(0.5 + r * Math.sin(angle), 0.1, 0.9),
          label
        });
      }
      this.updateReadouts();
      sound.chime();
    });

    $('#ch4-xor').addEventListener('click', () => {
      this.points = [];
      const positions = [
        [0.25, 0.25, 0], [0.75, 0.75, 0],
        [0.25, 0.75, 1], [0.75, 0.25, 1]
      ];
      for (let rep = 0; rep < 8; rep++) {
        for (const [x, y, label] of positions) {
          this.points.push({
            x: clamp(x + rand(-0.05, 0.05), 0.1, 0.9),
            y: clamp(y + rand(-0.05, 0.05), 0.1, 0.9),
            label
          });
        }
      }
      this.updateReadouts();
      sound.chime();
    });

    // Network architecture
    $('#ch4-hidden').addEventListener('input', (e) => {
      this.hiddenUnits = parseInt(e.target.value, 10);
      $('#ch4-hidden-val').textContent = this.hiddenUnits;
      this.buildNetwork();
      this.computeDecisionGrid();
    });

    $('#ch4-layers').addEventListener('input', (e) => {
      this.hiddenLayers = parseInt(e.target.value, 10);
      $('#ch4-layers-val').textContent = this.hiddenLayers;
      this.buildNetwork();
      this.computeDecisionGrid();
    });

    // Training params
    $('#ch4-lr').addEventListener('input', (e) => {
      this.learningRate = parseFloat(e.target.value);
      $('#ch4-lr-val').textContent = this.learningRate.toFixed(2);
    });

    $('#ch4-batch').addEventListener('input', (e) => {
      this.batchSize = parseInt(e.target.value, 10);
      $('#ch4-batch-val').textContent = this.batchSize;
    });

    // Training controls
    $('#ch4-start').addEventListener('click', () => {
      this.training = !this.training;
      $('#ch4-start').textContent = this.training ? 'Pause Training' : 'Start Training';
      if (this.training) sound.chime();
      else sound.click();
    });

    $('#ch4-step').addEventListener('click', () => {
      if (this.points.length < 2) return;
      this.trainEpoch();
      sound.tone(500, 'sine', 0.03, 0.03);
    });

    $('#ch4-reset').addEventListener('click', () => {
      this.buildNetwork();
      this.epoch = 0;
      this.lossHistory = [];
      this.updateReadouts();
      this.computeDecisionGrid();
      sound.click();
    });
  }

  trainEpoch() {
    if (this.points.length < 2) return;

    // Shuffle and batch
    const shuffled = [...this.points].sort(() => rand(-1, 1));
    const batches = [];
    for (let i = 0; i < shuffled.length; i += this.batchSize) {
      batches.push(shuffled.slice(i, i + this.batchSize));
    }

    let totalLoss = 0;
    let totalCorrect = 0;
    let totalSamples = 0;

    for (const batch of batches) {
      const { loss, accuracy } = this.trainBatch(batch);
      totalLoss += loss * batch.length;
      totalCorrect += accuracy * batch.length;
    }

    this.epoch++;
    this.loss = totalLoss / this.points.length;
    this.accuracy = totalCorrect / this.points.length;
    this.lossHistory.push(this.loss);
    if (this.lossHistory.length > this.maxHistory) this.lossHistory.shift();

    this.computeDecisionGrid();
    this.updateReadouts();
  }

  updateReadouts() {
    $('#ch4-epoch').textContent = this.epoch;
    $('#ch4-loss').textContent = this.loss > 0 ? this.loss.toFixed(4) : '—';
    $('#ch4-acc').textContent = this.accuracy > 0 ? (this.accuracy * 100).toFixed(1) + '%' : '—';
    $('#ch4-points').textContent = this.points.length;
  }

  draw() {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    // Draw decision boundary
    if (this.decisionGrid) {
      this.drawDecisionBoundary();
    }

    // Draw points
    this.drawPoints();

    // Draw loss chart
    this.drawLossChart();
  }

  drawDecisionBoundary() {
    const { ctx } = this;
    const cellW = this.width / this.gridResolution;
    const cellH = this.height / this.gridResolution;

    // Shimmer animation for active decision boundary
    const shimmer = 0.5 + 0.5 * Math.sin(this.time * 4);

    for (let i = 0; i < this.gridResolution; i++) {
      for (let j = 0; j < this.gridResolution; j++) {
        const pred = this.decisionGrid[j][i];
        const alpha = Math.abs(pred - 0.5) * 0.7 * shimmer;
        ctx.fillStyle = pred > 0.5
          ? `rgba(0, 212, 170, ${alpha})`
          : `rgba(255, 107, 107, ${alpha})`;
        ctx.fillRect(i * cellW, j * cellH, cellW + 1, cellH + 1);
      }
    }

    // Decision boundary line (0.5 contour) with glow
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8 * shimmer;

    // Marching squares for 0.5 contour
    for (let i = 0; i < this.gridResolution; i++) {
      for (let j = 0; j < this.gridResolution; j++) {
        const v00 = this.decisionGrid[j][i];
        const v10 = this.decisionGrid[j][i + 1] ?? 0.5;
        const v01 = this.decisionGrid[j + 1]?.[i] ?? 0.5;
        const v11 = this.decisionGrid[j + 1]?.[i + 1] ?? 0.5;

        const cell = (v00 > 0.5 ? 1 : 0) | (v10 > 0.5 ? 2 : 0) | (v01 > 0.5 ? 4 : 0) | (v11 > 0.5 ? 8 : 0);
        if (cell === 0 || cell === 15) continue;

        const x = i * cellW;
        const y = j * cellH;

        ctx.beginPath();
        if (cell === 1 || cell === 14) { ctx.moveTo(x, y + cellH/2); ctx.lineTo(x + cellW/2, y); }
        if (cell === 2 || cell === 13) { ctx.moveTo(x + cellW/2, y); ctx.lineTo(x + cellW, y + cellH/2); }
        if (cell === 4 || cell === 11) { ctx.moveTo(x, y + cellH/2); ctx.lineTo(x + cellW/2, y + cellH); }
        if (cell === 8 || cell === 7) { ctx.moveTo(x + cellW/2, y + cellH); ctx.lineTo(x + cellW, y + cellH/2); }
        if (cell === 3) { ctx.moveTo(x, y + cellH/2); ctx.lineTo(x + cellW, y + cellH/2); }
        if (cell === 12) { ctx.moveTo(x, y + cellH/2); ctx.lineTo(x + cellW, y + cellH/2); }
        if (cell === 6) { ctx.moveTo(x + cellW/2, y); ctx.lineTo(x + cellW/2, y + cellH); }
        if (cell === 9) { ctx.moveTo(x + cellW/2, y); ctx.lineTo(x + cellW/2, y + cellH); }
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
  }

  drawPoints() {
    const { ctx } = this;
    for (const p of this.points) {
      const x = p.x * this.width;
      const y = p.y * this.height;
      const r = 8;

      ctx.fillStyle = p.label === 1 ? 'rgba(0, 212, 170, 0.9)' : 'rgba(255, 107, 107, 0.9)';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Animated training pulse on points during training
      if (this.training) {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
        ctx.fillStyle = p.label === 1 ? 'rgba(0, 212, 170, 0.4)' : 'rgba(255, 107, 107, 0.4)';
        ctx.shadowColor = p.label === 1 ? '#00d4aa' : '#ff6b6b';
        ctx.shadowBlur = 12 * pulse;
        ctx.beginPath();
        ctx.arc(x, y, r + 4 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.label === 1 ? '1' : '0', x, y);
    }
  }

  drawLossChart() {
    const ctx = this.lossCtx || this.ctx;
    const w = this.lossWidth || this.width;
    const h = this.lossHeight || this.height;
    const chartH = 100;
    const chartY = h - chartH - 10;
    const chartX = 10;
    const chartW = w - 20;

    // Background
    ctx.fillStyle = 'rgba(8, 10, 15, 0.9)';
    ctx.strokeStyle = '#232a36';
    ctx.lineWidth = 1;
    this.roundRect(ctx, chartX, chartY, chartW, chartH, 6);
    ctx.fill();
    ctx.stroke();

    if (this.lossHistory.length < 2) return;

    // Grid
    ctx.strokeStyle = 'rgba(0, 212, 170, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = chartY + chartH * i / 4;
      ctx.beginPath();
      ctx.moveTo(chartX, y);
      ctx.lineTo(chartX + chartW, y);
      ctx.stroke();
    }

    // Loss line
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    this.lossHistory.forEach((loss, i) => {
      const x = chartX + (i / (this.maxHistory - 1)) * chartW;
      const y = chartY + chartH - (loss / 1.5) * chartH; // Scale loss
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#5c6674';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Loss', chartX + 4, chartY + 12);
    ctx.textAlign = 'right';
    ctx.fillText('Epoch ' + this.epoch, chartX + chartW - 4, chartY + 12);
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
    // Pause loop when chapter is offscreen
    if (this.chapterEl && !this.chapterEl.classList.contains('visible')) {
      requestAnimationFrame(() => this.animate());
      return;
    }

    const now = performance.now();
    const dt = Math.min((now - (this.lastTime || now)) / 1000, 0.05);
    this.lastTime = now;
    this.time += dt;

    if (this.training) {
      this.trainEpoch();
    }
    this.draw();
    requestAnimationFrame(() => this.animate());
  }
}

// ==========================================================================
// Chapter 5: Custom Machine Builder
// ==========================================================================

class CustomMachineSim {
  constructor(canvas) {
    this.canvas = canvas;
    this.setupCanvas();
    this.setupState();
    this.bindControls();
    this.draw();
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
    // Logic inputs
    this.inputA = true;
    this.inputB = false;

    // Clock/thermal
    this.clockMHz = 1000;
    this.voltage = 1.1;
    this.cooling = 65;
    this.workload = 0.7;

    // Neural decision
    this.hiddenUnits = 4;
    this.decisionThreshold = 0.5;

    // Machine state
    this.running = false;
    this.time = 0;
    this.temperature = 45;
    this.throttleFactor = 1.0;
    this.logicOut = 0;
    this.neuralConf = 0;
    this.power = 0;
    this.throughput = 0;

    // Neural network (simple 2-input -> hidden -> 1-output)
    this.nnWeights1 = [];
    this.nnBiases1 = [];
    this.nnWeights2 = [];
    this.nnBiases2 = 0;
    this.initNeuralNet();

    this.history = { temp: [], power: [], throughput: [], confidence: [] };
    this.maxHistory = 120;
    this.chapterEl = this.canvas.closest('.chapter');
    this.layoutComponents();
  }

  initNeuralNet() {
    const inSize = 3; // logicOut, normalizedTemp, normalizedPower
    const hSize = this.hiddenUnits;
    const outSize = 1;

    this.nnWeights1 = [];
    for (let j = 0; j < hSize; j++) {
      this.nnWeights1.push(Array.from({ length: inSize }, () => rand(-1, 1) * Math.sqrt(2 / inSize)));
    }
    this.nnBiases1 = new Array(hSize).fill(0);

    this.nnWeights2 = [];
    for (let j = 0; j < outSize; j++) {
      this.nnWeights2.push(Array.from({ length: hSize }, () => rand(-1, 1) * Math.sqrt(2 / hSize)));
    }
    this.nnBiases2 = 0;
  }

  relu(x) { return Math.max(0, x); }
  sigmoid(x) {
    const xClamped = clamp(x, -700, 700);
    return safeNum(1 / (1 + Math.exp(-xClamped)));
  }

  forwardNeural(inputs) {
    // Hidden layer
    const hidden = [];
    for (let j = 0; j < this.hiddenUnits; j++) {
      let sum = this.nnBiases1[j];
      for (let k = 0; k < inputs.length; k++) {
        sum += this.nnWeights1[j][k] * inputs[k];
      }
      hidden.push(this.relu(sum));
    }

    // Output layer
    let out = this.nnBiases2;
    for (let j = 0; j < this.hiddenUnits; j++) {
      out += this.nnWeights2[0][j] * hidden[j];
    }
    return this.sigmoid(out);
  }

  layoutComponents() {
    const w = this.width, h = this.height;
    this.machineRect = {
      x: w * 0.1, y: h * 0.15,
      w: w * 0.4, h: h * 0.7
    };
    this.graphRect = {
      x: w * 0.55, y: h * 0.1,
      w: w * 0.4, h: h * 0.7
    };
  }

  // Presets
  presets = {
    'logic':   { inputA: true, inputB: false, clockMHz: 500, voltage: 0.9, cooling: 100, workload: 0.3, hiddenUnits: 4, threshold: 0.5 },
    'thermal': { inputA: false, inputB: true, clockMHz: 4000, voltage: 1.3, cooling: 30, workload: 0.9, hiddenUnits: 8, threshold: 0.5 },
    'neural':  { inputA: true, inputB: true, clockMHz: 2000, voltage: 1.0, cooling: 80, workload: 0.5, hiddenUnits: 12, threshold: 0.7 },
    'full':    { inputA: true, inputB: true, clockMHz: 3000, voltage: 1.1, cooling: 65, workload: 0.7, hiddenUnits: 8, threshold: 0.5 }
  };

  applyPreset(key) {
    const p = this.presets[key];
    if (!p) return;
    this.inputA = p.inputA;
    this.inputB = p.inputB;
    this.clockMHz = p.clockMHz;
    this.voltage = p.voltage;
    this.cooling = p.cooling;
    this.workload = p.workload;
    this.hiddenUnits = p.hiddenUnits;
    this.decisionThreshold = p.threshold;
    this.initNeuralNet();
    this.updateUI();
    sound.chime();
  }

  updateUI() {
    $('#ch5-input-a').checked = this.inputA;
    $('#ch5-input-b').checked = this.inputB;
    $('#ch5-a-val').textContent = this.inputA ? '1' : '0';
    $('#ch5-b-val').textContent = this.inputB ? '1' : '0';

    $('#ch5-clock').value = this.clockMHz;
    $('#ch5-clock-val').textContent = this.clockMHz.toFixed(0) + ' MHz';
    $('#ch5-voltage').value = this.voltage;
    $('#ch5-voltage-val').textContent = this.voltage.toFixed(2) + ' V';
    $('#ch5-cooling').value = this.cooling;
    $('#ch5-cooling-val').textContent = this.cooling + ' W';
    $('#ch5-workload').value = this.workload * 100;
    $('#ch5-workload-val').textContent = Math.round(this.workload * 100) + '%';

    $('#ch5-hidden').value = this.hiddenUnits;
    $('#ch5-hidden-val').textContent = this.hiddenUnits;
    $('#ch5-threshold').value = this.decisionThreshold;
    $('#ch5-threshold-val').textContent = this.decisionThreshold.toFixed(2);

    $('#ch5-run').textContent = this.running ? 'Pause Machine' : 'Run Machine';
    $('#ch5-run').setAttribute('data-training', this.running ? 'true' : 'false');

    this.updateShareURL();
  }

  bindControls() {
    // Logic inputs
    $('#ch5-input-a').addEventListener('change', () => {
      this.inputA = $('#ch5-input-a').checked;
      $('#ch5-a-val').textContent = this.inputA ? '1' : '0';
      this.updateMachine();
      sound.click();
    });
    $('#ch5-input-b').addEventListener('change', () => {
      this.inputB = $('#ch5-input-b').checked;
      $('#ch5-b-val').textContent = this.inputB ? '1' : '0';
      this.updateMachine();
      sound.click();
    });

    // Clock/thermal
    $('#ch5-clock').addEventListener('input', () => {
      this.clockMHz = parseFloat($('#ch5-clock').value);
      $('#ch5-clock-val').textContent = this.clockMHz.toFixed(0) + ' MHz';
      this.updateMachine();
      sound.tone(200 + this.clockMHz / 50, 'sine', 0.02, 0.02);
    });
    $('#ch5-voltage').addEventListener('input', () => {
      this.voltage = parseFloat($('#ch5-voltage').value);
      $('#ch5-voltage-val').textContent = this.voltage.toFixed(2) + ' V';
      this.updateMachine();
      sound.tone(400 + this.voltage * 200, 'sine', 0.02, 0.02);
    });
    $('#ch5-cooling').addEventListener('input', () => {
      this.cooling = parseInt($('#ch5-cooling').value, 10);
      $('#ch5-cooling-val').textContent = this.cooling + ' W';
      this.updateMachine();
    });
    $('#ch5-workload').addEventListener('input', () => {
      this.workload = parseInt($('#ch5-workload').value, 10) / 100;
      $('#ch5-workload-val').textContent = Math.round(this.workload * 100) + '%';
      this.updateMachine();
    });

    // Neural
    $('#ch5-hidden').addEventListener('input', () => {
      this.hiddenUnits = parseInt($('#ch5-hidden').value, 10);
      $('#ch5-hidden-val').textContent = this.hiddenUnits;
      this.initNeuralNet();
      this.updateMachine();
    });
    $('#ch5-threshold').addEventListener('input', () => {
      this.decisionThreshold = parseFloat($('#ch5-threshold').value);
      $('#ch5-threshold-val').textContent = this.decisionThreshold.toFixed(2);
      this.updateMachine();
    });

    // Run/Reset
    $('#ch5-run').addEventListener('click', () => {
      this.running = !this.running;
      $('#ch5-run').textContent = this.running ? 'Pause Machine' : 'Run Machine';
      $('#ch5-run').setAttribute('data-training', this.running ? 'true' : 'false');
      if (this.running) sound.chime();
      else sound.click();
    });
    $('#ch5-reset').addEventListener('click', () => {
      this.running = false;
      this.temperature = 45;
      this.throttleFactor = 1.0;
      this.epoch = 0;
      this.initNeuralNet();
      this.updateUI();
      this.updateMachine();
      sound.click();
    });

    // Presets
    $$('#ch5-preset-logic').forEach(btn => btn.addEventListener('click', () => { this.applyPreset('logic'); }));
    $$('#ch5-preset-thermal').forEach(btn => btn.addEventListener('click', () => { this.applyPreset('thermal'); }));
    $$('#ch5-preset-neural').forEach(btn => btn.addEventListener('click', () => { this.applyPreset('neural'); }));
    $$('#ch5-preset-full').forEach(btn => btn.addEventListener('click', () => { this.applyPreset('full'); }));

    // Share
    $('#ch5-copy-share').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText($('#ch5-share-url').value);
        const fb = $('#ch5-share-feedback');
        fb.textContent = 'Copied!';
        fb.className = 'share-feedback copied';
        setTimeout(() => { fb.textContent = ''; fb.className = 'share-feedback'; }, 1500);
        sound.click();
      } catch (e) {
        const fb = $('#ch5-share-feedback');
        fb.textContent = 'Copy failed';
        fb.className = 'share-feedback error';
        setTimeout(() => { fb.textContent = ''; fb.className = 'share-feedback'; }, 1500);
      }
    });

    this.updateUI();
  }

  updateMachine() {
    // Logic layer
    const andOut = this.inputA && this.inputB ? 1 : 0;
    const orOut = this.inputA || this.inputB ? 1 : 0;
    const xorOut = this.inputA !== this.inputB ? 1 : 0;
    this.logicOut = xorOut; // Use XOR as primary output

    // Thermal layer
    const C = 1e-9;
    const freqHz = this.clockMHz * 1e6;
    const dynamicPower = C * this.voltage * this.voltage * freqHz * this.workload;
    const staticPower = 0.5 * this.voltage * Math.exp((this.temperature - 25) / 50);
    this.power = safeNum((dynamicPower + staticPower) * 1e-3);

    const ambient = 25;
    const Rth = 1.0 / (this.cooling / 100);
    const targetTemp = ambient + this.power * Rth;
    const tau = 5.0;
    this.temperature += (targetTemp - this.temperature) * (1 - Math.exp(-1/60 / tau));

    const tjMax = 100;
    const throttleStart = 85;
    if (this.temperature <= throttleStart) {
      this.throttleFactor = 1.0;
    } else {
      this.throttleFactor = clamp(1.0 - (this.temperature - throttleStart) / (tjMax - throttleStart) * 0.7, 0.3, 1.0);
    }

    const baseIPC = this.clockMHz > 1000 ? 2.0 : (this.clockMHz > 100 ? 1.0 : 0.5);
    this.throughput = this.clockMHz * baseIPC * this.throttleFactor * this.workload;

    // Neural decision layer
    const normTemp = clamp((this.temperature - 25) / 75, 0, 1);
    const normPower = clamp(this.power / 100, 0, 1);
    const nnInput = [this.logicOut, normTemp, normPower];
    this.neuralConf = this.forwardNeural(nnInput);

    // Update history
    this.history.temp.push(this.temperature);
    this.history.power.push(this.power);
    this.history.throughput.push(this.throughput / 1000);
    this.history.confidence.push(this.neuralConf);
    for (const key of ['temp', 'power', 'throughput', 'confidence']) {
      if (this.history[key].length > this.maxHistory) this.history[key].shift();
    }

    this.updateReadouts();
    this.updateShareURL();
  }

  updateReadouts() {
    $('#ch5-and').textContent = (this.inputA && this.inputB) ? '1' : '0';
    $('#ch5-or').textContent = (this.inputA || this.inputB) ? '1' : '0';
    $('#ch5-xor').textContent = (this.inputA !== this.inputB) ? '1' : '0';

    $('#ch5-logic-out').textContent = this.logicOut;
    $('#ch5-temp').textContent = this.temperature.toFixed(0) + ' °C';
    $('#ch5-power').textContent = this.power.toFixed(1) + ' W';
    $('#ch5-neural-conf').textContent = (this.neuralConf * 100).toFixed(1) + '%';

    const stateEl = $('#ch5-state');
    if (this.running) {
      stateEl.textContent = 'Running';
      stateEl.setAttribute('data-state', 'running');
    } else {
      stateEl.textContent = 'Idle';
      stateEl.setAttribute('data-state', 'idle');
    }

    // Update gate visual states
    $$('#ch5-basic-outputs .gate-output').forEach(el => el.classList.remove('high'));
    if (this.inputA && this.inputB) $('#ch5-and').parentElement.classList.add('high');
    if (this.inputA || this.inputB) $('#ch5-or').parentElement.classList.add('high');
    if (this.inputA !== this.inputB) $('#ch5-xor').parentElement.classList.add('high');
  }

  updateShareURL() {
    const state = {
      a: this.inputA ? 1 : 0,
      b: this.inputB ? 1 : 0,
      c: Math.round(this.clockMHz),
      v: Math.round(this.voltage * 100) / 100,
      cl: this.cooling,
      w: Math.round(this.workload * 100),
      h: this.hiddenUnits,
      t: Math.round(this.decisionThreshold * 100) / 100
    };
    const hash = '#' + btoa(JSON.stringify(state)).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' })[c]);
    if (location.hash !== hash) {
      history.replaceState(null, '', hash);
    }
    $('#ch5-share-url').value = location.origin + location.pathname + hash;
  }

  static parseHashState() {
    try {
      const hash = location.hash;
      if (!hash || !hash.startsWith('#')) return null;
      const b64 = hash.slice(1).replace(/[-_]/g, c => ({ '-': '+', '_': '/' })[c]) + '==';
      const json = JSON.parse(atob(b64));
      // Validate fields
      if (typeof json.a !== 'number' || typeof json.b !== 'number') return null;
      if (typeof json.c !== 'number' || json.c < 1 || json.c > 5000) return null;
      if (typeof json.v !== 'number' || json.v < 0.6 || json.v > 1.5) return null;
      if (typeof json.cl !== 'number' || json.cl < 15 || json.cl > 250) return null;
      if (typeof json.w !== 'number' || json.w < 0 || json.w > 100) return null;
      if (typeof json.h !== 'number' || json.h < 2 || json.h > 32) return null;
      if (typeof json.t !== 'number' || json.t < 0.1 || json.t > 0.9) return null;
      return json;
    } catch (e) {
      return null;
    }
  }

  hydrateFromHash() {
    const state = CustomMachineSim.parseHashState();
    if (!state) return false;

    this.inputA = state.a === 1;
    this.inputB = state.b === 1;
    this.clockMHz = state.c;
    this.voltage = state.v;
    this.cooling = state.cl;
    this.workload = state.w / 100;
    this.hiddenUnits = state.h;
    this.decisionThreshold = state.t;
    this.initNeuralNet();
    this.updateUI();
    this.updateMachine();
    return true;
  }

  draw() {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    this.drawMachine();
    this.drawGraphs();
    this.drawLegend();
  }

  drawMachine() {
    const { ctx } = this;
    const r = this.machineRect;

    // Machine package outline with running pulse
    const pulse = this.running ? 0.5 + 0.5 * Math.sin(this.time * 4) : 1;
    ctx.fillStyle = '#161c26';
    ctx.strokeStyle = this.running ? '#00d4aa' : '#333e4d';
    ctx.lineWidth = this.running ? 3 : 2;
    if (this.running) {
      ctx.shadowColor = 'rgba(0, 212, 170, 0.4)';
      ctx.shadowBlur = 12 * pulse;
    }
    this.roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Logic section (top left)
    const logicX = r.x + 20;
    const logicY = r.y + 20;
    const logicW = r.w - 40;
    const logicH = 60;

    ctx.fillStyle = '#0f151d';
    ctx.strokeStyle = '#333e4d';
    ctx.lineWidth = 1;
    this.roundRect(ctx, logicX, logicY, logicW, logicH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#8c96a4';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('LOGIC LAYER', logicX + 10, logicY + 18);

    // Input indicators
    const inputY = logicY + 40;
    this.drawIoIndicator(logicX + 20, inputY, this.inputA, 'A');
    this.drawIoIndicator(logicX + 60, inputY, this.inputB, 'B');

    // Gate outputs
    const gateY = logicY + 40;
    const gateX = logicX + 120;
    const gateLabels = ['AND', 'OR', 'XOR'];
    const gateVals = [this.inputA && this.inputB, this.inputA || this.inputB, this.inputA !== this.inputB];
    gateLabels.forEach((label, i) => {
      const gx = gateX + i * 50;
      this.drawIoIndicator(gx, gateY, gateVals[i], label);
    });

    // Thermal section (middle)
    const thermY = r.y + 100;
    ctx.fillStyle = '#0f151d';
    ctx.strokeStyle = '#333e4d';
    ctx.lineWidth = 1;
    this.roundRect(ctx, logicX, thermY, logicW, 70, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#8c96a4';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('THERMAL LAYER', logicX + 10, thermY + 18);

    // Thermal bar with glow when hot
    const barX = logicX + 20;
    const barY = thermY + 35;
    const barW = logicW - 40;
    const barH = 12;
    const heatRatio = clamp((this.temperature - 25) / 75, 0, 1);

    ctx.fillStyle = '#232a36';
    ctx.fillRect(barX, barY, barW, barH);
    const heatColor = heatRatio < 0.4 ? '#00d4aa' : (heatRatio < 0.7 ? '#ffb84d' : '#ff6b6b');
    ctx.fillStyle = heatColor;
    ctx.fillRect(barX, barY, barW * heatRatio, barH);
    ctx.strokeStyle = '#333e4d';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Thermal glow when hot
    if (heatRatio > 0.7) {
      ctx.shadowColor = heatRatio > 0.9 ? 'rgba(255, 107, 107, 0.5)' : 'rgba(255, 184, 77, 0.4)';
      ctx.shadowBlur = 10 * (heatRatio - 0.7) / 0.3;
      ctx.strokeStyle = heatColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barW * heatRatio, barH);
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#8c96a4';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(this.temperature.toFixed(0) + '°C', logicX + logicW - 10, thermY + 50);

    // Neural section (bottom)
    const neuralY = r.y + 190;
    ctx.fillStyle = '#0f151d';
    ctx.strokeStyle = '#333e4d';
    ctx.lineWidth = 1;
    this.roundRect(ctx, logicX, neuralY, logicW, 60, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#8c96a4';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('NEURAL DECISION', logicX + 10, neuralY + 18);

    // Confidence bar with threshold indicator
    const confBarX = logicX + 20;
    const confBarY = neuralY + 35;
    const confBarW = logicW - 40;
    const confBarH = 12;

    ctx.fillStyle = '#232a36';
    ctx.fillRect(confBarX, confBarY, confBarW, confBarH);
    const confColor = this.neuralConf > this.decisionThreshold ? '#00d4aa' : '#ff6b6b';
    ctx.fillStyle = confColor;
    ctx.fillRect(confBarX, confBarY, confBarW * this.neuralConf, confBarH);
    ctx.strokeStyle = '#333e4d';
    ctx.lineWidth = 1;
    ctx.strokeRect(confBarX, confBarY, confBarW, confBarH);

    // Threshold line on confidence bar
    const thresholdX = confBarX + confBarW * this.decisionThreshold;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(thresholdX - 1, confBarY - 2, 2, confBarH + 4);

    ctx.fillStyle = '#8c96a4';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText((this.neuralConf * 100).toFixed(0) + '%', logicX + logicW - 10, neuralY + 50);

    // Machine label
    ctx.fillStyle = '#8c96a4';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.running ? 'RUNNING' : 'IDLE', r.x + r.w / 2, r.y + r.h - 15);
  }

  drawIoIndicator(x, y, high, label) {
    const { ctx } = this;
    const r = 10;

    ctx.fillStyle = high ? 'rgba(0, 212, 170, 0.2)' : '#161c26';
    ctx.strokeStyle = high ? '#00d4aa' : '#333e4d';
    ctx.lineWidth = high ? 2.5 : 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (high) {
      ctx.shadowColor = high ? '#00d4aa' : '#333e4d';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#00d4aa';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = high ? '#00d4aa' : '#5c6674';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  }

  drawGraphs() {
    const { ctx } = this;
    const g = this.graphRect;

    ctx.fillStyle = '#080a0f';
    ctx.strokeStyle = '#232a36';
    ctx.lineWidth = 1;
    this.roundRect(ctx, g.x, g.y, g.w, g.h, 8);
    ctx.fill();
    ctx.stroke();

    // Grid
    ctx.strokeStyle = 'rgba(0, 212, 170, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = g.y + g.h * i / 4;
      ctx.beginPath();
      ctx.moveTo(g.x, y);
      ctx.lineTo(g.x + g.w, y);
      ctx.stroke();
    }
    for (let i = 1; i < 5; i++) {
      const x = g.x + g.w * i / 5;
      ctx.beginPath();
      ctx.moveTo(x, g.y);
      ctx.lineTo(x, g.y + g.h);
      ctx.stroke();
    }

    // Draw lines
    const colors = {
      temp: '#ff6b6b',
      power: '#ffb84d',
      throughput: '#00d4aa',
      confidence: '#a88cff'
    };
    const scales = {
      temp: { min: 20, max: 110 },
      power: { min: 0, max: 100 },
      throughput: { min: 0, max: 20 },
      confidence: { min: 0, max: 1 }
    };

    for (const key of ['temp', 'power', 'throughput', 'confidence']) {
      const data = this.history[key];
      if (data.length < 2) continue;
      const scale = scales[key];
      ctx.strokeStyle = colors[key];
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      data.forEach((val, i) => {
        const x = g.x + (i / (this.maxHistory - 1)) * g.w;
        const y = g.y + g.h - ((val - scale.min) / (scale.max - scale.min)) * g.h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = '#5c6674';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('110°C', g.x - 8, g.y + 12);
    ctx.fillText('100W', g.x - 8, g.y + g.h * 0.25 + 4);
    ctx.fillText('20 GIPS', g.x - 8, g.y + g.h * 0.5 + 4);
    ctx.fillText('1.0', g.x - 8, g.y + g.h * 0.75 + 4);
  }

  drawLegend() {
    const { ctx } = this;
    const g = this.graphRect;
    const items = [
      { label: 'Temp', color: '#ff6b6b' },
      { label: 'Power', color: '#ffb84d' },
      { label: 'Throughput', color: '#00d4aa' },
      { label: 'Confidence', color: '#a88cff' }
    ];

    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    items.forEach((item, i) => {
      const x = g.x + 10;
      const y = g.y + 20 + i * 20;
      ctx.fillStyle = item.color;
      ctx.fillRect(x, y - 8, 16, 4);
      ctx.fillStyle = '#8c96a4';
      ctx.fillText(item.label, x + 22, y);
    });
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
    // Pause loop when chapter is offscreen
    if (this.chapterEl && !this.chapterEl.classList.contains('visible')) {
      requestAnimationFrame(() => this.animate());
      return;
    }

    const now = performance.now();
    const dt = Math.min((now - (this.lastTime || now)) / 1000, 0.05);
    this.lastTime = now;
    this.time += dt;

    if (this.running) {
      this.updateMachine();
    }

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

let machineSim = null;

// ==========================================================================
// Main Initialization
// ==========================================================================

function init() {
  const ch1Canvas = $('#ch1-canvas');
  const ch2Canvas = $('#ch2-canvas');
  const ch3Canvas = $('#ch3-canvas');
  const ch4Canvas = $('#ch4-canvas');
  const ch5Canvas = $('#ch5-canvas');

  if (ch1Canvas) new CircuitSim(ch1Canvas);
  if (ch2Canvas) new LogicSim(ch2Canvas);
  if (ch3Canvas) new CPUSim(ch3Canvas);
  if (ch4Canvas) new NeuralNetSim(ch4Canvas);
  if (ch5Canvas) machineSim = new CustomMachineSim(ch5Canvas);

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

  // Hydrate machine state from URL hash if present
  if (machineSim) {
    machineSim.hydrateFromHash();
  }

  console.log('Inside a Machine: From Electron to AI — Initialized (Chapters 1-5)');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { CircuitSim, LogicSim, CPUSim, NeuralNetSim, CustomMachineSim, ChapterNav, SoundEngine, sound };