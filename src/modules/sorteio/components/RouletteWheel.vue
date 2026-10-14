<template>
  <div ref="wrap" class="rw-wrap">

    <!-- Ponteiro (SVG original app-sorteos, usa currentColor para compatibilidade de temas) -->
    <div class="rw-pointer" ref="pointerEl">
      <svg width="100%" height="100%" viewBox="0 0 273 147" xmlns="http://www.w3.org/2000/svg">
        <path fill="currentColor" d="M196.3 0h10.5l1 .25c10.06 1.9 19.63 5.06 28.1 10.93 11.28 7.55 19.66 18.43 25.12 30.78 1.9 6.4 4.06 12.23 4 19.04-.1 5.3.3 10.7-.34 15.97-2.18 14.1-9.08 27.46-19.38 37.33-10.03 10-23.32 16.4-37.33 18.4-4.95.54-10 .3-14.97.3-6.4-.02-13.06-2.82-19.2-4.68-54.98-17.5-109.95-35.08-164.96-52.5C4.7 74.7 2.14 73.33 0 69.5v-6.26c1.47-1.93 2.94-3.95 5.34-4.77C64.47 39.78 123.84 20.77 183 2c4.3-1.15 8.9-1.2 13.3-2z"/>
        <path opacity=".2" d="M261.02 41.96c6.74 9.2 10.54 20.04 11.98 31.3V88c-1.9 14.78-8.25 28.63-18.78 39.24-11 11.34-25.83 18.16-41.52 19.78h-12.65c-3.8-.6-7.57-1.4-11.22-2.63C132.4 126.43 76 108.37 19.55 90.5c-3.4-1.22-8.1-1.62-10.12-4.94-2.2-3.14-1.5-6.3-.6-9.73 55.02 17.4 110 35 164.97 52.5 6.14 1.85 12.8 4.65 19.2 4.66 4.97 0 10.02.24 14.97-.3 14-2 27.3-8.4 37.33-18.4 10.3-9.87 17.2-23.24 19.38-37.33.63-5.27.23-10.66.34-15.97.06-6.8-2.1-12.64-4-19.04v.01z"/>
        <ellipse stroke="none" ry="25" rx="25" cy="65" cx="199.124" fill="#ffffff"/>
      </svg>
    </div>

    <!-- Canvas wheel -->
    <canvas
      ref="canvas"
      class="rw-canvas"
      :class="{ 'rw-canvas--spin': spinning }"
      @click="onCanvasClick"
    />

    <!-- Center hub -->
    <div class="rw-hub" @click="onCanvasClick">
      <transition name="rw-hub-icon" mode="out-in">
        <v-icon v-if="!spinning" key="play" size="16" color="#8B5CF6">mdi-play</v-icon>
        <div v-else key="spin" class="rw-hub-spinner" />
      </transition>
    </div>

    <!-- Confetti burst -->
    <div v-if="showConfetti" class="rw-confetti-container" aria-hidden="true">
      <div
        v-for="i in 30"
        :key="i"
        class="rw-confetti-dot"
        :style="getConfettiStyle(i)"
      />
    </div>

    <!-- Winner overlay -->
    <transition name="rw-winner">
      <div v-if="showWinnerCard && winnerVisible" class="rw-winner-overlay" @click="dismissWinner">
        <div class="rw-winner-card" :style="winnerCardStyle">
          <div class="rw-winner-trophy">🏆</div>
          <div class="rw-winner-label">SORTEADO!</div>
          <div class="rw-winner-name">{{ currentWinner }}</div>
          <button class="rw-winner-btn" @click.stop="dismissWinner">OK</button>
        </div>
      </div>
    </transition>

  </div>
</template>

<script>
// Palette inspired by app-sorteos.com — vivid but not neon
const PALETTE = [
  '#FF6B6B', // coral red
  '#4ECDC4', // teal
  '#5B9BD5', // cornflower blue
  '#FDCB6E', // amber
  '#A29BFE', // lavender
  '#2ecc71', // emerald green
  '#FD79A8', // pink
  '#0984E3', // bright blue
  '#6C5CE7', // purple
  '#00B894', // mint teal
  '#E17055', // terracotta
  '#74B9FF', // sky blue
  '#ffeaa7', // pale yellow
  '#55efc4', // pale teal
  '#fd9644', // orange
  '#a55eea', // violet
  '#fc5c65', // crimson
  '#45aaf2', // azure
  '#fed330', // golden yellow
  '#26de81', // spring green
];

const CONFETTI_COLORS = [
  '#FF6B6B', '#4ECDC4', '#5B9BD5', '#FDCB6E',
  '#A29BFE', '#FD79A8', '#0984E3', '#6C5CE7',
];

export default {
  name: 'RouletteWheel',
  props: {
    items:          { type: Array,   default: () => [] },
    disabled:       { type: Boolean, default: false },
    showWinnerCard: { type: Boolean, default: true },
  },
  emits: ['winner'],

  data: () => ({
    spinning:       false,
    winnerVisible:  false,
    currentWinner:  null,
    showConfetti:   false,
    rotation:       0,
    size:           400,
    _raf:           null,
    _idleRaf:       null,
    _ro:            null,
    _confettiTimer: null,
  }),

  computed: {
    winnerCardStyle() {
      if (!this.currentWinner) return {};
      const idx   = this.items.indexOf(this.currentWinner);
      const color = idx >= 0 ? PALETTE[idx % PALETTE.length] : '#5B9BD5';
      return { '--winner-color': color };
    },
  },

  watch: {
    items() { this.$nextTick(() => this.render()); },
  },

  methods: {
    // ── Resize ───────────────────────────────────────────────────────────
    handleResize() {
      const wrap = this.$refs.wrap;
      if (!wrap) return;
      const s = Math.min(wrap.clientWidth, wrap.clientHeight, 560);
      if (s < 60) return;
      this.size = s;

      wrap.style.setProperty('--rw-size', s + 'px');

      const canvas = this.$refs.canvas;
      if (canvas) {
        canvas.width  = s;
        canvas.height = s;
      }
      this.render();
    },

    // ── Render ───────────────────────────────────────────────────────────
    render() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const s   = canvas.width;
      const cx  = s / 2;
      const cy  = s / 2;
      const n   = this.items.length;

      const rimWidth = Math.max(12, s * 0.035);
      const radius   = s / 2 - 4;
      const segR     = radius - rimWidth;

      ctx.clearRect(0, 0, s, s);

      if (n === 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, segR, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fill();
        return;
      }

      const seg = (2 * Math.PI) / n;

      // ── Segments ──────────────────────────────────────────────────────
      for (let i = 0; i < n; i++) {
        const sa    = this.rotation + i * seg;
        const ea    = sa + seg;
        const color = PALETTE[i % PALETTE.length];

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, segR, sa, ea);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // White divider line
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, segR, sa, ea);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255,255,255,0.80)';
        ctx.lineWidth   = 2;
        ctx.stroke();

        // ── Text ──────────────────────────────────────────────────────
        const midAngle = sa + seg / 2;
        const text     = String(this.items[i]);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(midAngle);

        const arcLen   = segR * seg;
        const fontSize = Math.max(9, Math.min(18, arcLen * 0.14));
        ctx.font         = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
        ctx.fillStyle    = '#ffffff';
        ctx.textAlign    = 'right';
        ctx.textBaseline = 'middle';
        ctx.shadowColor  = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur   = 3;

        const maxW = segR * 0.72;
        let display = text;
        while (ctx.measureText(display).width > maxW && display.length > 2) {
          display = display.slice(0, -2) + '…';
        }
        ctx.fillText(display, segR - 10, 0);
        ctx.restore();
      }

      // ── Inner edge shadow ─────────────────────────────────────────────
      ctx.beginPath();
      ctx.arc(cx, cy, segR, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth   = 3;
      ctx.stroke();

      // ── White outer rim ───────────────────────────────────────────────
      ctx.beginPath();
      ctx.arc(cx, cy, segR + rimWidth / 2, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255,255,255,0.97)';
      ctx.lineWidth   = rimWidth;
      ctx.stroke();

      // Subtle rim inner shadow
      ctx.beginPath();
      ctx.arc(cx, cy, segR + 3, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth   = 4;
      ctx.stroke();

      // Outer edge
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 1, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(200,200,200,0.60)';
      ctx.lineWidth   = 2;
      ctx.stroke();

      // ── White dots at segment junctions (end of divider lines) ──────
      const dotR = Math.max(3, s * 0.009);
      for (let i = 0; i < n; i++) {
        const a  = this.rotation + i * seg;
        const dx = cx + segR * Math.cos(a);
        const dy = cy + segR * Math.sin(a);

        const dg = ctx.createRadialGradient(
          dx - dotR * 0.3, dy - dotR * 0.3, 0,
          dx, dy, dotR,
        );
        dg.addColorStop(0,   '#ffffff');
        dg.addColorStop(0.6, '#e8e8e8');
        dg.addColorStop(1,   '#cccccc');

        ctx.beginPath();
        ctx.arc(dx, dy, dotR, 0, 2 * Math.PI);
        ctx.fillStyle   = dg;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth   = 0.5;
        ctx.stroke();
      }

      // ── Center hub backing ────────────────────────────────────────────
      const hr      = segR * 0.13;
      const hubGrad = ctx.createRadialGradient(
        cx - hr * 0.35, cy - hr * 0.35, 0, cx, cy, hr,
      );
      hubGrad.addColorStop(0,   '#ffffff');
      hubGrad.addColorStop(0.6, '#f5f5f5');
      hubGrad.addColorStop(1,   '#e0e0e0');

      ctx.beginPath();
      ctx.arc(cx, cy, hr, 0, 2 * Math.PI);
      ctx.fillStyle   = hubGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth   = 2;
      ctx.stroke();
    },

    // ── Spin ─────────────────────────────────────────────────────────────
    onCanvasClick() {
      if (!this.spinning && !this.disabled) this.spin();
    },

    spin() {
      if (this.spinning || this.disabled || this.items.length === 0) return;
      const winnerIdx = Math.floor(Math.random() * this.items.length);
      const duration  = 6000 + Math.random() * 3000;
      this.$emit('spin-start', winnerIdx, duration);
      this._doSpin(winnerIdx, duration);
    },

    // Spin to a specific winner index (used by popup for sync)
    spinTo(winnerIdx, duration) {
      if (this.spinning || this.items.length === 0) return;
      this._doSpin(winnerIdx, duration);
    },

    _doSpin(winnerIdx, duration) {
      const n   = this.items.length;
      const seg = (2 * Math.PI) / n;

      const pointer  = 0;
      const midAngle = (winnerIdx + 0.5) * seg;
      const target   = ((pointer - midAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

      const current = ((this.rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      let delta     = target - current;
      if (delta < 0.2) delta += 2 * Math.PI;

      const extraSpins = (8 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
      const totalDelta = delta + extraSpins;
      if (!duration) duration = 6000 + Math.random() * 3000;
      const startRot   = this.rotation;
      const startTime  = performance.now();

      this.spinning      = true;
      this.winnerVisible = false;
      this.currentWinner = null;
      this.showConfetti  = false;
      this._stopIdleSpin();

      const easeOut = (t) => 1 - Math.pow(1 - t, 5);

      let prevFrameTime = startTime;
      let prevFrameRot  = this.rotation;

      const animate = (now) => {
        const dt       = Math.max(1, now - prevFrameTime);
        const prevRot  = prevFrameRot;
        const elapsed  = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        this.rotation = startRot + totalDelta * easeOut(progress);
        this.render();
        this._updatePointer(dt, prevRot, seg);

        prevFrameTime = now;
        prevFrameRot  = this.rotation;

        if (progress < 1) {
          this._raf = requestAnimationFrame(animate);
        } else {
          this.spinning      = false;
          this.currentWinner = this.items[winnerIdx];
          this.winnerVisible = true;
          this.showConfetti  = true;
          if (this._confettiTimer) clearTimeout(this._confettiTimer);
          this._confettiTimer = setTimeout(() => { this.showConfetti = false; }, 2000);
          this.$emit('winner', this.currentWinner, winnerIdx);
          this._startPointerSettle();
          this._startIdleSpin();
        }
      };

      this._raf = requestAnimationFrame(animate);
    },

    dismissWinner() {
      this.winnerVisible = false;
    },

    reset() {
      if (this._raf)           { cancelAnimationFrame(this._raf); this._raf = null; }
      if (this._confettiTimer) { clearTimeout(this._confettiTimer); this._confettiTimer = null; }
      if (this._pointerRaf)    { cancelAnimationFrame(this._pointerRaf); this._pointerRaf = null; }
      this._stopIdleSpin();
      this.spinning      = false;
      this.winnerVisible = false;
      this.currentWinner = null;
      this.showConfetti  = false;
      this._pointerPos = 0;
      this._pointerVel = 0;
      this._applyPointerTransform();
      this._startIdleSpin();
    },

    getConfettiStyle(i) {
      const color  = CONFETTI_COLORS[(i - 1) % CONFETTI_COLORS.length];
      const angle  = ((i - 1) / 30) * 360;
      const delay  = ((i - 1) % 6) * 0.07;
      const size   = 5 + (i % 4) * 3;
      return {
        background: color,
        width:      size + 'px',
        height:     size + 'px',
        '--ca':     angle + 'deg',
        '--delay':  delay + 's',
      };
    },

    _applyPointerTransform() {
      const el = this.$refs.pointerEl;
      if (el) el.style.setProperty('--pointer-rot', `${this._pointerPos.toFixed(2)}deg`);
    },

    _updatePointer(dt, prevRot, seg) {
      if (!seg || this.items.length === 0) return;
      const dtSec = Math.min(dt, 50) / 1000;

      // Detect boundary crossing: each time Math.floor(rotation/seg) increments
      const curIdx  = Math.floor(this.rotation / seg);
      const prevIdx = Math.floor(prevRot / seg);
      if (curIdx !== prevIdx) {
        const angSpeed = Math.abs((this.rotation - prevRot) / dtSec);
        // Impulse upward (negative = tip snaps up), stronger when spinning faster
        const impulse = -(12 + Math.min(angSpeed * 10, 38));
        this._pointerVel += impulse;
      }

      // Slight downward tilt while spinning (tip follows the wheel drag)
      const angSpeed   = Math.abs((this.rotation - prevRot) / dtSec);
      const targetTilt = this.spinning ? Math.min(angSpeed * 1.0, 6) : 0;

      // Spring-damper: k=280 (stiff), d=22 (underdamped for oscillation)
      const acc = (targetTilt - this._pointerPos) * 280 - this._pointerVel * 22;
      this._pointerVel += acc * dtSec;
      this._pointerPos += this._pointerVel * dtSec;

      this._applyPointerTransform();
    },

    _startIdleSpin() {
      if (this._idleRaf) return;
      const IDLE_RPM  = 0.8;
      const IDLE_RADS = (IDLE_RPM * 2 * Math.PI) / 60;
      let prev = performance.now();
      const tick = (now) => {
        if (this.spinning) { this._idleRaf = null; return; }
        const dt = Math.min(now - prev, 50) / 1000;
        prev = now;
        this.rotation += IDLE_RADS * dt;
        this.render();
        this._idleRaf = requestAnimationFrame(tick);
      };
      this._idleRaf = requestAnimationFrame(tick);
    },

    _stopIdleSpin() {
      if (this._idleRaf) { cancelAnimationFrame(this._idleRaf); this._idleRaf = null; }
    },

    _startPointerSettle() {
      if (this._pointerRaf) cancelAnimationFrame(this._pointerRaf);
      let prev = performance.now();
      const settle = (now) => {
        const dt    = Math.min(now - prev, 50);
        prev        = now;
        const dtSec = dt / 1000;
        const acc   = (0 - this._pointerPos) * 280 - this._pointerVel * 22;
        this._pointerVel += acc * dtSec;
        this._pointerPos += this._pointerVel * dtSec;
        this._applyPointerTransform();
        if (Math.abs(this._pointerPos) > 0.05 || Math.abs(this._pointerVel) > 0.5) {
          this._pointerRaf = requestAnimationFrame(settle);
        } else {
          this._pointerPos = 0;
          this._pointerVel = 0;
          this._applyPointerTransform();
          this._pointerRaf = null;
        }
      };
      this._pointerRaf = requestAnimationFrame(settle);
    },
  },

  mounted() {
    this._pointerPos = 0;
    this._pointerVel = 0;
    this._pointerRaf = null;
    this.$nextTick(() => {
      this.handleResize();
      this._ro = new ResizeObserver(() => this.handleResize());
      if (this.$refs.wrap) this._ro.observe(this.$refs.wrap);
      this._startIdleSpin();
    });
  },

  unmounted() {
    if (this._ro)            this._ro.disconnect();
    if (this._raf)           cancelAnimationFrame(this._raf);
    if (this._idleRaf)       cancelAnimationFrame(this._idleRaf);
    if (this._confettiTimer) clearTimeout(this._confettiTimer);
    if (this._pointerRaf)    cancelAnimationFrame(this._pointerRaf);
  },
};
</script>

<style scoped>
.rw-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  overflow: visible;
}


/* Pointer — 273×147 SVG: tip at left, circle at 73% from left, circle cy=44.2% from top.
   left: 50% + s*0.455 → tip sits on the rim; circle extends right of canvas.
   Parent must have overflow:visible for the circle to show.
   transform-origin at circle center so rotation pivots there (HDD-needle effect). */
.rw-pointer {
  position: absolute;
  left: calc(50% + var(--rw-size, 300px) * 0.455);
  top: 50%;
  transform: translateY(-44.2%) rotate(var(--pointer-rot, 0deg));
  transform-origin: 73% 44.2%;
  z-index: 10;
  width: calc(var(--rw-size, 300px) * 0.17);
  height: calc(var(--rw-size, 300px) * 0.092);
  color: #1e1040;
}

/* Canvas */
.rw-canvas {
  border-radius: 50%;
  cursor: pointer;
  display: block;
  box-shadow:
    0 16px 48px rgba(0,0,0,0.50),
    0 6px 16px rgba(0,0,0,0.30);
  transition: filter 0.2s;
  z-index: 1;
}
.rw-canvas:hover   { filter: brightness(1.05); }
.rw-canvas--spin   { cursor: default; filter: none; }

/* Center hub */
.rw-hub {
  position: absolute;
  width: calc(var(--rw-size, 300px) * 0.13);
  height: calc(var(--rw-size, 300px) * 0.13);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #ffffff, #e0e0e0);
  box-shadow:
    0 3px 10px rgba(0,0,0,0.35),
    inset 0 1px 3px rgba(255,255,255,0.9),
    inset 0 -1px 3px rgba(0,0,0,0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 5;
  transition: transform 0.12s;
}
.rw-hub:hover { transform: scale(1.08); }

.rw-hub-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0,0,0,0.12);
  border-top-color: #555;
  border-radius: 50%;
  animation: rw-spin 0.7s linear infinite;
}
@keyframes rw-spin { to { transform: rotate(360deg); } }

.rw-hub-icon-enter-active, .rw-hub-icon-leave-active { transition: opacity 0.15s, transform 0.15s; }
.rw-hub-icon-enter-from { opacity: 0; transform: scale(0.5); }
.rw-hub-icon-leave-to   { opacity: 0; transform: scale(0.5); }

/* Confetti */
.rw-confetti-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 25;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rw-confetti-dot {
  position: absolute;
  border-radius: 50%;
  animation: rw-confetti-burst 1.6s var(--delay, 0s) cubic-bezier(0.22,0.61,0.36,1) forwards;
}
@keyframes rw-confetti-burst {
  0%   { transform: rotate(var(--ca)) translateY(0)     scale(1);    opacity: 1; }
  60%  { opacity: 1; }
  100% { transform: rotate(var(--ca)) translateY(-170px) scale(0.4); opacity: 0; }
}

/* Winner overlay */
.rw-winner-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.55);
  border-radius: 50%;
  z-index: 20;
  cursor: pointer;
}

.rw-winner-card {
  background: linear-gradient(135deg, var(--winner-color, #5B9BD5) 0%, rgba(0,0,0,0.65) 100%);
  border: 2px solid rgba(255,255,255,0.35);
  border-radius: 20px;
  padding: 20px 28px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.10);
  max-width: 80%;
}

.rw-winner-trophy {
  font-size: 38px;
  line-height: 1;
  margin-bottom: 8px;
  animation: rw-trophy-bounce 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards;
}
@keyframes rw-trophy-bounce {
  0%   { transform: scale(0) rotate(-20deg); }
  60%  { transform: scale(1.25) rotate(5deg); }
  100% { transform: scale(1) rotate(0deg); }
}

.rw-winner-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.20em;
  color: rgba(255,255,255,0.75);
  text-transform: uppercase;
  margin-bottom: 6px;
}

.rw-winner-name {
  font-size: clamp(15px, 4vw, 26px);
  font-weight: 800;
  color: #ffffff;
  text-shadow: 0 2px 8px rgba(0,0,0,0.50);
  word-break: break-word;
  margin-bottom: 16px;
  animation: rw-name-in 0.5s 0.15s cubic-bezier(0.34,1.56,0.64,1) both;
}
@keyframes rw-name-in {
  from { opacity: 0; transform: translateY(12px) scale(0.9); }
  to   { opacity: 1; transform: translateY(0)    scale(1);   }
}

.rw-winner-btn {
  background: rgba(255,255,255,0.22);
  border: 1.5px solid rgba(255,255,255,0.45);
  border-radius: 24px;
  color: white;
  font-size: 13px;
  font-weight: 700;
  padding: 7px 24px;
  cursor: pointer;
  letter-spacing: 0.05em;
  transition: background 0.15s, transform 0.10s;
}
.rw-winner-btn:hover {
  background: rgba(255,255,255,0.32);
  transform: scale(1.04);
}

/* Winner transition */
.rw-winner-enter-active {
  animation: rw-overlay-in  0.45s cubic-bezier(0.34,1.56,0.64,1) forwards;
}
.rw-winner-leave-active {
  animation: rw-overlay-out 0.20s ease-in forwards;
}
@keyframes rw-overlay-in  { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
@keyframes rw-overlay-out { from { opacity: 1; } to { opacity: 0; } }

</style>
