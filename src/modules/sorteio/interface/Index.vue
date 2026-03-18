<template>
  <l-window
    v-model="module.show"
    :title="t('title')"
    :icon="module.icon"
    closable
    minimizable
    compact
    compact_footer
    @close="close()"
    @minimize="$modules.minimize(module_id)"
    @resize="resize"
    :index="show ? 1 : 0"
  >
    <template v-slot:customize>
      <l-customization-tools
        :module="module"
        :items="[
          {
            name: t('customization.background'),
            items: [
              'background_color',
              ['image', 'image_opacity', 'image_fit'],
            ],
          },
          {
            name: t('customization.text'),
            items: [['font', 'font_size', 'font_color']],
          },
          { name: t('customization.window'), items: ['border_spacing'] },
        ]"
      />
    </template>

    <template v-slot:system_buttons>
      <LScreenBtn module="sorteio" />
    </template>

    <!-- ===== HEADER: TABS + TOOLBAR ===== -->
    <template v-slot:header>
      <!-- Tabs -->
      <v-tabs v-model="activeTab" density="compact">
        <v-tab value="numbers">
          <v-icon start size="15">mdi-pound</v-icon>
          {{ t("tab_numbers") }}
        </v-tab>
        <v-tab value="names">
          <v-icon start size="15">mdi-format-text</v-icon>
          {{ t("tab_names") }}
        </v-tab>
      </v-tabs>

      <!-- Toolbar NÚMEROS -->
      <l-toolbar v-show="activeTab === 'numbers'">
        <l-toolbar-item>
          <v-btn
            color="green"
            size="small"
            variant="tonal"
            :disabled="isAnimating || availableList.length === 0"
            @click="draw()"
          >
            <v-icon left>mdi-play</v-icon>
            {{ t("draw") }}
          </v-btn>
          <span v-if="isDesktop" class="text-caption ml-1" style="opacity:0.5">F4</span>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-text-field
            v-model.number="initialVal"
            :label="t('initial')"
            type="number"
            variant="outlined"
            density="compact"
            hide-details
            style="width: 75px"
          />
        </l-toolbar-item>

        <l-toolbar-item>
          <v-text-field
            v-model.number="finalVal"
            :label="t('final')"
            type="number"
            variant="outlined"
            density="compact"
            hide-details
            style="width: 75px"
          />
        </l-toolbar-item>

        <l-toolbar-item>
          <v-btn size="small" variant="tonal" @click="addNumbers()">
            <v-icon left>mdi-plus</v-icon>
            {{ t("add") }}
          </v-btn>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-btn size="small" variant="tonal" @click="showImportDialog = true">
            <v-icon left>mdi-import</v-icon>
            {{ t("import_list") }}
          </v-btn>
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="sorteio-counter">
            <span class="sorteio-counter__value">{{ availableList.length }}</span>
            <span class="sorteio-counter__label">{{ t("available") }}</span>
          </div>
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="sorteio-counter">
            <span class="sorteio-counter__value">{{ drawnList.length }}</span>
            <span class="sorteio-counter__label">{{ t("drawn") }}</span>
          </div>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-btn color="orange" size="small" icon variant="tonal" :title="t('reiniciar')" @click="reiniciar()">
            <v-icon size="18">mdi-restore</v-icon>
          </v-btn>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-btn color="red" size="small" variant="tonal" @click="clearAll()">
            <v-icon left>mdi-delete</v-icon>
            {{ t("clear_all") }}
          </v-btn>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-text-field
            v-model.number="animationTime"
            :label="t('animation')"
            type="number"
            step="0.5"
            min="0"
            variant="outlined"
            density="compact"
            hide-details
            style="width: 105px"
          />
        </l-toolbar-item>

        <l-toolbar-item>
          <v-checkbox v-model="showNumbers" :label="t('numbers')" density="compact" hide-details />
        </l-toolbar-item>

        <l-toolbar-item>
          <v-checkbox v-model="showDrawn" :label="t('show_drawn')" density="compact" hide-details />
        </l-toolbar-item>
      </l-toolbar>

      <!-- Toolbar NOMES -->
      <l-toolbar v-show="activeTab === 'names'">
        <l-toolbar-item>
          <v-btn
            color="green"
            size="small"
            variant="tonal"
            :disabled="isAnimating || namesAvailableList.length === 0"
            @click="draw()"
          >
            <v-icon left>mdi-play</v-icon>
            {{ t("draw") }}
          </v-btn>
          <span v-if="isDesktop" class="text-caption ml-1" style="opacity:0.5">F4</span>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-text-field
            v-model="nameInput"
            :label="t('name_input')"
            variant="outlined"
            density="compact"
            hide-details
            style="width: 160px"
            @keyup.enter="addName()"
          />
        </l-toolbar-item>

        <l-toolbar-item>
          <v-btn size="small" variant="tonal" @click="addName()">
            <v-icon left>mdi-plus</v-icon>
            {{ t("add") }}
          </v-btn>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-btn size="small" variant="tonal" @click="showImportDialog = true">
            <v-icon left>mdi-import</v-icon>
            {{ t("import_list") }}
          </v-btn>
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="sorteio-counter">
            <span class="sorteio-counter__value">{{ namesAvailableList.length }}</span>
            <span class="sorteio-counter__label">{{ t("available") }}</span>
          </div>
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="sorteio-counter">
            <span class="sorteio-counter__value">{{ namesDrawnList.length }}</span>
            <span class="sorteio-counter__label">{{ t("drawn") }}</span>
          </div>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-btn color="orange" size="small" icon variant="tonal" :title="t('reiniciar')" @click="reiniciar()">
            <v-icon size="18">mdi-restore</v-icon>
          </v-btn>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-btn color="red" size="small" variant="tonal" @click="clearAll()">
            <v-icon left>mdi-delete</v-icon>
            {{ t("clear_all") }}
          </v-btn>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-text-field
            v-model.number="animationTime"
            :label="t('animation')"
            type="number"
            step="0.5"
            min="0"
            variant="outlined"
            density="compact"
            hide-details
            style="width: 105px"
          />
        </l-toolbar-item>

        <l-toolbar-item>
          <v-checkbox v-model="showNumbers" :label="t('names_list')" density="compact" hide-details />
        </l-toolbar-item>

        <l-toolbar-item>
          <v-checkbox v-model="showDrawn" :label="t('show_drawn')" density="compact" hide-details />
        </l-toolbar-item>
      </l-toolbar>
    </template>

    <!-- ===== TELA PRINCIPAL ===== -->
    <Screen ref="screen" :override-panels="true" />

    <!-- ===== RODAPÉ ===== -->
    <template v-slot:footer>
      <div class="sorteio-footer">
        <v-btn size="small" color="error" variant="tonal" class="text-none" @click="clearAvailable()">
          <v-icon size="16" start>mdi-cancel</v-icon>
          {{ t("clear_available") }}
        </v-btn>
        <v-spacer />
        <v-btn size="small" color="error" variant="tonal" class="text-none" @click="clearDrawn()">
          <v-icon size="16" start>mdi-history</v-icon>
          {{ t("clear_drawn") }}
        </v-btn>
      </div>
    </template>
  </l-window>

  <!-- Dialog importar lista -->
  <v-dialog v-model="showImportDialog" width="500">
    <v-card>
      <v-card-title>{{ t("import_list") }}</v-card-title>
      <v-card-text>
        <!-- File picker oculto -->
        <input
          ref="fileInput"
          type="file"
          accept=".txt,.csv"
          style="display: none"
          @change="readFile"
        />

        <!-- Botão importar arquivo -->
        <v-btn block variant="tonal" class="mb-4" @click="$refs.fileInput.click()">
          <v-icon left>mdi-file-upload-outline</v-icon>
          {{ t("import_file") }}
        </v-btn>

        <v-divider class="mb-4" />

        <!-- Textarea para colar -->
        <v-textarea
          v-model="importText"
          :label="activeTab === 'names' ? t('import_hint_names') : t('import_hint_numbers')"
          rows="7"
          variant="outlined"
          hide-details
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="showImportDialog = false">{{ t("cancel") }}</v-btn>
        <v-btn
          color="primary"
          variant="tonal"
          :disabled="!importText.trim()"
          @click="importData()"
        >{{ t("import") }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import manifest from "../manifest.json";
import LWindow from "@/components/Window.vue";
import Screen from "../components/Screen.vue";
import LScreenBtn from "@/components/buttons/Screen.vue";
import LCustomizationTools from "@/components/CustomizationTools.vue";
import LToolbar from "@/components/Toolbar.vue";
import LToolbarItem from "@/components/ToolbarItem.vue";

export default {
  name: manifest.id,
  components: {
    LWindow,
    Screen,
    LScreenBtn,
    LCustomizationTools,
    LToolbar,
    LToolbarItem,
  },
  data: () => ({
    animTimer: null,
    nameInput: "",
    importText: "",
    showImportDialog: false,
  }),
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
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
    /* COMPUTEDS OBRIGATÓRIAS - FIM */

    show() {
      return this.module.show;
    },
    isDesktop() {
      return this.$appdata.get("is_desktop");
    },

    // Tab ativa (sincronizada com appdata para o popup)
    activeTab: {
      get() { return this.appdata.active_tab || "numbers"; },
      set(v) { this.appdata.active_tab = v; },
    },

    // Números
    availableList() { return this.appdata.available || []; },
    drawnList() { return this.appdata.drawn || []; },

    // Nomes
    namesAvailableList() { return this.appdata.names_available || []; },
    namesDrawnList() { return this.appdata.names_drawn || []; },

    isAnimating() { return this.appdata.animating || false; },

    // Userdata bindings
    initialVal: {
      get() { return this.userdata.initial ?? 1; },
      set(v) { this.userdata.initial = v; },
    },
    finalVal: {
      get() { return this.userdata.final ?? 100; },
      set(v) { this.userdata.final = v; },
    },
    animationTime: {
      get() { return this.userdata.animation_time ?? 1.5; },
      set(v) { this.userdata.animation_time = v; },
    },
    showNumbers: {
      get() { return this.userdata.show_numbers !== false; },
      set(v) { this.userdata.show_numbers = v; },
    },
    showDrawn: {
      get() { return this.userdata.show_drawn !== false; },
      set(v) { this.userdata.show_drawn = v; },
    },
  },
  methods: {
    /* METHODS OBRIGATÓRIAS - INÍCIO */
    t(text) {
      return this.$t(`modules.${this.module_id}.${text}`);
    },
    /* METHODS OBRIGATÓRIAS - FIM */

    resize() {},

    close() {
      this._stopAnimation();
      this.$modules.close(this.module_id);
    },

    padNumber(n) {
      const len = Math.max(4, (this.finalVal || 100).toString().length);
      return String(n).padStart(len, "0");
    },

    // ---- NÚMEROS ----
    addNumbers() {
      const start = Math.min(this.initialVal, this.finalVal);
      const end = Math.max(this.initialVal, this.finalVal);
      const existing = new Set([...this.availableList, ...this.drawnList]);
      const newNums = [];
      for (let i = start; i <= end; i++) {
        if (!existing.has(i)) newNums.push(i);
      }
      this.appdata.available = [...this.availableList, ...newNums];
    },

    // ---- NOMES ----
    addName() {
      const name = this.nameInput.trim();
      if (!name) return;
      const existing = new Set([...this.namesAvailableList, ...this.namesDrawnList]);
      if (!existing.has(name)) {
        this.appdata.names_available = [...this.namesAvailableList, name];
      }
      this.nameInput = "";
    },

    importFromText(text) {
      const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      if (this.activeTab === "names") {
        const existing = new Set([...this.namesAvailableList, ...this.namesDrawnList]);
        const newItems = lines.filter((n) => !existing.has(n));
        this.appdata.names_available = [...this.namesAvailableList, ...newItems];
      } else {
        const nums = lines.map((l) => parseInt(l)).filter((n) => !isNaN(n));
        const existing = new Set([...this.availableList, ...this.drawnList]);
        const newNums = nums.filter((n) => !existing.has(n));
        this.appdata.available = [...this.availableList, ...newNums];
      }
    },

    importData() {
      this.importFromText(this.importText);
      this.importText = "";
      this.showImportDialog = false;
    },

    readFile(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.importFromText(e.target.result);
        this.showImportDialog = false;
      };
      reader.readAsText(file, "UTF-8");
      event.target.value = "";
    },

    // ---- SORTEAR (funciona para ambas as abas) ----
    draw() {
      const isNames = this.activeTab === "names";
      const pool = [...(isNames ? this.namesAvailableList : this.availableList)];
      if (this.isAnimating || pool.length === 0) return;

      const winner = pool[Math.floor(Math.random() * pool.length)];
      this.appdata.animating = true;

      this.animTimer = setInterval(() => {
        const rnd = pool[Math.floor(Math.random() * pool.length)];
        if (isNames) {
          this.appdata.names_current = rnd;
        } else {
          this.appdata.current = this.padNumber(rnd);
        }
      }, 60);

      setTimeout(() => {
        this._stopAnimation();
        const remaining = pool.filter((n) => n !== winner);
        if (isNames) {
          this.appdata.names_current = winner;
          this.appdata.names_available = remaining;
          this.appdata.names_drawn = [winner, ...(this.appdata.names_drawn || [])];
        } else {
          this.appdata.current = this.padNumber(winner);
          this.appdata.available = remaining;
          this.appdata.drawn = [winner, ...(this.appdata.drawn || [])];
        }
        this.appdata.animating = false;
        if (remaining.length === 0) {
          setTimeout(() => {
            if (isNames) {
              this.appdata.names_current = "Fim!";
            } else {
              this.appdata.current = "Fim!";
            }
          }, 1500);
        }
      }, (this.animationTime || 1.5) * 1000);
    },

    reiniciar() {
      this._stopAnimation();
      this.appdata.animating = false;
      if (this.activeTab === "names") {
        const all = [...this.namesAvailableList, ...this.namesDrawnList];
        this.appdata.names_available = all;
        this.appdata.names_drawn = [];
        this.appdata.names_current = "";
      } else {
        const all = [...this.availableList, ...this.drawnList].sort((a, b) => a - b);
        this.appdata.available = all;
        this.appdata.drawn = [];
        this.appdata.current = this.padNumber(0);
      }
    },

    clearAll() {
      this._stopAnimation();
      this.appdata.animating = false;
      if (this.activeTab === "names") {
        this.appdata.names_available = [];
        this.appdata.names_drawn = [];
        this.appdata.names_current = "";
      } else {
        this.appdata.available = [];
        this.appdata.drawn = [];
        this.appdata.current = this.padNumber(0);
      }
    },

    clearAvailable() {
      if (this.activeTab === "names") {
        this.appdata.names_available = [];
      } else {
        this.appdata.available = [];
      }
    },

    clearDrawn() {
      if (this.activeTab === "names") {
        this.appdata.names_drawn = [];
      } else {
        this.appdata.drawn = [];
      }
    },

    _stopAnimation() {
      if (this.animTimer) {
        clearInterval(this.animTimer);
        this.animTimer = null;
      }
    },

    handleKeydown(e) {
      if (e.key === "F4" && this.show) {
        e.preventDefault();
        this.draw();
      }
    },
  },
  mounted() {
    window.addEventListener("keydown", this.handleKeydown);
    if (this.appdata.available === null) {
      this.appdata.available = [];
      this.appdata.drawn = [];
      this.appdata.current = this.padNumber(0);
      this.appdata.names_available = [];
      this.appdata.names_drawn = [];
      this.appdata.names_current = "";
      this.appdata.animating = false;
    }
  },
  unmounted() {
    window.removeEventListener("keydown", this.handleKeydown);
    this._stopAnimation();
  },
};
</script>

<style scoped>
.sorteio-counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 48px;
}
.sorteio-counter__value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
}
.sorteio-counter__label {
  font-size: 10px;
  text-transform: uppercase;
  opacity: 0.6;
  letter-spacing: 0.04em;
}

.sorteio-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 12px;
  gap: 8px;
}
</style>
