<template>
  <l-window
    v-model="module.show"
    :title="t('title')"
    :icon="module.icon"
    closable
    minimizable
    :index="show ? 1 : 0"
    @close="close()"
    @minimize="$modules.minimize(module_id)"
  >
    <template v-slot:system_buttons>
      <LScreenBtn module="interactive_text" />
    </template>

    <template v-slot:customize>
      <l-customization-tools
        :module="module"
        :items="[
          {
            name: t('customization.background'),
            items: ['background_color', ['image', 'image_opacity', 'image_fit']],
          },
        ]"
      />
    </template>

    <template v-slot:header>
      <div class="it-toolbar">
        <div class="it-toolbar-group">
          <button class="se-btn-outline" @click="importText">
            <v-icon size="15">mdi-file-import-outline</v-icon> {{ t("actions.import_txt") }}
          </button>
          <button class="se-btn-outline" @click="exportText">
            <v-icon size="15">mdi-file-export-outline</v-icon> {{ t("actions.export_txt") }}
          </button>
          <button class="se-btn-outline" @click="clearText">
            <v-icon size="15">mdi-eraser</v-icon> {{ t("actions.clear") }}
          </button>
        </div>
        <span class="it-sep" />
        <div class="it-toolbar-group">
          <button class="se-btn-icon" :title="t('actions.cut')" @click="exec('cut')">
            <v-icon size="16">mdi-content-cut</v-icon>
          </button>
          <button class="se-btn-icon" :title="t('actions.copy')" @click="exec('copy')">
            <v-icon size="16">mdi-content-copy</v-icon>
          </button>
          <button class="se-btn-icon" :title="t('actions.paste')" @click="pasteText">
            <v-icon size="16">mdi-content-paste</v-icon>
          </button>
        </div>
        <span class="it-sep" />
        <div class="it-toolbar-group">
          <select v-model="fontFamily" class="it-select" @change="applyFontName">
            <option v-for="f in FONT_OPTIONS" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
          <input
            ref="fontSizeInput"
            type="number"
            min="8"
            max="120"
            v-model.number="fontSize"
            class="se-num-input"
            :title="t('labels.size')"
            @input="applyFontSize"
          />
        </div>
        <span class="it-sep" />
        <div class="it-toolbar-group">
          <button class="se-btn-icon" title="Bold" @click="exec('bold')"><v-icon size="16">mdi-format-bold</v-icon></button>
          <button class="se-btn-icon" title="Italic" @click="exec('italic')"><v-icon size="16">mdi-format-italic</v-icon></button>
          <button class="se-btn-icon" title="Strikethrough" @click="exec('strikeThrough')"><v-icon size="16">mdi-format-strikethrough</v-icon></button>
          <label class="it-color-btn" :title="t('labels.text_color')">
            <v-icon size="16">mdi-format-color-text</v-icon>
            <input type="color" v-model="textColor" @change="applyForeColor" />
          </label>
          <label class="it-color-btn" :title="t('labels.highlight_color')">
            <v-icon size="16">mdi-marker</v-icon>
            <input type="color" v-model="highlightColor" @change="applyHiliteColor" />
          </label>
        </div>
        <span class="it-sep" />
        <div class="it-toolbar-group">
          <button
            v-for="opt in ['left', 'center', 'right', 'justify']"
            :key="opt"
            class="se-btn-icon"
            @click="exec(`justify${opt.charAt(0).toUpperCase()}${opt.slice(1)}`)"
          >
            <v-icon size="16">{{ opt === "justify" ? "mdi-format-align-justify" : `mdi-format-align-${opt}` }}</v-icon>
          </button>
        </div>

        <input ref="fileTxt" type="file" accept=".txt" hidden @change="onImportTxt" />
      </div>
    </template>

    <div
      ref="editor"
      class="it-editor"
      contenteditable="true"
      @input="onInput"
    ></div>
  </l-window>
</template>

<script>
import manifest from "../manifest.json";
import LWindow from "@/components/Window.vue";
import LScreenBtn from "@/components/buttons/Screen.vue";
import LCustomizationTools from "@/components/CustomizationTools.vue";

const FONT_OPTIONS = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Helvetica", value: "Helvetica, sans-serif" },
  { label: "Times New Roman", value: "Times New Roman, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "Courier New, monospace" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
];

export default {
  name: "InteractiveTextModule",
  components: {
    LWindow,
    LScreenBtn,
    LCustomizationTools,
  },
  data: () => ({
    FONT_OPTIONS,
    fontFamily: "Tahoma, sans-serif",
    fontSize: 14,
    textColor: "#000000",
    highlightColor: "#FFFF00",
    _broadcastTimer: null,
    // Última seleção (ou posição do cursor) feita DENTRO do editor, com o
    // editor ainda em foco — ver saveSelection()/applyFontSize().
    _savedRange: null,
    _selectionHandler: null,
  }),
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */
    show() {
      return this.module.show;
    },
  },
  methods: {
    /* METHODS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    t(text) {
      const key = `modules.${this.module_id}.${text}`;
      const result = this.$t(key);
      if (result === key) {
        if (text === "title") return manifest.name || result;
        const locale = this.$i18n?.locale?.value || this.$i18n?.locale || "pt";
        const storedManifest = this.$appdata.get(`modules.${this.module_id}.manifest`);
        const translations = storedManifest?.translations?.[locale] || storedManifest?.translations?.["pt"];
        if (translations) {
          const val = text.split(".").reduce((obj, k) => obj?.[k], translations);
          if (typeof val === "string") return val;
        }
      }
      return result;
    },
    close() {
      this.$modules.close(this.module_id);
    },
    /* METHODS OBRIGATÓRIAS - FIM */

    exec(command, value = null) {
      this.$refs.editor?.focus();
      document.execCommand(command, false, value);
      this.onInput();
    },
    applyFontName() {
      this.exec("fontName", this.fontFamily);
    },
    // Chromium colapsa/descarta a seleção do editor assim que o foco sai
    // dele (ex.: ao clicar no campo numérico de tamanho) — sem guardar a
    // seleção de antemão, ao voltar o foco pro editor pra rodar o
    // execCommand não haveria mais nenhum texto selecionado pra aplicar o
    // tamanho (e um <input type="number"> não expõe selectionStart/
    // setSelectionRange pra alguma outra forma de contornar isso). Por isso
    // guarda a seleção aqui (chamado em @selectionchange, só enquanto o
    // editor está de fato em foco — ver mounted()) e restaura em
    // applyFontSize() antes do execCommand.
    saveSelection() {
      const editor = this.$refs.editor;
      if (!editor || document.activeElement !== editor) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        this._savedRange = range.cloneRange();
      }
    },
    // execCommand('fontSize') só aceita a escala legada 1-7 — aplica com o
    // valor máximo (7) e depois reescreve o <font size="7"> resultante pra
    // um font-size em px real via CSS inline (truque padrão pra contornar
    // essa limitação do execCommand).
    //
    // Roda a cada dígito digitado no campo (@input, não @change) pra aplicar
    // o tamanho em tempo real. Focar o editor pra rodar o execCommand tira o
    // foco do próprio campo numérico — sem devolvê-lo no fim, o operador não
    // conseguiria digitar o próximo dígito (ele iria parar no editor).
    applyFontSize() {
      const editor = this.$refs.editor;
      if (!editor || !this._savedRange) return;
      editor.focus({ preventScroll: true });
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(this._savedRange);
      document.execCommand("fontSize", false, "7");
      editor.querySelectorAll('font[size="7"]').forEach((el) => {
        el.removeAttribute("size");
        el.style.fontSize = `${this.fontSize}px`;
      });
      // Atualiza a seleção guardada — depois do execCommand o range pode
      // apontar pro novo elemento que passou a envolver o texto, e o
      // próximo dígito digitado precisa continuar reaplicando ali.
      const newSel = window.getSelection();
      if (newSel.rangeCount) this._savedRange = newSel.getRangeAt(0).cloneRange();
      this.onInput();
      this.$refs.fontSizeInput?.focus({ preventScroll: true });
    },
    applyForeColor() {
      this.exec("foreColor", this.textColor);
    },
    applyHiliteColor() {
      this.exec("hiliteColor", this.highlightColor);
    },
    async pasteText() {
      try {
        const text = await navigator.clipboard.readText();
        this.exec("insertText", text);
      } catch {
        // Sem permissão de leitura da área de transferência — o operador
        // ainda pode colar normalmente com Ctrl+V.
      }
    },

    importText() {
      this.$refs.fileTxt?.click();
    },
    async onImportTxt(e) {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      const buf = await file.arrayBuffer();
      let text;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      } catch {
        text = new TextDecoder("windows-1252").decode(buf);
      }
      if (this.$refs.editor) {
        this.$refs.editor.innerText = text;
        this.onInput();
      }
    },
    exportText() {
      const text = this.$refs.editor?.innerText || "";
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "texto.txt";
      a.click();
      URL.revokeObjectURL(url);
    },
    clearText() {
      this.$alert.yesno({ title: this.t("data.clear_confirm"), translate: false }, (resp) => {
        if (resp !== "yes") return;
        if (this.$refs.editor) this.$refs.editor.innerHTML = "";
        this.onInput();
      });
    },

    onInput() {
      clearTimeout(this._broadcastTimer);
      this._broadcastTimer = setTimeout(() => this.broadcast(), 200);
    },
    broadcast() {
      const html = this.$refs.editor?.innerHTML || "";
      this.$appdata.set(`modules.${this.module_id}.html`, html);
    },
  },
  mounted() {
    this.broadcast();
    this._selectionHandler = () => this.saveSelection();
    document.addEventListener("selectionchange", this._selectionHandler);
  },
  beforeUnmount() {
    clearTimeout(this._broadcastTimer);
    document.removeEventListener("selectionchange", this._selectionHandler);
  },
};
</script>

<style scoped>
.it-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.it-toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.it-sep {
  width: 1px;
  align-self: stretch;
  background: rgba(var(--v-border-color), var(--v-border-opacity));
  margin: 0 4px;
}
.it-select {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  padding: 5px 8px;
  background: transparent;
  color: inherit;
  font-size: 12.5px;
}
.it-color-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.it-color-btn:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.it-color-btn input[type="color"] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.it-editor {
  min-height: 100%;
  padding: 16px 20px;
  outline: none;
  font-family: Tahoma, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

/* Botões compactos — mesmo padrão do resto da interface */
.se-btn-outline,
.se-btn-icon {
  display: flex;
  align-items: center;
  gap: 5px;
  border-radius: 6px;
  font-size: 12.5px;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  transition: background 0.15s;
  white-space: nowrap;
}
.se-btn-outline {
  padding: 6px 12px;
  border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}
.se-btn-outline:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.se-btn-icon {
  padding: 6px;
  width: 28px;
  height: 28px;
  justify-content: center;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.se-btn-icon:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.se-num-input {
  width: 56px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  padding: 5px 6px;
  background: transparent;
  color: inherit;
  font-size: 12.5px;
}
</style>
