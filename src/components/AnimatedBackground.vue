<template>
  <div ref="root" class="anim-bg" aria-hidden="true" :style="{ '--anim-color': color }">
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
    <div v-else-if="variant === 'bokeh'" class="anim-bg-layer anim-bg-bokeh">
      <span
        v-for="(b, i) in bokehDefs" :key="i"
        class="anim-bg-bokeh-circle"
        :style="{
          top: `${b.top}%`, left: `${b.left}%`,
          width: `${b.size}px`, height: `${b.size}px`,
          opacity: b.opacity,
          animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s`,
        }"
      />
    </div>
    <div v-else-if="variant === 'raios'" ref="raysLayer" class="anim-bg-layer anim-bg-rays" />
    <div v-else-if="variant === 'brasas'" ref="embersLayer" class="anim-bg-layer anim-bg-embers">
      <span v-for="n in 30" :key="n" class="anim-bg-ember" />
    </div>
    <div v-else-if="variant === 'fumaca'" class="anim-bg-layer anim-bg-smoke">
      <span class="anim-bg-smoke-blob anim-bg-smoke-blob--1" />
      <span class="anim-bg-smoke-blob anim-bg-smoke-blob--2" />
      <span class="anim-bg-smoke-blob anim-bg-smoke-blob--3" />
    </div>
    <div v-else-if="variant === 'nuvens'" class="anim-bg-layer anim-bg-clouds">
      <span class="anim-bg-cloud anim-bg-cloud--1" />
      <span class="anim-bg-cloud anim-bg-cloud--2" />
      <span class="anim-bg-cloud anim-bg-cloud--3" />
    </div>
    <div v-else-if="variant === 'vaga-lumes'" class="anim-bg-layer anim-bg-fireflies">
      <span
        v-for="(f, i) in fireflyDefs" :key="i"
        class="anim-bg-firefly"
        :style="{
          top: `${f.top}%`, left: `${f.left}%`,
          width: `${f.size}px`, height: `${f.size}px`,
          animationDelay: `${f.delay}s`, animationDuration: `${f.duration}s`,
        }"
      />
    </div>
    <div v-else-if="variant === 'cadentes'" class="anim-bg-layer anim-bg-meteors">
      <span
        v-for="(m, i) in meteorDefs" :key="i"
        class="anim-bg-meteor"
        :style="{
          top: `${m.top}%`, left: `${m.left}%`,
          animationDelay: `${m.delay}s`, animationDuration: `${m.duration}s`,
        }"
      />
    </div>
    <div v-else-if="variant === 'chuva'" class="anim-bg-layer anim-bg-rain">
      <div ref="rainLayer" class="anim-bg-rain-drops" />
    </div>
    <div v-else-if="variant === 'neblina'" class="anim-bg-layer anim-bg-fog">
      <span class="anim-bg-fog-band anim-bg-fog-band--1" />
      <span class="anim-bg-fog-band anim-bg-fog-band--2" />
      <span class="anim-bg-fog-band anim-bg-fog-band--3" />
    </div>
    <div v-else-if="variant === 'liquido'" ref="liquidLayer" class="anim-bg-layer anim-bg-liquid">
      <span class="anim-bg-liquid-blob anim-bg-liquid-blob--1" />
      <span class="anim-bg-liquid-blob anim-bg-liquid-blob--2" />
      <span class="anim-bg-liquid-blob anim-bg-liquid-blob--3" />
    </div>

    <!-- Glow ambiente — camada extra por cima de QUALQUER variante acima
         (ver comentário no <style>), pra todo fundo animado ter um brilho
         suave, não só "Brilho Pulsante"/partículas 3D que já tinham o seu
         próprio de propósito. -->
    <div class="anim-bg-ambient-glow" />
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
//   bokeh    → CSS puro: círculos desfocados flutuando (luzes fora de foco)
//   raios    → GSAP: feixes de luz (repeating-conic-gradient) girando devagar
//   brasas   → anime.js (v4): partículas subindo com brilho quente (fogo/brasa)
//   fumaca   → CSS puro: manchas com border-radius mudando (fumaça/tinta)
//   nuvens   → CSS puro: nuvens desfocadas deslizando horizontalmente
//   vaga-lumes → CSS puro: pontos quentes vagando devagar, piscando (fireflies)
//   cadentes → CSS puro: estrelas cadentes cruzando a tela de vez em quando
//   chuva    → GSAP: linhas de chuva caindo em diagonal (grade repetida)
//   neblina  → CSS puro: faixas de névoa largas e baixas, deslizando devagar
//   liquido  → GSAP: manchas grandes sobrepostas (mix-blend) fluindo devagar
//
// (bokeh/raios/brasas/fumaça/nuvens inspirados nas categorias de fundos de
// motion pra igreja tipo Worshipwide/WorshipHouse Media — mesmo espírito
// visual, só que 100% procedural, sem baixar nenhum vídeo/imagem pronta.)
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
    // Dip de opacidade ao trocar de variante (ver watch "variant" abaixo).
    _switchFade: null,
    // Gerado uma vez só (não a cada render) — posições/tempos fixos, senão
    // as estrelas "pulariam" de lugar a cada atualização reativa do pai.
    starDefs: Array.from({ length: 70 }, () => ({
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: 1 + Math.random() * 2,
      delay: Math.random() * 4,
      duration: 2 + Math.random() * 3,
    })),
    // Mesma lógica do starDefs acima (gerado uma vez só, não a cada render).
    bokehDefs: Array.from({ length: 18 }, () => ({
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: 60 + Math.random() * 120,
      opacity: 0.22 + Math.random() * 0.3,
      delay: Math.random() * 6,
      duration: 10 + Math.random() * 10,
    })),
    // Vaga-lumes — mesma ideia de starDefs/bokehDefs (gerado uma vez só).
    fireflyDefs: Array.from({ length: 22 }, () => ({
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: 3 + Math.random() * 3,
      delay: Math.random() * 8,
      duration: 6 + Math.random() * 6,
    })),
    // Estrelas cadentes — poucas (não é chuva de meteoros) e um ciclo bem
    // mais longo/espalhado que fireflyDefs, pra cruzar a tela raramente,
    // sem competir com o conteúdo. top/left = ponto de partida (canto
    // superior esquerdo da diagonal), não posição fixa.
    meteorDefs: Array.from({ length: 6 }, () => ({
      top: Math.random() * 35,
      left: Math.random() * 60,
      delay: Math.random() * 20,
      duration: 5 + Math.random() * 4,
    })),
  }),
  watch: {
    // Trocar de UMA variante ativa pra OUTRA (não ativar/desativar — esse
    // caso nem chega a rodar isto, ver Slide.vue#bgKey, que agora ignora o
    // nome da variante na key e não remonta o componente todo por causa
    // disso) — sem esse dip de opacidade, a troca era um corte seco: o
    // efeito antigo sumia e o novo (Three.js/GSAP/anime.js, todos
    // assíncronos — import dinâmico) só aparecia de verdade alguns quadros
    // depois, quando terminava de montar. O dip cobre exatamente esse vão.
    variant(_new, old) {
      const el = this.$refs.root;
      if (!old || !el?.animate) {
        this._teardown();
        this.$nextTick(() => this._setup());
        return;
      }
      if (this._switchFade) this._switchFade.cancel();
      // fill:"forwards" nas duas pontas -- sem isso, o navegador devolve a
      // opacidade ao valor do CSS (1) assim que CADA animate() termina, e o
      // dip sumiria sozinho bem antes do teardown/setup rodar de verdade.
      this._switchFade = el.animate(
        [{ opacity: 1 }, { opacity: 0.1 }],
        { duration: 180, easing: "ease", fill: "forwards" }
      );
      this._switchFade.finished
        .then(() => {
          this._teardown();
          this.$nextTick(() => {
            this._setup();
            this._switchFade = el.animate(
              [{ opacity: 0.1 }, { opacity: 1 }],
              { duration: 260, easing: "ease", fill: "forwards" }
            );
          });
        })
        .catch(() => {});
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
    if (this._switchFade) this._switchFade.cancel();
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
      else if (this.variant === "raios") this._setupRays();
      else if (this.variant === "brasas") this._setupEmbers();
      else if (this.variant === "chuva") this._setupRain();
      else if (this.variant === "liquido") this._setupLiquid();
      // "estrelas"/"bokeh"/"fumaca"/"nuvens"/"vaga-lumes"/"cadentes"/"neblina"
      // são só CSS (animação via @keyframes) — nada a inicializar.
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

    // ── GSAP: feixes de luz girando bem devagar (god rays) ─────────────────
    async _setupRays() {
      const el = this.$refs.raysLayer;
      if (!el) return;
      const { gsap } = await import("gsap");
      gsap.set(el, { rotate: 0 });
      this._gsapTween = gsap.to(el, {
        rotate: 360,
        duration: 90,
        ease: "none",
        repeat: -1,
      });
    },

    // ── anime.js (v4): partículas subindo com brilho quente (brasas) ───────
    async _setupEmbers() {
      const el = this.$refs.embersLayer;
      if (!el) return;
      const { animate, utils } = await import("animejs");
      const embers = utils.$(".anim-bg-ember", el);
      this._animeAnimations = embers.map((ember, i) => {
        utils.set(ember, { left: `${utils.random(0, 100)}%`, top: "105%" });
        return animate(ember, {
          top: ["105%", "-5%"],
          translateX: () => utils.random(-30, 30),
          opacity: [0, 0.9, 0.9, 0],
          scale: [0.6, 1, 0.75],
          duration: () => utils.random(8000, 15000),
          delay: i * 250,
          easing: "linear",
          loop: true,
        });
      });
    },

    // ── GSAP: linhas de chuva caindo em diagonal (grade repetida) ──────────
    async _setupRain() {
      const el = this.$refs.rainLayer;
      if (!el) return;
      const { gsap } = await import("gsap");
      gsap.set(el, { backgroundPosition: "0px 0px" });
      this._gsapTween = gsap.to(el, {
        backgroundPosition: "-24px 130px",
        duration: 0.7,
        ease: "none",
        repeat: -1,
      });
    },

    // ── GSAP: manchas grandes sobrepostas fluindo devagar (mesh líquido) ──
    async _setupLiquid() {
      const el = this.$refs.liquidLayer;
      if (!el) return;
      const { gsap } = await import("gsap");
      const blobs = el.querySelectorAll(".anim-bg-liquid-blob");
      const tl = gsap.timeline({ repeat: -1, yoyo: true });
      blobs.forEach((b, i) => {
        tl.to(b, {
          xPercent: 20 - i * 8,
          yPercent: -15 + i * 10,
          scale: 1.2,
          duration: 14 + i * 3,
          ease: "sine.inOut",
        }, 0);
      });
      this._gsapTween = tl;
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
  filter: blur(0.6px);
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
  filter: blur(0.5px);
  background: color-mix(in srgb, var(--anim-color) 30%, white 70%);
  animation-name: anim-bg-twinkle;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
@keyframes anim-bg-twinkle {
  0%, 100% { opacity: 0.15; transform: scale(0.7); }
  50%      { opacity: 1;    transform: scale(1.4); }
}

/* Bokeh — círculos desfocados flutuando bem devagar, cada um com seu
   próprio tamanho/posição/ritmo (ver bokehDefs, gerado uma vez só). */
.anim-bg-bokeh {
  position: relative;
  background: linear-gradient(160deg, #0d1117 0%, #171f33 100%);
}
.anim-bg-bokeh-circle {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--anim-color) 70%, white 30%),
    color-mix(in srgb, var(--anim-color) 30%, transparent) 60%,
    transparent 75%
  );
  filter: blur(6px);
  animation-name: anim-bg-bokeh-float;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}
@keyframes anim-bg-bokeh-float {
  0%   { transform: translate(0, 0) scale(1); }
  100% { transform: translate(3%, -4%) scale(1.15); }
}

/* Raios — feixes de luz (repeating-conic-gradient) desfocados, ampliados
   (scale) pra rotação nunca deixar cantos vazios, igual à técnica de "ondas". */
.anim-bg-rays {
  background:
    repeating-conic-gradient(
      from 0deg at 30% 15%,
      color-mix(in srgb, var(--anim-color) 60%, transparent) 0deg 3deg,
      transparent 3deg 24deg
    ),
    linear-gradient(180deg, #05060c 0%, #0d0f1d 100%);
  filter: blur(min(3.5vmin, 26px));
  transform: scale(2.2);
}

/* Brasas — partículas quentes subindo com brilho (box-shadow), sempre
   misturadas com laranja/amarelo pra parecer fogo mesmo se a cor escolhida
   for fria (mesma lógica do "three" misturando com branco). */
.anim-bg-embers {
  position: relative;
  background: linear-gradient(180deg, #150a06 0%, #2a1206 100%);
}
.anim-bg-ember {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  filter: blur(0.6px);
  background: color-mix(in srgb, var(--anim-color) 70%, #ffb800 30%);
  box-shadow: 0 0 6px 2px color-mix(in srgb, var(--anim-color) 60%, #ff8800 40%);
}

/* Fumaça/Tinta — manchas grandes desfocadas com border-radius mudando
   (morph orgânico), sem nenhuma lib, só @keyframes. */
.anim-bg-smoke {
  position: relative;
  background: linear-gradient(160deg, #0b0d12 0%, #14171f 100%);
  overflow: hidden;
}
.anim-bg-smoke-blob {
  position: absolute;
  width: 65%;
  height: 65%;
  filter: blur(min(6vmin, 50px));
  opacity: 0.35;
  background: radial-gradient(circle, color-mix(in srgb, var(--anim-color) 55%, white 10%), transparent 70%);
  mix-blend-mode: screen;
  animation-name: anim-bg-smoke-morph;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}
.anim-bg-smoke-blob--1 { top: -10%; left: -10%; animation-duration: 26s; }
.anim-bg-smoke-blob--2 {
  top: 30%; left: 40%; animation-duration: 34s; opacity: 0.28;
  background: radial-gradient(circle, color-mix(in srgb, var(--anim-color) 40%, white 20%), transparent 70%);
}
.anim-bg-smoke-blob--3 { top: 55%; left: -5%; animation-duration: 30s; opacity: 0.3; }
@keyframes anim-bg-smoke-morph {
  0%   { border-radius: 42% 58% 65% 35% / 45% 40% 60% 55%; transform: translate(0, 0) scale(1); }
  50%  { border-radius: 60% 40% 35% 65% / 55% 65% 35% 45%; transform: translate(6%, 4%) scale(1.1); }
  100% { border-radius: 35% 65% 55% 45% / 40% 55% 45% 60%; transform: translate(-4%, 6%) scale(0.95); }
}

/* Nuvens — elipses desfocadas deslizando na horizontal em velocidades e
   alturas diferentes, sem nenhuma lib. */
.anim-bg-clouds {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, color-mix(in srgb, var(--anim-color) 20%, #0d1117), #0d1117);
}
.anim-bg-cloud {
  position: absolute;
  width: 55%;
  height: 30%;
  border-radius: 50%;
  filter: blur(min(5vmin, 40px));
  background: radial-gradient(ellipse, color-mix(in srgb, var(--anim-color) 30%, white 60%), transparent 70%);
  opacity: 0.4;
  animation-name: anim-bg-cloud-drift;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
.anim-bg-cloud--1 { top: 10%; animation-duration: 70s; }
.anim-bg-cloud--2 { top: 40%; width: 70%; height: 25%; opacity: 0.3; animation-duration: 95s; animation-delay: -20s; }
.anim-bg-cloud--3 { top: 65%; width: 45%; opacity: 0.35; animation-duration: 60s; animation-delay: -40s; }
@keyframes anim-bg-cloud-drift {
  0%   { transform: translateX(-30%); }
  100% { transform: translateX(130%); }
}

/* Vaga-lumes — pontos quentes vagando devagar em trajetória curta e
   piscando (opacidade sobe/desce fora de fase do movimento), cor sempre
   misturada com âmbar/dourado pra dar o ar de "luz de vaga-lume" mesmo se
   a cor escolhida for fria (mesma lógica de "brasas" com laranja). */
.anim-bg-fireflies {
  position: relative;
  background: linear-gradient(180deg, #05140a 0%, #0a2413 100%);
}
.anim-bg-firefly {
  position: absolute;
  border-radius: 50%;
  filter: blur(1px);
  background: color-mix(in srgb, var(--anim-color) 55%, #ffe9a8 45%);
  box-shadow: 0 0 8px 3px color-mix(in srgb, var(--anim-color) 55%, #ffcf5c 45%);
  animation-name: anim-bg-firefly-wander;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
@keyframes anim-bg-firefly-wander {
  0%   { transform: translate(0, 0);       opacity: 0.12; }
  20%  { opacity: 0.85; }
  50%  { transform: translate(6%, -8%);    opacity: 0.25; }
  70%  { opacity: 0.8; }
  100% { transform: translate(-4%, 5%);    opacity: 0.12; }
}

/* Estrelas cadentes — poucas riscas de luz cruzando a tela em diagonal de
   vez em quando (ver meteorDefs: ciclo longo/espalhado, não é chuva de
   meteoros) — vmax na translação final pra cruzar proporcional à tela
   inteira, não só ao tamanho do próprio elemento. */
.anim-bg-meteors {
  position: relative;
  background: linear-gradient(180deg, #05060f 0%, #0b0f22 100%);
}
.anim-bg-meteor {
  position: absolute;
  width: 2px;
  height: 85px;
  border-radius: 2px;
  filter: blur(0.5px);
  background: linear-gradient(180deg, color-mix(in srgb, var(--anim-color) 20%, white 80%), transparent);
  opacity: 0;
  animation-name: anim-bg-meteor-fall;
  animation-timing-function: ease-in;
  animation-iteration-count: infinite;
}
@keyframes anim-bg-meteor-fall {
  0%   { transform: translate(-8vmax, -5vmax) rotate(25deg); opacity: 0; }
  8%   { opacity: 0.85; }
  40%  { opacity: 0.85; }
  55%  { transform: translate(70vmax, 42vmax) rotate(25deg); opacity: 0; }
  100% { transform: translate(70vmax, 42vmax) rotate(25deg); opacity: 0; }
}

/* Chuva — grade de linhas diagonais repetida (mesma técnica de "grade"/
   synthwave, só com ângulo/espaçamento diferentes), rolando rápido via
   GSAP (ver _setupRain) pra dar a sensação de gotas caindo. */
.anim-bg-rain {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #0b1420 0%, #0a1c2e 100%);
}
.anim-bg-rain-drops {
  position: absolute;
  top: -20%;
  left: -15%;
  right: -15%;
  bottom: -20%;
  background-image: repeating-linear-gradient(
    100deg,
    color-mix(in srgb, var(--anim-color) 45%, white 55%) 0 1px,
    transparent 1px 90px
  );
  filter: blur(0.4px);
  opacity: 0.5;
}

/* Neblina — faixas largas e baixas, bem desfocadas, deslizando devagar
   (mesma keyframe de "nuvens", só mais largas/opacas/baixas pra ler como
   névoa rente ao chão em vez de nuvens no céu). */
.anim-bg-fog {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #0d1117 0%, #1a2230 100%);
}
.anim-bg-fog-band {
  position: absolute;
  width: 140%;
  height: 40%;
  border-radius: 50%;
  filter: blur(min(7vmin, 55px));
  opacity: 0.3;
  background: radial-gradient(ellipse, color-mix(in srgb, var(--anim-color) 25%, white 55%), transparent 75%);
  animation-name: anim-bg-fog-drift;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}
.anim-bg-fog-band--1 { bottom: -10%; left: -20%; animation-duration: 40s; }
.anim-bg-fog-band--2 { bottom: 5%;   left: -30%; opacity: 0.22; animation-duration: 55s; animation-delay: -15s; }
.anim-bg-fog-band--3 { bottom: -20%; left: -10%; opacity: 0.26; animation-duration: 48s; animation-delay: -25s; }
@keyframes anim-bg-fog-drift {
  0%   { transform: translateX(0); }
  100% { transform: translateX(20%); }
}

/* Gradiente Líquido — manchas grandes sobrepostas (mix-blend: screen)
   fluindo devagar via GSAP (ver _setupLiquid) — igual "Manchas Flutuantes"
   (anime.js) em espírito, mas com blobs maiores/mais sobrepostos e mistura
   aditiva, lendo mais como um gradiente contínuo "respirando" do que
   manchas isoladas boiando. */
.anim-bg-liquid {
  position: relative;
  background: #0d1117;
}
.anim-bg-liquid-blob {
  position: absolute;
  width: 65%;
  height: 65%;
  border-radius: 50%;
  filter: blur(min(6vmin, 50px));
  mix-blend-mode: screen;
  opacity: 0.65;
}
.anim-bg-liquid-blob--1 { top: -5%; left: 55%; background: radial-gradient(circle, color-mix(in srgb, var(--anim-color) 80%, white 15%), transparent 70%); }
.anim-bg-liquid-blob--2 { top: 25%; left: 10%; background: radial-gradient(circle, color-mix(in srgb, var(--anim-color) 55%, white 40%), transparent 70%); }
.anim-bg-liquid-blob--3 { top: 45%; left: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--anim-color) 70%, black 10%), transparent 70%); }

/* Glow ambiente — CSS puro, por cima de TODAS as variantes (renderizado
   depois de todas no template, então fica no topo do empilhamento). Um
   brilho radial suave, pulsando bem devagar, misturado com "screen" (só
   clareia, nunca escurece o que está por baixo) — dá um "glow" geral a
   fundos que antes eram só forma/movimento (grade, nuvens, estrelas etc.)
   sem competir com o conteúdo real (texto/imagem) na frente. Sutil de
   propósito: quem já tem brilho próprio (motion/three) só ganha um reforço
   leve, não dobra o efeito. */
.anim-bg-ambient-glow {
  position: absolute;
  inset: -25%;
  border-radius: 50%;
  background: radial-gradient(
    circle at 50% 50%,
    color-mix(in srgb, var(--anim-color) 55%, white 25%) 0%,
    color-mix(in srgb, var(--anim-color) 25%, transparent) 45%,
    transparent 70%
  );
  mix-blend-mode: screen;
  opacity: 0.28;
  animation: anim-bg-ambient-pulse 7s ease-in-out infinite;
}
@keyframes anim-bg-ambient-pulse {
  0%, 100% { opacity: 0.2;  transform: scale(1); }
  50%      { opacity: 0.38; transform: scale(1.08); }
}
</style>
