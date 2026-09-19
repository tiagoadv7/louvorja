<template>
  <div class="anim-bg" aria-hidden="true" :style="{ '--anim-color': color }">
    <canvas v-if="variant === 'three'" ref="threeCanvas" class="anim-bg-layer" />
    <div v-else-if="variant === 'gsap'" ref="gsapLayer" class="anim-bg-layer anim-bg-gsap" />
    <div v-else-if="variant === 'anime'" ref="animeLayer" class="anim-bg-layer anim-bg-anime">
      <span v-for="n in 5" :key="n" class="anim-bg-blob" />
    </div>
    <div v-else-if="variant === 'motion'" ref="motionLayer" class="anim-bg-layer anim-bg-motion">
      <span class="anim-bg-glow anim-bg-glow--halo" />
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
    // Cor base do efeito — escolhida pelo usuário (campo "Cor do Fundo
    // Animado"). Pra gsap/anime/motion é lida via CSS custom property
    // (--anim-color, ver <style> abaixo com color-mix()); o three.js não
    // enxerga CSS vars, então tinge o material das partículas direto em JS.
    color: { type: String, default: "#7aa0ff" },
  },
  data: () => ({
    _three: null,
    _gsapTween: null,
    _animeAnimations: [],
    _motionAnimations: [],
    _resizeHandler: null,
  }),
  watch: {
    variant() {
      this._teardown();
      this.$nextTick(() => this._setup());
    },
    color() {
      // Só o three.js precisa recriar a cena pra recolorir (as outras
      // variantes reagem sozinhas à mudança de --anim-color via CSS).
      if (this.variant !== "three") return;
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
      this._motionAnimations.forEach((a) => a.stop?.());
      this._motionAnimations = [];
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
      // Mistura com branco pra manter as partículas visíveis/brilhantes contra
      // o fundo escuro fixo, independente de qual matiz o usuário escolheu.
      const particleColor = new THREE.Color(this.color).lerp(new THREE.Color(0xffffff), 0.5);
      const material = new THREE.PointsMaterial({ color: particleColor, size: 0.35, transparent: true, opacity: 0.65 });
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
      const layer = this.$refs.motionLayer;
      if (!layer) return;
      const core = layer.querySelector(".anim-bg-glow:not(.anim-bg-glow--halo)");
      const halo = layer.querySelector(".anim-bg-glow--halo");
      const { animate } = await import("motion");
      if (core) {
        this._motionAnimations.push(animate(
          core,
          { scale: [1, 1.25, 1], opacity: [0.4, 0.75, 0.4] },
          { duration: 8, repeat: Infinity, ease: "easeInOut" }
        ));
      }
      // Halo maior e mais lento, levemente fora de fase com o núcleo — dá
      // profundidade ao "respirar" em vez de um único círculo pulsando.
      if (halo) {
        this._motionAnimations.push(animate(
          halo,
          { scale: [1.1, 1, 1.1], opacity: [0.5, 0.85, 0.5] },
          { duration: 11, repeat: Infinity, ease: "easeInOut" }
        ));
      }
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
  /* Base opaca por trás de TODAS as variantes — sem isso, "three" (partículas
     sobre canvas com alpha:true), "anime" (manchas isoladas) e "motion"
     (brilho central único) deixam a maior parte da área transparente,
     mostrando o que estiver atrás da janela em vez de um fundo de verdade.
     "gsap" já cobre 100% sozinho, então essa base fica coberta e não se nota. */
  background: linear-gradient(135deg, #0d1117 0%, #1a2035 60%, #0d1117 100%);
}
.anim-bg-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
/* Todas as variantes usam a cor escolhida pelo usuário (--anim-color, prop
   `color`) via color-mix() — suportado pelo Chromium desta versão do
   Electron, mesma técnica usada pelo pianolouvorja/app. */
.anim-bg-gsap {
  background: linear-gradient(
    120deg,
    color-mix(in srgb, var(--anim-color) 55%, #0d1117),
    color-mix(in srgb, var(--anim-color) 85%, #0d1117),
    color-mix(in srgb, var(--anim-color) 40%, #0d1117),
    #0d1117
  );
  background-size: 200% 200%;
}
.anim-bg-anime,
.anim-bg-motion {
  position: relative;
}
.anim-bg-blob {
  position: absolute;
  width: 32%;
  height: 32%;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.45;
  background: radial-gradient(circle, color-mix(in srgb, var(--anim-color) 90%, white 10%), transparent 70%);
}
/* Variações de mistura (não matizes diferentes) da mesma cor — mantém as
   manchas "vivas" e com profundidade sem fugir da cor escolhida. */
.anim-bg-blob:nth-child(1) { top: 10%; left: 15%; }
.anim-bg-blob:nth-child(2) { top: 55%; left: 60%; background: radial-gradient(circle, color-mix(in srgb, var(--anim-color) 65%, white 35%), transparent 70%); }
.anim-bg-blob:nth-child(3) { top: 30%; left: 70%; background: radial-gradient(circle, color-mix(in srgb, var(--anim-color) 50%, white 50%), transparent 70%); }
.anim-bg-blob:nth-child(4) { top: 65%; left: 10%; background: radial-gradient(circle, color-mix(in srgb, var(--anim-color) 80%, black 15%), transparent 70%); }
.anim-bg-blob:nth-child(5) { top: 5%; left: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--anim-color) 60%, white 25%), transparent 70%); }

/* Brilho Pulsante — núcleo brilhante + halo maior/mais difuso por trás
   (posicionados um sobre o outro, concêntricos), com box-shadow espalhando
   luz de verdade pra fora do círculo em vez de só um gradiente com borda
   nítida — esse é o "efeito de glow" de fato. */
.anim-bg-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40%;
  height: 40%;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--anim-color) 25%, white 75%), var(--anim-color) 45%, transparent 75%);
  filter: blur(6px);
  box-shadow: 0 0 min(18vmin, 140px) min(9vmin, 70px) color-mix(in srgb, var(--anim-color) 45%, transparent);
}
.anim-bg-glow--halo {
  width: 78%;
  height: 78%;
  background: radial-gradient(circle, color-mix(in srgb, var(--anim-color) 35%, transparent), transparent 70%);
  filter: blur(24px);
  box-shadow: none;
}
</style>
