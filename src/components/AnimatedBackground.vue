<template>
  <div class="anim-bg" aria-hidden="true">
    <canvas v-if="variant === 'three'" ref="threeCanvas" class="anim-bg-layer" />
    <div v-else-if="variant === 'gsap'" ref="gsapLayer" class="anim-bg-layer anim-bg-gsap" />
    <div v-else-if="variant === 'anime'" ref="animeLayer" class="anim-bg-layer anim-bg-anime">
      <span v-for="n in 5" :key="n" class="anim-bg-blob" />
    </div>
    <div v-else-if="variant === 'motion'" ref="motionLayer" class="anim-bg-layer anim-bg-motion">
      <span class="anim-bg-glow" />
    </div>
  </div>
</template>

<script>
// Fundos animados — camada de ambiente opcional por trás do conteúdo real
// (texto/imagem), pensada pra ficar discreta e não competir com o que está
// sendo projetado (nada de flashes ou movimento rápido). Cada variante usa
// uma biblioteca diferente, todas de propósito geral (não específicas de
// fundo), meio que como vitrine/base pra evoluir mais efeitos depois:
//   three  → Three.js: campo de partículas 3D flutuando bem lento (WebGL)
//   gsap   → GSAP: gradiente que desliza suavemente
//   anime  → anime.js (v4): manchas borradas ("blobs") boiando
//   motion → Motion (motion.dev): brilho radial pulsando (respiração)
//
// Cada variante cria/destrói seus próprios recursos (loop de render,
// contexto WebGL, tweens) no mounted/beforeUnmount — importante porque este
// componente é montado e desmontado com frequência (troca de módulo, editor
// abrindo/fechando o painel de customização, etc.), e o Three.js em especial
// vaza memória de GPU se o WebGLRenderer não for descartado explicitamente.
export default {
  name: "AnimatedBackground",
  props: {
    // 'three' | 'gsap' | 'anime' | 'motion' | 'none'
    variant: { type: String, default: "none" },
  },
  data: () => ({
    _three: null,
    _gsapTween: null,
    _animeAnimations: [],
    _motionAnimation: null,
    _resizeHandler: null,
  }),
  watch: {
    variant() {
      this._teardown();
      this.$nextTick(() => this._setup());
    },
  },
  mounted() {
    this._setup();
  },
  beforeUnmount() {
    this._teardown();
  },
  methods: {
    _setup() {
      if (this.variant === "three") this._setupThree();
      else if (this.variant === "gsap") this._setupGsap();
      else if (this.variant === "anime") this._setupAnime();
      else if (this.variant === "motion") this._setupMotion();
    },
    _teardown() {
      if (this._three) {
        cancelAnimationFrame(this._three.frameId);
        window.removeEventListener("resize", this._three.onResize);
        this._three.renderer.dispose();
        this._three.geometry.dispose();
        this._three.material.dispose();
        this._three = null;
      }
      if (this._gsapTween) {
        this._gsapTween.kill();
        this._gsapTween = null;
      }
      this._animeAnimations.forEach((a) => a.pause?.());
      this._animeAnimations = [];
      if (this._motionAnimation) {
        this._motionAnimation.stop?.();
        this._motionAnimation = null;
      }
    },

    // ── Three.js: campo de partículas flutuando bem lento ─────────────────
    async _setupThree() {
      const canvas = this.$refs.threeCanvas;
      if (!canvas) return;
      const THREE = await import("three");

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.z = 30;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      const count = 220;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 60;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.55 });
      const points = new THREE.Points(geometry, material);
      scene.add(points);

      const resize = () => {
        const { clientWidth: w, clientHeight: h } = canvas.parentElement;
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(h, 1);
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);

      let frameId;
      const tick = () => {
        points.rotation.y += 0.0006;
        points.rotation.x += 0.0002;
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(tick);
      };
      tick();

      this._three = { renderer, geometry, material, onResize: resize, get frameId() { return frameId; } };
    },

    // ── GSAP: gradiente deslizando suavemente ──────────────────────────────
    async _setupGsap() {
      const el = this.$refs.gsapLayer;
      if (!el) return;
      const { gsap } = await import("gsap");
      gsap.set(el, { backgroundPosition: "0% 50%" });
      this._gsapTween = gsap.to(el, {
        backgroundPosition: "100% 50%",
        duration: 18,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    },

    // ── anime.js (v4): manchas borradas boiando ────────────────────────────
    async _setupAnime() {
      const el = this.$refs.animeLayer;
      if (!el) return;
      const { animate, utils } = await import("animejs");
      const blobs = utils.$(".anim-bg-blob", el);
      this._animeAnimations = blobs.map((blob, i) =>
        animate(blob, {
          translateX: () => utils.random(-60, 60),
          translateY: () => utils.random(-60, 60),
          scale: [0.85, 1.15],
          duration: () => utils.random(9000, 16000),
          delay: i * 300,
          easing: "inOutSine",
          loop: true,
          alternate: true,
        })
      );
    },

    // ── Motion (motion.dev): brilho radial pulsando ────────────────────────
    async _setupMotion() {
      const el = this.$refs.motionLayer?.querySelector(".anim-bg-glow");
      if (!el) return;
      const { animate } = await import("motion");
      this._motionAnimation = animate(
        el,
        { scale: [1, 1.25, 1], opacity: [0.35, 0.6, 0.35] },
        { duration: 8, repeat: Infinity, ease: "easeInOut" }
      );
    },
  },
};
</script>

<style scoped>
.anim-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.anim-bg-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.anim-bg-gsap {
  background: linear-gradient(120deg, #1a2a6c, #2c3e91, #1a2a6c, #0d1533);
  background-size: 200% 200%;
}
.anim-bg-anime,
.anim-bg-motion {
  display: flex;
  align-items: center;
  justify-content: center;
}
.anim-bg-blob {
  position: absolute;
  width: 32%;
  height: 32%;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.45;
  background: radial-gradient(circle, rgba(120, 160, 255, 0.9), transparent 70%);
}
.anim-bg-blob:nth-child(1) { top: 10%; left: 15%; background: radial-gradient(circle, rgba(120,160,255,0.9), transparent 70%); }
.anim-bg-blob:nth-child(2) { top: 55%; left: 60%; background: radial-gradient(circle, rgba(255,160,200,0.8), transparent 70%); }
.anim-bg-blob:nth-child(3) { top: 30%; left: 70%; background: radial-gradient(circle, rgba(160,255,210,0.8), transparent 70%); }
.anim-bg-blob:nth-child(4) { top: 65%; left: 10%; background: radial-gradient(circle, rgba(255,220,140,0.8), transparent 70%); }
.anim-bg-blob:nth-child(5) { top: 5%; left: 50%; background: radial-gradient(circle, rgba(190,150,255,0.8), transparent 70%); }
.anim-bg-glow {
  width: 45%;
  height: 45%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.9), rgba(120, 160, 255, 0.25) 60%, transparent 80%);
}
</style>
