<template>
  <transition name="popup-fade" appear>
    <div v-if="visible" class="popup-root">
      <!-- Troca entre módulos (ex.: vídeo em execução → slide de uma música do
           álbum) — sem isso o <component :is> troca na hora: o módulo antigo é
           desmontado (removendo o elemento <video>/<img> da árvore) antes do
           seu próprio fade interno (ver video_player/interface/Popup.vue,
           ~1s) terminar, cortando a saída de forma abrupta, e o módulo novo
           aparecia sem nenhum fade de entrada.

           SEM mode="out-in" (removido de propósito): o antigo entra em leave
           e o novo em enter AO MESMO TEMPO (crossfade real, sobrepostos) —
           com out-in, o Vue esperava o leave terminar (~1s) para só então
           montar/esmaecer o novo, deixando essa janela (fundo transparente,
           ver .popup-root) sem nada desenhado por até 1s, o que aparecia como
           um flash preto entre uma mídia e outra em vez de um crossfade
           suave. Os dois <div> ficam com position:absolute (ver
           .module-crossfade-item abaixo) para se sobreporem exatamente um
           sobre o outro durante essa janela — sem isso, os dois entrariam no
           fluxo normal (um embaixo do outro) enquanto ambos existem no DOM.

           O <component> fica dentro de um <div> "amortecedor" (em vez de ser
           filho direto desta <transition>) porque o Popup.vue do módulo media
           já tem uma <transition> na RAIZ do próprio template dele (fade do
           slide, ver core/media/interface/Popup.vue) — duas <transition> do
           Vue disputando os hooks de enter/leave do MESMO nó (a raiz do
           componente filho) trava o leave desta aqui pra sempre enquanto o
           álbum está tocando, e o módulo novo (ex. vídeo) nunca chega a
           montar. O <div> dá a esta <transition> um nó próprio, isolado do
           que acontece dentro do módulo filho. -->
      <transition name="module-crossfade">
        <div v-if="moduleComponent" :key="module" class="module-crossfade-item">
          <component :is="moduleComponent" style="width: 100%; height: 100%;" />
        </div>
      </transition>

      <!-- Overlay de imagem (logo/aviso) — montado incondicionalmente, ao
           contrário do <component :is="moduleComponent"> acima, que só exibe
           UM módulo por vez (o popup_module selecionado). O overlay não é
           selecionável como popup_module (sem LScreenBtn no seu Index.vue) —
           ele se sobrepõe ao que estiver sendo projetado sem substituir nada,
           igual ao overlay do FreeShow. A própria visibilidade dele já é
           controlada internamente por modules.image_overlay.show/minimized
           (ver isActive em image_overlay/interface/Popup.vue). -->
      <ImageOverlayPopup />
    </div>
  </transition>
</template>

<script>
import { defineAsyncComponent } from "vue";
import WebLinkFrame from "@/components/WebLinkFrame.vue";
import ImageOverlayPopup from "@/modules/image_overlay/interface/Popup.vue";

const isElectron = () =>
  typeof window !== "undefined" &&
  typeof window.electron !== "undefined" &&
  navigator.userAgent.includes("Electron");

const FADE_MS = 400;

export default {
  name: "PopupPage",
  components: {
    ImageOverlayPopup,
  },
  data: () => ({
    module: null,
    visible: false,
    stateHandler: null,
    batchHandler: null,
    moduleHandler: null,
    closingHandler: null,
    _revealTimer: null,
  }),
  computed: {
    moduleComponent() {
      const mod = this.module;
      if (!mod) return null;
      // "web_link" não é um módulo registrado (sem operador/manifest próprio)
      // — é só um link (Canva, YouTube, etc.) projetado pela Liturgia via
      // $webLink.open(), então o componente é resolvido direto aqui, sem
      // passar pelo import dinâmico de @/modules/*/interface/Popup.vue.
      if (mod === "web_link") return WebLinkFrame;
      return defineAsyncComponent(() =>
        import(`@/modules/core/${mod}/interface/Popup.vue`).catch(() =>
          import(`@/modules/${mod}/interface/Popup.vue`).catch((e) => {
            this.$alert.error({ text: "messages.error_import_module", error: e });
            return null;
          })
        )
      );
    },
  },
  methods: {
    _applyStateEntry(data) {
      if (!data || !data.param) return;
      this.$appdata.set(data.param, data.value);
      // Sem o "&& data.value" antigo: precisa reagir também quando o valor
      // vem vazio (desligar a projeção pelo ícone da tela agora só limpa
      // popup_module, sem fechar a janela — ver helpers/Popup.js#close) para
      // que o <component :is="moduleComponent"> realmente desmonte. Com o
      // guard antigo, uma string vazia nunca atualizava "module", e o
      // conteúdo anterior ficava preso na tela pra sempre.
      if (data.param === "popup_module") {
        this.module = data.value || null;
      }
      if (data.param === "theme" && data.value) {
        try { this.$vuetify.theme.global.name = data.value; } catch { /* */ }
      }
      // Quando a imagem de capa chega, pré-carrega e revela a janela
      if (data.param === "modules.media.data" && data.value?.url_image) {
        this._revealWindow(data.value.url_image);
      }
    },

    startFadeOut() {
      this.visible = false;
      // Para o browser: fecha a janela após a animação terminar
      if (!isElectron()) {
        setTimeout(() => window.close(), FADE_MS);
      }
    },

    // Pré-carrega a imagem de capa e abre o fade-in só depois que ela estiver pronta.
    // Evita o flash de fundo preto enquanto a imagem carrega no renderer da janela de saída.
    _revealWindow(imageUrl) {
      if (this.visible) return;
      clearTimeout(this._revealTimer);
      const show = () => { if (!this.visible) this.visible = true; };
      if (!imageUrl) { show(); return; }
      const img = new Image();
      img.onload = img.onerror = show;
      img.src = imageUrl;
      // Fallback: mostra em até 800 ms mesmo se a imagem não carregar
      this._revealTimer = setTimeout(show, 800);
    },

    initElectron() {
      this.$appdata.set("is_popup", true);

      this.$userdata.load();
      const savedTheme = this.$userdata.get("theme");
      if (savedTheme) try { this.$vuetify.theme.global.name = savedTheme; } catch { /* */ }

      const params = new URLSearchParams(
        window.location.search || window.location.hash.split("?")[1] || ""
      );
      const moduleId = params.get("module");
      if (moduleId) {
        this.module = moduleId;
        this.$appdata.set("popup_module", moduleId);
      }

      this.stateHandler = window.electron.on("state-update", (data) => {
        this._applyStateEntry(data);
      });
      // Lote atômico (ver AppData.js setMultiple) — aplica tudo em sequência
      // antes de ceder o controle, então nenhum watcher/computed daqui vê um
      // estado combinado intermediário incorreto (ex.: show+minimized).
      this.batchHandler = window.electron.on("state-update-batch", (entries) => {
        (entries || []).forEach((entry) => this._applyStateEntry(entry));
      });

      this.moduleHandler = window.electron.on("set-module", (id) => {
        if (id) {
          this.module = id;
          this.$appdata.set("popup_module", id);
        }
      });

      // Recebe sinal do main para iniciar fade-out antes de fechar
      this.closingHandler = window.electron.on("output-closing", () => {
        this.startFadeOut();
      });

      window.electron.notifyOutputReady('output');

      // Fallback: para módulos sem imagem de capa (ou se modules.media.data não chegar),
      // revela depois de 500 ms para não bloquear indefinidamente a janela de saída.
      this._revealTimer = setTimeout(() => this._revealWindow(null), 500);
    },

    initBrowser() {
      this.$appdata.set("is_popup", true);

      const params = new URLSearchParams(window.location.search || "");
      const moduleId = params.get("module");
      if (moduleId) {
        this.module = moduleId;
        this.$appdata.set("popup_module", moduleId);
      }

      window.addEventListener("message", (event) => {
        if (event.origin !== window.location.origin) return;
        if (Array.isArray(event.data?.batch)) {
          event.data.batch.forEach((entry) => this._applyStateEntry(entry));
          return;
        }
        this._applyStateEntry(event.data);
      });
      // Fallback para browser: revela se não chegar dados de mídia
      this._revealTimer = setTimeout(() => this._revealWindow(null), 500);

      try {
        window.opener?.postMessage("mounted", window.location.origin);
      } catch { /* */ }

      window.addEventListener("beforeunload", () => {
        try {
          window.opener?.postMessage("closed", window.location.origin);
        } catch { /* */ }
      });
    },

    handleKeyDown(e) {
      if (e.key === "Escape") {
        // O player de vídeo trata o próprio ESC (mesmo efeito do botão
        // "Parar": só esmaece e para o vídeo/imagem, sem fechar a janela de
        // saída — ver video_player/interface/Popup.vue#_escHandler). Não dá
        // pra confiar na ordem de registro dos listeners de keydown pra
        // evitar que os dois ajam ao mesmo tempo (o componente do módulo
        // monta de forma assíncrona via defineAsyncComponent, então esse
        // handler aqui sempre registra primeiro) — por isso o corte
        // explícito aqui, direto na origem.
        if (this.module === "video_player") return;
        if (isElectron()) {
          // Inicia fade-out localmente; o main fecha a janela após o delay
          this.startFadeOut();
          setTimeout(() => window.electron.closeOutput(), FADE_MS);
        } else {
          this.startFadeOut();
        }
      }
    },
  },
  mounted() {
    document.addEventListener("keydown", this.handleKeyDown);

    // Transparência global para html/body/vuetify
    const style = document.createElement("style");
    style.id = "popup-transparent";
    style.textContent = `
      html, body, #app, #app-container,
      .v-application, .v-application__wrap {
        background: transparent !important;
        background-color: transparent !important;
      }
    `;
    document.head.appendChild(style);

    if (isElectron()) {
      this.initElectron();
    } else {
      this.initBrowser();
    }
  },
  beforeUnmount() {
    clearTimeout(this._revealTimer);
    document.removeEventListener("keydown", this.handleKeyDown);
    if (isElectron()) {
      if (this.stateHandler)  window.electron.off("state-update",    this.stateHandler);
      if (this.batchHandler)  window.electron.off("state-update-batch", this.batchHandler);
      if (this.moduleHandler) window.electron.off("set-module",       this.moduleHandler);
      if (this.closingHandler) window.electron.off("output-closing",  this.closingHandler);
    }
  },
};
</script>

<style scoped>
.popup-root {
  position: fixed;
  inset: 0;
  background: transparent;
}

.popup-fade-enter-active {
  transition: opacity 0.45s ease-in-out;
}
.popup-fade-leave-active {
  transition: opacity 0.4s ease-in-out;
}
.popup-fade-enter-from,
.popup-fade-leave-to {
  opacity: 0;
}

/* Crossfade entre módulos (ver comentário no template) — 1s para acompanhar
   o fade interno do video_player (mesmo tempo, ver Popup.vue dele) em vez de
   um corte perceptível antes dele terminar. */
.module-crossfade-enter-active,
.module-crossfade-leave-active {
  transition: opacity 1s ease;
}
.module-crossfade-enter-from,
.module-crossfade-leave-to {
  opacity: 0;
}
/* position:absolute para os dois <div> (antigo saindo + novo entrando) se
   sobreporem exatamente durante o crossfade, em vez de empilhar um embaixo
   do outro no fluxo normal (ambos existem juntos no DOM nesse intervalo,
   agora que a transição não usa mais mode="out-in"). */
.module-crossfade-item {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
