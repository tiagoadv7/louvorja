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
    <div v-else-if="variant === 'ondas'" ref="wavesLayer" class="anim-bg-layer anim-bg-waves" />
    <div v-else-if="variant === 'grade'" ref="gridLayer" class="anim-bg-layer anim-bg-grid">
      <div class="anim-bg-grid-lines" />
      <div class="anim-bg-grid-horizon" />
    </div>
    <div v-else-if="variant === 'neve'" ref="snowLayer" class="anim-bg-layer anim-bg-snow">
      <span v-for="n in 40" :key="n" class="anim-bg-flake" />
    </div>
    <div v-else-if="variant === 'estrelas'" class="anim-bg-layer anim-bg-stars">
      <span
        v-for="(s, i) in starDefs" :key="i"
        class="anim-bg-star"
        :style="{
          top: `${s.top}%`, left: `${s.left}%`,
          width: `${s.size}px`, height: `${s.size}px`,
          animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s`,
        }"
      />
    </div>
  </div>
</template>

<script>
// Fundos animados — camada de ambiente opcional por trás do conteúdo real
// (texto/imagem), pensada pra ficar discreta e não competir com o que está
// sendo projetado (nada de flashes ou movimento rápido). Cada variante usa
// uma biblioteca diferente, todas de propósito geral (não específicas de
// fundo), meio que como vitrine/base pra evoluir mais efeitos depois:
//   three    → Three.js: campo de partículas 3D flutuando bem lento (WebGL)
//   gsap     → GSAP: gradiente que desliza suavemente
//   anime    → anime.js (v4): manchas borradas ("blobs") boiando
//   motion   → Motion (motion.dev): brilho radial pulsando (respiração)
//   ondas    → GSAP: aurora em gradiente cônico girando bem devagar
//   grade    → GSAP: grade estilo synthwave/horizonte rolando pra frente
//   neve     → anime.js (v4): partículas caindo (neve/confete)
//   estrelas → CSS puro: campo de estrelas piscando (sem nenhuma lib)
//
// Todas usam bibliotecas já instaladas localmente (three/gsap/animejs/motion)
// ou CSS puro — nada busca nada pela rede, funciona 100% offline.
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
    // Gerado uma vez só (não a cada render) — posições/tempos fixos, senão
    // as estrelas "pulariam" de lugar a cada atualização reativa do pai.
    starDefs: Array.from({ length: 70 }, () => ({
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: 1 + Math.random() * 2,
      delay: Math.random() * 4,
      duration: 2 + Math.random() * 3,
    })),
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
      else if (this.variant === "ondas") this._setupWaves();
      else if (this.variant === "grade") this._setupGrid();
      else if (this.variant === "neve") this._setupSnow();
      // "estrelas" é só CSS (animação via @keyframes) — nada a inicializar.
    },
    _teardown() {
      if (this._three) {
        cancelAnimationFrame(this._three.frameId);
        window.removeEventListener("resize", this._three.onResize);
        this._three.renderer.dispose();
        this._three.geometry.dispose();
        this._three.material.dispose();
        this._three.glowTexture?.dispose();
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

    // Textura em degradê radial (branco opaco no centro → transparente na
    // borda) usada como sprite de cada partícula — sem ela, PointsMaterial
    // desenha um quadradinho sólido de aresta dura, sem nenhum brilho.
    _createGlowTexture(THREE) {
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.35, "rgba(255,255,255,0.7)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(canvas);
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
      const glowTexture = this._createGlowTexture(THREE);
      // additive blending + sprite em degradê: partículas próximas somam
      // brilho entre si (parecendo "acender" onde se sobrepõem) em vez de só
      // pontos sólidos — é isso que dá o efeito de glow real.
      const material = new THREE.PointsMaterial({
        color: particleColor,
        size: 1.4,
        map: glowTexture,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
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

      this._three = { renderer, geometry, material, glowTexture, onResize: resize, get frameId() { return frameId; } };
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

    // ── GSAP: aurora em gradiente cônico girando bem devagar ───────────────
    async _setupWaves() {
      const el = this.$refs.wavesLayer;
      if (!el) return;
      const { gsap } = await import("gsap");
      gsap.set(el, { rotate: 0 });
      this._gsapTween = gsap.to(el, {
        rotate: 360,
        duration: 50,
        ease: "none",
        repeat: -1,
      });
    },

    // ── GSAP: grade estilo synthwave rolando em direção à câmera ───────────
    async _setupGrid() {
      const el = this.$refs.gridLayer?.querySelector(".anim-bg-grid-lines");
      if (!el) return;
      const { gsap } = await import("gsap");
      gsap.set(el, { backgroundPositionY: "0px" });
      this._gsapTween = gsap.to(el, {
        backgroundPositionY: "+=40px",
        duration: 1.1,
        ease: "none",
        repeat: -1,
      });
    },

    // ── anime.js (v4): partículas caindo (neve/confete) ────────────────────
    async _setupSnow() {
      const el = this.$refs.snowLayer;
      if (!el) return;
      const { animate, utils } = await import("animejs");
      const flakes = utils.$(".anim-bg-flake", el);
      this._animeAnimations = flakes.map((flake, i) => {
        utils.set(flake, { left: `${utils.random(0, 100)}%`, top: "-5%" });
        return animate(flake, {
          top: ["-5%", "105%"],
          translateX: () => utils.random(-40, 40),
          opacity: [0, 0.9, 0.9, 0],
          duration: () => utils.random(7000, 13000),
          delay: i * 200,
          easing: "linear",
          loop: true,
        });
      });
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

/* Ondas — aurora em gradiente cônico multi-matiz, girando devagar e
   desfocada; a rotação/escala fazem ela nunca deixar cantos vazios. */
.anim-bg-waves {
  background: conic-gradient(
    from 0deg at 50% 50%,
    color-mix(in srgb, var(--anim-color) 70%, #050814) 0deg,
    color-mix(in srgb, var(--anim-color) 15%, #050814) 90deg,
    color-mix(in srgb, var(--anim-color) 70%, #050814) 180deg,
    color-mix(in srgb, var(--anim-color) 15%, #050814) 270deg,
    color-mix(in srgb, var(--anim-color) 70%, #050814) 360deg
  );
  filter: blur(min(8vmin, 60px)) saturate(1.3);
  transform: scale(1.8);
}

/* Grade — horizonte synthwave: linha de brilho + grade em perspectiva
   rolando pra frente (background-position animado via GSAP). */
.anim-bg-grid {
  background: linear-gradient(180deg, #05030d 0%, #0d0821 55%, #170f3d 100%);
}
.anim-bg-grid-horizon {
  position: absolute;
  top: 42%;
  left: 0;
  right: 0;
  height: 2px;
  background: color-mix(in srgb, var(--anim-color) 85%, white 15%);
  box-shadow: 0 0 min(6vmin, 40px) min(1.5vmin, 10px) color-mix(in srgb, var(--anim-color) 60%, transparent);
}
.anim-bg-grid-lines {
  position: absolute;
  top: 42%;
  left: -50%;
  right: -50%;
  bottom: -20%;
  background-image:
    repeating-linear-gradient(90deg, color-mix(in srgb, var(--anim-color) 55%, transparent) 0 2px, transparent 2px 60px),
    repeating-linear-gradient(0deg, color-mix(in srgb, var(--anim-color) 55%, transparent) 0 2px, transparent 2px 40px);
  transform: perspective(220px) rotateX(60deg);
  transform-origin: top center;
  opacity: 0.8;
}

/* Neve — partículas caindo devagar, cor derivada da escolhida. */
.anim-bg-snow {
  position: relative;
}
.anim-bg-flake {
  position: absolute;
  top: -5%;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--anim-color) 35%, white 65%);
}

/* Estrelas — só CSS, sem nenhuma lib: cada estrela pisca em seu próprio
   ritmo (delay/duration aleatórios por estrela, ver starDefs). */
.anim-bg-stars {
  position: relative;
}
.anim-bg-star {
  position: absolute;
  border-radius: 50%;
  background: color-mix(in srgb, var(--anim-color) 30%, white 70%);
  animation-name: anim-bg-twinkle;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
@keyframes anim-bg-twinkle {
  0%, 100% { opacity: 0.15; transform: scale(0.7); }
  50%      { opacity: 1;    transform: scale(1.4); }
}
</style>
