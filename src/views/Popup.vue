<template>
  <transition name="popup-fade" appear>
    <div v-if="visible" class="popup-root">
      <component
        v-if="moduleComponent"
        :is="moduleComponent"
        style="width: 100%; height: 100%;"
      />
    </div>
  </transition>
</template>

<script>
import { defineAsyncComponent } from "vue";

const isElectron = () =>
  typeof window !== "undefined" &&
  typeof window.electron !== "undefined" &&
  navigator.userAgent.includes("Electron");

const FADE_MS = 400;

export default {
  name: "PopupPage",
  data: () => ({
    module: null,
    visible: true,
    stateHandler: null,
    moduleHandler: null,
    closingHandler: null,
  }),
  computed: {
    moduleComponent() {
      const mod = this.module;
      if (!mod) return null;
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
    startFadeOut() {
      this.visible = false;
      // Para o browser: fecha a janela após a animação terminar
      if (!isElectron()) {
        setTimeout(() => window.close(), FADE_MS);
      }
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
        if (data && data.param) {
          this.$appdata.set(data.param, data.value);
          if (data.param === "popup_module" && data.value) {
            this.module = data.value;
          }
          if (data.param === "theme" && data.value) {
            try { this.$vuetify.theme.global.name = data.value; } catch { /* */ }
          }
        }
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

      window.electron.notifyOutputReady();
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
        if (event.origin === window.location.origin) {
          if (event.data.param) {
            this.$appdata.set(event.data.param, event.data.value);
            if (event.data.param === "popup_module" && event.data.value) {
              this.module = event.data.value;
            }
            if (event.data.param === "theme" && event.data.value) {
              try { this.$vuetify.theme.global.name = data.value; } catch { /* */ }
            }
          }
        }
      });

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
    document.removeEventListener("keydown", this.handleKeyDown);
    if (isElectron()) {
      if (this.stateHandler)  window.electron.off("state-update",    this.stateHandler);
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
</style>
