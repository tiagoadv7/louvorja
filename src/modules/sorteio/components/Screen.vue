<template>
  <div ref="container" class="sorteio-screen" :style="containerStyle">
    <!-- Imagem de fundo -->
    <img
      v-if="userdata.image"
      :src="userdata.image"
      :style="{
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        position: 'absolute',
        objectFit: userdata.image_fit || 'cover',
        opacity: (userdata.image_opacity ?? 100) / 100,
        zIndex: 0,
      }"
    />

    <!-- Painel esquerdo -->
    <div v-if="showLeftPanel" class="sorteio-panel" :style="panelBorderStyle">
      <div class="sorteio-panel__header" :style="panelHeaderStyle">
        <v-icon size="14" class="mr-1" :color="fontColor">{{ isNamesMode ? "mdi-format-text" : "mdi-pound" }}</v-icon>
        {{ leftPanelTitle }}
      </div>
      <div class="sorteio-panel__content sorteio-panel__content--column">
        <span
          v-for="(item, i) in leftPanelItems"
          :key="i"
          class="sorteio-chip"
          :style="chipStyle"
        >
          {{ item }}
        </span>
      </div>
    </div>

    <!-- Centro: display do sorteado atual -->
    <div class="sorteio-center" :style="{ padding: `${borderSpacing}px` }">
      <span
        :key="showFim ? 'fim' : revealId"
        :style="numberStyle"
        :class="{
          'sorteio-animating': isAnimating,
          'sorteio-reveal-anim': !isAnimating && !showFim && revealId > 0,
          'sorteio-fim-anim': showFim,
        }"
      >
        {{ displayCurrent }}
      </span>
    </div>

    <!-- Painel direito -->
    <div v-if="showRightPanel" class="sorteio-panel sorteio-panel--right" :style="panelBorderStyle">
      <div class="sorteio-panel__header" :style="panelHeaderStyle">
        <v-icon size="14" class="mr-1" :color="fontColor">mdi-history</v-icon>
        {{ rightPanelTitle }}
      </div>
      <div class="sorteio-panel__content sorteio-panel__content--column">
        <span
          v-for="(item, i) in rightPanelItems"
          :key="i"
          class="sorteio-chip"
          :class="{ 'sorteio-chip--latest': i === 0 }"
          :style="i === 0 ? chipLatestStyle : chipStyle"
        >
          {{ item }}
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import manifest from "../manifest.json";

export default {
  name: "SorteioScreen",
  props: {
    overridePanels: {
      type: Boolean,
      default: false,
    },
  },
  data: () => ({
    s_width: 0,
    s_height: 0,
  }),
  computed: {
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => this.$userdata.get(`modules.${this.module.id}.${key}`, null),
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    appdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => this.$appdata.get(`modules.${this.module.id}.${key}`, null),
          set: (_, key, value) => {
            this.$appdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },

    isNamesMode() {
      return (this.appdata.active_tab || "numbers") === "names";
    },
    isAnimating() {
      return this.appdata.animating || false;
    },

    // Painéis visíveis
    showLeftPanel() {
      return this.overridePanels || this.userdata.show_numbers !== false;
    },
    showRightPanel() {
      return this.overridePanels || this.userdata.show_drawn !== false;
    },

    // Itens dos painéis conforme o modo
    leftPanelItems() {
      if (this.isNamesMode) {
        return this.appdata.names_available || [];
      }
      return [...(this.appdata.available || [])].sort((a, b) => a - b);
    },
    rightPanelItems() {
      if (this.isNamesMode) {
        return this.appdata.names_drawn || [];
      }
      return this.appdata.drawn || [];
    },

    // Títulos dos painéis
    leftPanelTitle() {
      const key = this.isNamesMode ? "names_title" : "numbers_title";
      try { return this.$t(`modules.${this.module_id}.${key}`); } catch { return key; }
    },
    rightPanelTitle() {
      const key = this.isNamesMode ? "names_drawn_title" : "drawn_title";
      try { return this.$t(`modules.${this.module_id}.${key}`); } catch { return key; }
    },

    // Valor exibido no centro
    padLength() {
      return Math.max(4, (this.userdata.final || 100).toString().length);
    },
    displayCurrent() {
      if (this.showFim) return "Fim!";
      if (this.isNamesMode) {
        return this.appdata.names_current || "-------";
      }
      const val = this.appdata.current;
      if (!val) return "0".repeat(this.padLength);
      return val;
    },

    revealId() { return this.appdata.reveal_id || 0; },

    // Estilos
    bgColor() {
      return this.userdata.background_color || this.$vuetify.theme.global.current.colors.primary;
    },
    fontColor() { return this.userdata.font_color || this.$vuetify.theme.global.current.colors["on-primary"] || "#FFFFFF"; },
    font() { return this.userdata.font || "Arial, sans-serif"; },
    fontSizePx() {
      const pc = this.userdata.font_size || 30;
      const v = Math.min(this.s_width, this.s_height);
      return (pc * v) / 100 / 2;
    },
    borderSpacing() { return this.userdata.border_spacing || 10; },
    panelFontSizePx() { return this.userdata.panel_font_size || 14; },

    containerStyle() {
      return {
        background: this.bgColor,
        color: this.fontColor,
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      };
    },
    panelBorderStyle() {
      return { borderColor: `${this.fontColor}33`, zIndex: 1 };
    },
    panelHeaderStyle() {
      return { color: this.fontColor };
    },
    numberStyle() {
      return {
        fontSize: `${this.fontSizePx}px`,
        color: this.fontColor,
        fontWeight: "bold",
        fontFamily: this.isNamesMode ? this.font : "monospace",
        letterSpacing: this.isNamesMode ? "normal" : "0.05em",
        userSelect: "none",
        zIndex: 1,
        position: "relative",
        textAlign: "center",
        wordBreak: "break-word",
        maxWidth: "100%",
      };
    },
    chipStyle() {
      return { background: `${this.fontColor}18`, color: this.fontColor, fontSize: `${this.panelFontSizePx}px` };
    },
    chipLatestStyle() {
      return { background: `${this.fontColor}40`, color: this.fontColor, fontWeight: "bold", fontSize: `${this.panelFontSizePx}px` };
    },
    showFim() {
      return this.appdata.fim === true;
    },
  },
  methods: {
    windowResize() {
      const container = this.$refs.container;
      if (container) {
        this.s_width = container.offsetWidth;
        this.s_height = container.offsetHeight;
        if (this.s_width <= 0 || this.s_height <= 0) {
          setTimeout(() => this.windowResize(), 100);
        }
      }
    },
  },
  mounted() {
    this.windowResize();
    window.addEventListener("resize", this.windowResize);
  },
  unmounted() {
    window.removeEventListener("resize", this.windowResize);
  },
};
</script>

<style scoped>
.sorteio-screen {
  position: relative;
}

.sorteio-panel {
  width: 210px;
  min-width: 210px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid;
  position: relative;
  z-index: 1;
}
.sorteio-panel--right {
  border-right: none;
  border-left: 1px solid;
}

.sorteio-panel__header {
  padding: 10px 12px 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  opacity: 0.65;
  letter-spacing: 0.08em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.sorteio-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 4px;
}
.sorteio-panel__content--column {
  flex-direction: column;
  flex-wrap: nowrap;
}
.sorteio-panel__content::-webkit-scrollbar { width: 4px; }
.sorteio-panel__content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.sorteio-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  z-index: 1;
}

.sorteio-chip {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 4px;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.sorteio-animating {
  opacity: 0.85;
}

.sorteio-reveal-anim {
  animation: sorteio-reveal 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes sorteio-reveal {
  0%   { transform: scale(0.6) translateY(12px); opacity: 0.2; }
  65%  { transform: scale(1.06) translateY(-3px); opacity: 1; }
  82%  { transform: scale(0.98) translateY(0); }
  100% { transform: scale(1)    translateY(0); opacity: 1; }
}

.sorteio-fim-anim {
  animation: sorteio-fim 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes sorteio-fim {
  0%   { transform: scale(0.2); opacity: 0; }
  60%  { transform: scale(1.12); opacity: 1; }
  78%  { transform: scale(0.96); }
  90%  { transform: scale(1.04); }
  100% { transform: scale(1);    opacity: 1; }
}
</style>
