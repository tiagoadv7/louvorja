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
            items: [['font', 'font_size', 'font_color'], 'panel_font_size'],
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
        <v-tab value="roulette">
          <v-icon start size="15">mdi-ferris-wheel</v-icon>
          {{ t("tab_roulette") }}
        </v-tab>
      </v-tabs>

      <!-- Toolbar NÚMEROS -->
      <l-toolbar v-show="activeTab === 'numbers'">
        <l-toolbar-item>
          <v-btn
            stacked
            color="green"
            size="small"
            variant="tonal"
            :disabled="isAnimating"
            @click="draw()"
          >
            <v-icon size="22">mdi-play</v-icon>
            {{ t("draw") }}
          </v-btn>
          <div v-if="isDesktop" class="text-caption text-center" style="opacity:0.5">F4</div>
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="d-flex align-end sorteio-input-row">
            <v-text-field
              v-model.number="initialVal"
              :label="t('initial')"
              type="number"
              variant="outlined"
              density="compact"
              hide-details
              style="width: 70px"
              @keyup.enter="addNumbers()"
            />
            <v-text-field
              v-model.number="finalVal"
              :label="t('final')"
              type="number"
              variant="outlined"
              density="compact"
              hide-details
              style="width: 70px"
              @keyup.enter="addNumbers()"
            />
            <v-btn icon size="small" color="primary" variant="tonal" :title="t('add')" @click="addNumbers()">
              <v-icon size="18">mdi-plus</v-icon>
            </v-btn>
          </div>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-btn stacked size="small" variant="tonal" @click="showImportDialog = true">
            <v-icon size="22">mdi-import</v-icon>
            {{ t("import_list") }}
          </v-btn>
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="sorteio-counter-group">
            <div class="sorteio-counter sorteio-counter--row">
              <span class="sorteio-counter__value">{{ availableList.length }}</span>
              <span class="sorteio-counter__label">{{ t("available") }}</span>
            </div>
            <div class="sorteio-counter sorteio-counter--row">
              <span class="sorteio-counter__value">{{ drawnList.length }}</span>
              <span class="sorteio-counter__label">{{ t("drawn") }}</span>
            </div>
          </div>
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="sorteio-stack-group">
            <v-btn size="x-small" variant="tonal" color="orange" @click="reiniciar()">
              <v-icon size="14" class="me-1">mdi-restore</v-icon>
              {{ t("reiniciar") }}
            </v-btn>
            <v-btn size="x-small" variant="tonal" color="red" @click="clearAll()">
              <v-icon size="14" class="me-1">mdi-delete</v-icon>
              {{ t("clear_all") }}
            </v-btn>
          </div>
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
          <div class="sorteio-checkbox-group">
            <v-checkbox v-model="showNumbers" :label="t('numbers')" density="compact" hide-details />
            <v-checkbox v-model="showDrawn" :label="t('show_drawn')" density="compact" hide-details />
          </div>
        </l-toolbar-item>
      </l-toolbar>

      <!-- Toolbar NOMES -->
      <l-toolbar v-show="activeTab === 'names'">
        <l-toolbar-item>
          <v-btn
            stacked
            color="green"
            size="small"
            variant="tonal"
            :disabled="isAnimating"
            @click="draw()"
          >
            <v-icon size="22">mdi-play</v-icon>
            {{ t("draw") }}
          </v-btn>
          <div v-if="isDesktop" class="text-caption text-center" style="opacity:0.5">F4</div>
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="d-flex align-end sorteio-input-row">
            <v-text-field
              v-model="nameInput"
              :label="t('name_input')"
              variant="outlined"
              density="compact"
              hide-details
              style="width: 150px"
              @keyup.enter="addName()"
            />
            <v-btn icon size="small" color="primary" variant="tonal" :title="t('add')" @click="addName()">
              <v-icon size="18">mdi-plus</v-icon>
            </v-btn>
          </div>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-btn stacked size="small" variant="tonal" @click="showImportDialog = true">
            <v-icon size="22">mdi-import</v-icon>
            {{ t("import_list") }}
          </v-btn>
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="sorteio-counter-group">
            <div class="sorteio-counter sorteio-counter--row">
              <span class="sorteio-counter__value">{{ namesAvailableList.length }}</span>
              <span class="sorteio-counter__label">{{ t("available") }}</span>
            </div>
            <div class="sorteio-counter sorteio-counter--row">
              <span class="sorteio-counter__value">{{ namesDrawnList.length }}</span>
              <span class="sorteio-counter__label">{{ t("drawn") }}</span>
            </div>
          </div>
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="sorteio-stack-group">
            <v-btn size="x-small" variant="tonal" color="orange" @click="reiniciar()">
              <v-icon size="14" class="me-1">mdi-restore</v-icon>
              {{ t("reiniciar") }}
            </v-btn>
            <v-btn size="x-small" variant="tonal" color="red" @click="clearAll()">
              <v-icon size="14" class="me-1">mdi-delete</v-icon>
              {{ t("clear_all") }}
            </v-btn>
          </div>
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
          <div class="sorteio-checkbox-group">
            <v-checkbox v-model="showNumbers" :label="t('names_list')" density="compact" hide-details />
            <v-checkbox v-model="showDrawn" :label="t('show_drawn')" density="compact" hide-details />
          </div>
        </l-toolbar-item>
      </l-toolbar>
      <!-- Toolbar ROLETA -->
      <l-toolbar v-show="activeTab === 'roulette'">
        <l-toolbar-item>
          <v-btn
            stacked
            color="green"
            size="small"
            variant="tonal"
            :disabled="rouletteSpinning || rouletteItems.length === 0"
            @click="rouletteSpin()"
          >
            <v-icon size="22">mdi-ferris-wheel</v-icon>
            {{ t("roulette_spin") }}
          </v-btn>
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="d-flex align-end sorteio-input-row">
            <v-text-field
              v-model="rouletteInput"
              :label="t('roulette_item_input')"
              variant="outlined"
              density="compact"
              hide-details
              style="width:150px"
              @keyup.enter="rouletteAdd()"
            />
            <v-btn icon size="small" color="primary" variant="tonal" :title="t('roulette_add')" @click="rouletteAdd()">
              <v-icon size="18">mdi-plus</v-icon>
            </v-btn>
          </div>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-btn stacked size="small" variant="tonal" @click="showRouletteImport = true">
            <v-icon size="22">mdi-import</v-icon>
            {{ t("roulette_import") }}
          </v-btn>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-btn stacked size="small" variant="tonal" @click="showFormsDialog = true">
            <v-icon size="22">mdi-google</v-icon>
            {{ t("roulette_forms") }}
          </v-btn>
        </l-toolbar-item>

        <l-toolbar-item>
          <v-btn
            stacked
            :color="regRunning ? 'success' : 'default'"
            size="small"
            variant="tonal"
            @click="toggleRegServer()"
          >
            <v-badge :content="regCount" :model-value="regCount > 0" color="primary">
              <v-icon size="22">mdi-qrcode</v-icon>
            </v-badge>
            {{ t("roulette_qr") }}
          </v-btn>
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="sorteio-counter-group">
            <div class="sorteio-counter sorteio-counter--row">
              <span class="sorteio-counter__value">{{ rouletteActiveItems.length }}</span>
              <span class="sorteio-counter__label">{{ t("available") }}</span>
            </div>
            <div class="sorteio-counter sorteio-counter--row">
              <span class="sorteio-counter__value">{{ rouletteDrawn.length }}</span>
              <span class="sorteio-counter__label">{{ t("drawn") }}</span>
            </div>
          </div>
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="sorteio-stack-group">
            <v-btn size="x-small" variant="tonal" color="orange" @click="rouletteReset()">
              <v-icon size="14" class="me-1">mdi-restore</v-icon>
              {{ t("roulette_reset") }}
            </v-btn>
            <v-btn size="x-small" variant="tonal" color="red" @click="rouletteClear()">
              <v-icon size="14" class="me-1">mdi-delete</v-icon>
              {{ t("roulette_clear") }}
            </v-btn>
          </div>
        </l-toolbar-item>

        <l-toolbar-item>
          <div class="sorteio-checkbox-group">
            <v-checkbox v-model="rouletteRemoveDrawn" :label="t('roulette_remove_drawn')" density="compact" hide-details />
            <v-checkbox v-model="rouletteShowParticipants" :label="t('roulette_participants')" density="compact" hide-details />
            <v-checkbox v-model="rouletteShowHistory" :label="t('roulette_history')" density="compact" hide-details />
          </div>
        </l-toolbar-item>
      </l-toolbar>
    </template>

    <!-- ===== TELA PRINCIPAL ===== -->
    <Screen v-show="activeTab !== 'roulette'" ref="screen" :override-panels="true" />

    <!-- ===== ABA ROLETA ===== -->
    <div v-show="activeTab === 'roulette'" class="roulette-screen">

      <!-- Painel esquerdo: participantes -->
      <div class="roulette-panel">
        <div class="roulette-panel__header">
          <v-icon size="14" class="mr-1">mdi-account-group-outline</v-icon>
          {{ t("roulette_participants") }}
          <span class="roulette-panel__count">{{ rouletteItems.length }}</span>
        </div>
        <div class="roulette-panel__content">
          <div
            v-for="(item, idx) in rouletteItems"
            :key="idx"
            class="roulette-item-row"
            :class="{ 'roulette-item-drawn': rouletteDrawn.includes(item) }"
          >
            <span class="roulette-item-text">{{ item }}</span>
            <v-btn icon size="x-small" variant="text" color="error" @click="rouletteRemoveItem(idx)">
              <v-icon size="14">mdi-close</v-icon>
            </v-btn>
          </div>
          <div v-if="rouletteItems.length === 0" class="roulette-panel__empty">{{ t("roulette_empty") }}</div>
        </div>
        <!-- QR mini quando ativo -->
        <div v-if="regRunning" class="roulette-qr-mini">
          <img v-if="qrDataUrl" :src="qrDataUrl" class="roulette-qr-mini__img" @click="openRegUrl" style="cursor:pointer" />
          <div v-else class="d-flex justify-center py-2"><v-progress-circular size="20" indeterminate /></div>
          <div class="roulette-qr-mini__url">
            <span>{{ regUrl }}</span>
            <v-btn icon size="x-small" variant="text" @click="copyRegUrl"><v-icon size="11">mdi-content-copy</v-icon></v-btn>
            <v-btn icon size="x-small" variant="text" @click="openRegUrl"><v-icon size="11">mdi-open-in-new</v-icon></v-btn>
          </div>
          <div v-if="regIps.length > 1" class="roulette-qr-mini__ips">
            <span
              v-for="ip in regIps"
              :key="ip"
              class="roulette-qr-mini__ip"
              :class="{ 'roulette-qr-mini__ip--active': regUrl.includes(ip) }"
              @click="changeRegIp(ip)"
            >{{ ip }}</span>
          </div>
          <div v-if="regCount > 0" class="roulette-qr-mini__count">{{ regCount }} {{ t("roulette_registrations") }}</div>
        </div>
      </div>

      <!-- Centro: roleta -->
      <div class="roulette-center">
        <div class="roulette-wheel-wrap">
          <RouletteWheel
            ref="rouletteWheel"
            :items="rouletteActiveItems"
            :disabled="rouletteSpinning"
            :show-winner-card="false"
            @spin-start="onRouletteSpinStart"
            @winner="onRouletteWinner"
          />
          <transition name="rw-top">
            <div v-if="rouletteCurrentWinner" class="rw-top-winner" :style="winnerTopStyle">
              {{ rouletteCurrentWinner }}
            </div>
          </transition>
        </div>
      </div>

      <!-- Painel direito: histórico -->
      <div class="roulette-panel roulette-panel--right">
        <div class="roulette-panel__header">
          <v-icon size="14" class="mr-1">mdi-history</v-icon>
          {{ t("roulette_history") }}
        </div>
        <div class="roulette-panel__content">
          <div
            v-for="(item, idx) in rouletteDrawn"
            :key="'d' + idx"
            class="roulette-item-row roulette-item-history"
          >
            <span class="roulette-item-num">{{ idx + 1 }}.</span>
            <span class="roulette-item-text">{{ item }}</span>
          </div>
          <div v-if="rouletteDrawn.length === 0" class="roulette-panel__empty">-</div>
        </div>
      </div>
    </div>

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

  <!-- Dialog importar lista roleta -->
  <v-dialog v-model="showRouletteImport" width="480" scrollable>
    <v-card>
      <v-card-title>{{ t("roulette_import") }}</v-card-title>
      <v-card-text>
        <input ref="rouletteFileInput" type="file" accept=".txt,.csv" style="display:none" @change="rouletteReadFile" />
        <v-btn block variant="tonal" class="mb-4" @click="$refs.rouletteFileInput.click()">
          <v-icon left>mdi-file-upload-outline</v-icon>
          {{ t("import_file") }}
        </v-btn>
        <v-divider class="mb-4" />
        <v-textarea
          v-model="rouletteImportText"
          :label="t('import_hint_names')"
          rows="6"
          variant="outlined"
          hide-details
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="showRouletteImport = false">{{ t("cancel") }}</v-btn>
        <v-btn color="primary" variant="tonal" @click="rouletteImportFromText()">{{ t("import") }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Dialog Google Forms -->
  <v-dialog v-model="showFormsDialog" width="560" scrollable>
    <v-card>
      <v-card-title>
        <v-icon start>mdi-google</v-icon>
        {{ t("roulette_forms") }}
      </v-card-title>
      <v-card-text>
        <div class="text-caption text-medium-emphasis mb-3">{{ t("roulette_forms_hint") }}</div>
        <v-textarea
          v-model="formsCsvText"
          label="CSV"
          rows="6"
          variant="outlined"
          hide-details
          class="mb-3"
          @update:model-value="parseForms"
        />
        <v-select
          v-if="formsCols.length > 0"
          v-model="formsSelectedCol"
          :items="formsCols"
          :label="t('roulette_forms_col')"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-3"
          @update:model-value="parseForms"
        />
        <div v-if="formsPreview.length > 0" class="text-caption mb-1 text-medium-emphasis">
          {{ t("roulette_forms_preview") }} ({{ formsPreview.length }})
        </div>
        <v-chip v-for="n in formsPreview.slice(0,12)" :key="n" size="small" class="mr-1 mb-1">{{ n }}</v-chip>
        <div v-if="formsPreview.length > 12" class="text-caption text-medium-emphasis">
          +{{ formsPreview.length - 12 }} mais…
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="showFormsDialog = false">{{ t("cancel") }}</v-btn>
        <v-btn color="primary" variant="tonal" :disabled="formsPreview.length === 0" @click="rouletteImportForms()">
          {{ t("roulette_forms_import") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Snackbar: sem itens disponíveis -->
  <v-snackbar
    v-model="noMoreSnack"
    color="warning"
    location="top"
    timeout="3000"
    rounded="pill"
  >
    <v-icon start>mdi-alert-circle-outline</v-icon>
    {{ noMoreMessage }}
  </v-snackbar>

  <!-- Dialog importar lista -->
  <v-dialog v-model="showImportDialog" width="500" scrollable>
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
          rows="5"
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
import RouletteWheel from "../components/RouletteWheel.vue";
import LScreenBtn from "@/components/buttons/Screen.vue";
import LCustomizationTools from "@/components/CustomizationTools.vue";
import LToolbar from "@/components/Toolbar.vue";
import LToolbarItem from "@/components/ToolbarItem.vue";

export default {
  name: manifest.id,
  components: {
    LWindow,
    Screen,
    RouletteWheel,
    LScreenBtn,
    LCustomizationTools,
    LToolbar,
    LToolbarItem,
  },
  data: () => ({
    // sorteio clássico
    animTimer:       null,
    nameInput:       "",
    importText:      "",
    showImportDialog: false,
    noMoreSnack:     false,
    noMoreMessage:   "",
    initialVal:      null,
    finalVal:        null,
    // roleta
    rouletteInput:        "",
    rouletteImportText:   "",
    showRouletteImport:   false,
    rouletteSpinning:     false,
    rouletteCurrentWinner: null,
    _winnerTimer:         null,
    // Google Forms
    showFormsDialog:    false,
    formsCsvText:       "",
    formsCols:          [],
    formsSelectedCol:   null,
    formsPreview:       [],
    // QR / registro
    regRunning: false,
    regUrl:     "",
    regPort:    0,
    regIps:     [],
    regCount:   0,
    qrDataUrl:  null,
    _regHandler: null,
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

    // ── Roleta ──────────────────────────────────────────────────────────
    rouletteItems() { return this.appdata.roulette_items || []; },
    rouletteDrawn()  { return this.appdata.roulette_drawn  || []; },
    rouletteActiveItems() {
      if (this.rouletteRemoveDrawn) {
        const drawn = new Set(this.rouletteDrawn);
        return this.rouletteItems.filter(i => !drawn.has(i));
      }
      return this.rouletteItems;
    },
    rouletteRemoveDrawn: {
      get() { return this.userdata.roulette_remove_drawn !== false; },
      set(v) { this.userdata.roulette_remove_drawn = v; },
    },

    rouletteShowParticipants: {
      get() { return this.userdata.roulette_show_participants !== false; },
      set(v) { this.userdata.roulette_show_participants = v; },
    },
    rouletteShowHistory: {
      get() { return this.userdata.roulette_show_history !== false; },
      set(v) { this.userdata.roulette_show_history = v; },
    },

    rouletteBg() {
      return this.userdata.background_color
        || this.$vuetify?.theme?.global?.current?.colors?.primary
        || '#1b2a41';
    },

    rouletteColor() {
      return this.userdata.font_color
        || this.$vuetify?.theme?.global?.current?.colors?.['on-primary']
        || '#ffffff';
    },

    roulettePanelBorder() {
      return `${this.rouletteColor}33`;
    },

    winnerTopStyle() {
      return { color: this.rouletteColor };
    },
  },
  methods: {
    /* METHODS OBRIGATÓRIAS - INÍCIO */
    t(text) {
      const key = `modules.${this.module_id}.${text}`;
      const result = this.$t(key);
      if (result === key) {
        if (text === 'title') return manifest.name || result;
        const locale = this.$i18n?.locale?.value || this.$i18n?.locale || 'pt';
        const storedManifest = this.$appdata.get(`modules.${this.module_id}.manifest`);
        const translations = storedManifest?.translations?.[locale] || storedManifest?.translations?.['pt'];
        if (translations) {
          const val = text.split('.').reduce((obj, k) => obj?.[k], translations);
          if (typeof val === 'string') return val;
        }
      }
      return result;
    },
    /* METHODS OBRIGATÓRIAS - FIM */

    resize() {},

    close() {
      this._stopAnimation();
      // Só sai da projeção se o Sorteio for de fato o módulo projetado agora —
      // senão, fechar o painel apagaria o que estiver sendo exibido.
      if (this.$appdata.get('popup_module') === this.module_id) this.$popup.exit();
      this.$modules.close(this.module_id);
    },

    padNumber(n) {
      const len = Math.max(4, (this.finalVal || 100).toString().length);
      return String(n).padStart(len, "0");
    },

    // ---- NÚMEROS ----
    addNumbers() {
      const a = parseFloat(this.initialVal);
      const b = parseFloat(this.finalVal);
      if (isNaN(a) || isNaN(b)) return;
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      const existing = new Set([...this.availableList, ...this.drawnList]);
      const newNums = [];
      for (let i = start; i <= end; i++) {
        if (!existing.has(i)) newNums.push(i);
      }
      this.appdata.available = [...this.availableList, ...newNums];
      this.userdata.initial = null;
      this.userdata.final = null;
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
      if (this.activeTab === "numbers") {
        this.userdata.initial = null;
        this.userdata.final = null;
      }
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
      if (this.isAnimating) return;
      if (pool.length === 0) {
        this.appdata.fim = true;
        this.noMoreMessage = isNames
          ? this.t("no_more_names")
          : this.t("no_more_numbers");
        this.noMoreSnack = true;
        return;
      }

      const winner = pool[Math.floor(Math.random() * pool.length)];
      this.appdata.animating = true;

      const totalMs = (this.animationTime || 1.5) * 1000;
      const startTime = Date.now();

      const tick = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / totalMs, 1);
        const interval = 12 + 100 * (progress * progress);
        const rnd = pool[Math.floor(Math.random() * pool.length)];
        if (isNames) {
          this.appdata.names_current = rnd;
        } else {
          this.appdata.current = this.padNumber(rnd);
        }
        if (elapsed < totalMs) {
          this.animTimer = setTimeout(tick, interval);
        } else {
          this.animTimer = null;
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
          this.appdata.reveal_id = (this.appdata.reveal_id || 0) + 1;
        }
      };

      this.animTimer = setTimeout(tick, 12);
    },

    reiniciar() {
      this._stopAnimation();
      this.appdata.animating = false;
      this.appdata.fim = false;
      this.appdata.reveal_id = 0;
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
      this.appdata.fim = false;
      this.appdata.reveal_id = 0;
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
        clearTimeout(this.animTimer);
        this.animTimer = null;
      }
    },

    // ── ROLETA ───────────────────────────────────────────────────────────
    onRouletteSpinStart(winnerIdx, duration) {
      this.rouletteSpinning      = true;
      this.rouletteCurrentWinner = null;
      this.appdata.roulette_spin_id         = (this.appdata.roulette_spin_id || 0) + 1;
      this.appdata.roulette_spin_winner_idx = winnerIdx;
      this.appdata.roulette_spin_items      = [...this.rouletteActiveItems];
      this.appdata.roulette_spin_duration   = duration || 7000;
    },

    rouletteAdd() {
      const val = this.rouletteInput.trim();
      if (!val) return;
      if (!this.rouletteItems.includes(val)) {
        this.appdata.roulette_items = [...this.rouletteItems, val];
      }
      this.rouletteInput = "";
    },

    rouletteRemoveItem(idx) {
      const items = [...this.rouletteItems];
      items.splice(idx, 1);
      this.appdata.roulette_items = items;
    },

    rouletteSpin() {
      if (this.$refs.rouletteWheel) this.$refs.rouletteWheel.spin();
    },

    onRouletteWinner(winner) {
      this.rouletteSpinning      = false;
      this.rouletteCurrentWinner = winner;
      this.appdata.roulette_drawn = [winner, ...this.rouletteDrawn];
      if (this._winnerTimer) clearTimeout(this._winnerTimer);
      this._winnerTimer = setTimeout(() => { this.rouletteCurrentWinner = null; }, 8000);
    },

    rouletteReset() {
      if (this._winnerTimer) { clearTimeout(this._winnerTimer); this._winnerTimer = null; }
      if (this.$refs.rouletteWheel) this.$refs.rouletteWheel.reset();
      this.appdata.roulette_drawn = [];
      this.rouletteCurrentWinner = null;
    },

    rouletteClear() {
      if (this._winnerTimer) { clearTimeout(this._winnerTimer); this._winnerTimer = null; }
      if (this.$refs.rouletteWheel) this.$refs.rouletteWheel.reset();
      this.appdata.roulette_items = [];
      this.appdata.roulette_drawn = [];
      this.rouletteCurrentWinner = null;
    },

    rouletteImportFromText() {
      const lines = (this.rouletteImportText || "")
        .split("\n").map(l => l.trim()).filter(l => l.length > 0);
      const existing = new Set(this.rouletteItems);
      const added = lines.filter(l => !existing.has(l));
      this.appdata.roulette_items = [...this.rouletteItems, ...added];
      this.rouletteImportText = "";
      this.showRouletteImport = false;
    },

    rouletteReadFile(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.rouletteImportText = e.target.result;
        this.rouletteImportFromText();
      };
      reader.readAsText(file, "UTF-8");
      event.target.value = "";
    },

    // Google Forms CSV parsing
    parseForms() {
      const raw = this.formsCsvText.trim();
      if (!raw) { this.formsCols = []; this.formsPreview = []; return; }
      const rows = raw.split(/\r?\n/).map(r => {
        // Respect quoted CSV fields
        const cells = [];
        let cur = '', inQ = false;
        for (let i = 0; i < r.length; i++) {
          const c = r[i];
          if (c === '"') { inQ = !inQ; }
          else if (c === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
          else { cur += c; }
        }
        cells.push(cur.trim());
        return cells;
      }).filter(r => r.some(c => c.length > 0));

      if (rows.length < 2) { this.formsCols = []; this.formsPreview = []; return; }

      const headers = rows[0];
      this.formsCols = headers;
      if (!this.formsSelectedCol || !headers.includes(this.formsSelectedCol)) {
        // Auto-select: first non-Timestamp column
        this.formsSelectedCol = headers.find(h => !/timestamp|carimbo/i.test(h)) || headers[0];
      }
      const colIdx = headers.indexOf(this.formsSelectedCol);
      this.formsPreview = rows.slice(1)
        .map(r => (r[colIdx] || "").trim())
        .filter(v => v.length > 0);
    },

    rouletteImportForms() {
      const existing = new Set(this.rouletteItems);
      const added = this.formsPreview.filter(n => !existing.has(n));
      this.appdata.roulette_items = [...this.rouletteItems, ...added];
      this.showFormsDialog = false;
      this.formsCsvText = "";
      this.formsCols = [];
      this.formsPreview = [];
      this.formsSelectedCol = null;
    },

    // QR Code / Registro
    async toggleRegServer() {
      if (this.regRunning) {
        await this.$electron.regserverStop();
        if (this._regHandler) {
          this.$electron.off('regserver:registration', this._regHandler);
          this._regHandler = null;
        }
        this.regRunning = false;
        this.qrDataUrl  = null;
        this.regUrl     = "";
        this.regIps     = [];
        this.regPort    = 0;
        return;
      }
      const info = await this.$electron.regserverStart();
      if (!info) return;
      this.regPort    = info.port;
      this.regIps     = info.ips && info.ips.length > 0 ? info.ips : [info.ip];
      this.regUrl     = `http://${info.ip}:${info.port}`;
      this.regRunning = true;
      this.regCount   = 0;

      // Gerar QR code
      const dataUrl = await this.$electron.qrcodeGenerate(this.regUrl, { width: 200 });
      this.qrDataUrl = dataUrl;

      // Ouvir novos registros
      this._regHandler = this.$electron.on('regserver:registration', (name) => {
        if (name && !this.rouletteItems.includes(name)) {
          this.appdata.roulette_items = [...this.rouletteItems, name];
        }
        this.regCount++;
      });
    },

    async changeRegIp(ip) {
      this.regUrl    = `http://${ip}:${this.regPort}`;
      this.qrDataUrl = null;
      const dataUrl  = await this.$electron.qrcodeGenerate(this.regUrl, { width: 200 });
      this.qrDataUrl = dataUrl;
    },

    copyRegUrl() {
      if (navigator.clipboard && this.regUrl) {
        navigator.clipboard.writeText(this.regUrl);
      }
    },

    openRegUrl() {
      if (this.regUrl) this.$electron.openExternal(this.regUrl);
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
    // Migração: limpa cores hardcoded antigas para que o tema da aplicação seja usado
    if (this.userdata.background_color === "#0d1b2a") this.userdata.background_color = null;
    if (this.userdata.font_color === "#FFFFFF") this.userdata.font_color = null;
    // Migração: initial/final agora são transientes (data), não persistidos
    if (this.userdata.initial !== null) this.userdata.initial = null;
    if (this.userdata.final !== null) this.userdata.final = null;
    if (this.appdata.available === null) {
      this.appdata.available = [];
      this.appdata.drawn = [];
      this.appdata.current = this.padNumber(0);
      this.appdata.names_available = [];
      this.appdata.names_drawn = [];
      this.appdata.names_current = "";
      this.appdata.animating = false;
      this.appdata.reveal_id = 0;
      this.appdata.fim = false;
    }
    if (!this.appdata.roulette_items) {
      this.appdata.roulette_items = [];
      this.appdata.roulette_drawn = [];
    }
  },
  unmounted() {
    window.removeEventListener("keydown", this.handleKeydown);
    this._stopAnimation();
    if (this._winnerTimer) clearTimeout(this._winnerTimer);
    if (this.regRunning) this.$electron.regserverStop();
    if (this._regHandler) this.$electron.off('regserver:registration', this._regHandler);
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

.sorteio-input-row {
  gap: 6px;
}

.sorteio-counter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sorteio-counter--row {
  flex-direction: row;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
}
.sorteio-counter--row .sorteio-counter__value {
  font-size: 18px;
}
.sorteio-counter--row .sorteio-counter__label {
  font-size: 12px;
}

.sorteio-stack-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sorteio-checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sorteio-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 12px;
  gap: 8px;
}

/* ── Aba Roleta ─────────────────────────────────────────────────────── */
.roulette-screen {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background: v-bind("rouletteBg");
  color: v-bind("rouletteColor");
}

.roulette-panel {
  width: 210px;
  min-width: 140px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid v-bind("roulettePanelBorder");
  flex-shrink: 0;
}
.roulette-panel--right {
  border-right: none;
  border-left: 1px solid v-bind("roulettePanelBorder");
}

.roulette-panel__header {
  padding: 10px 12px 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  opacity: 0.65;
  letter-spacing: 0.08em;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.roulette-panel__count {
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
}

.roulette-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.roulette-panel__content::-webkit-scrollbar { width: 4px; }
.roulette-panel__content::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.2);
  border-radius: 2px;
}

.roulette-panel__empty {
  font-size: 12px;
  opacity: 0.4;
  font-style: italic;
  padding: 4px 2px;
}

.roulette-item-row {
  display: flex;
  align-items: center;
  font-size: 12px;
  gap: 4px;
  padding: 2px 0;
}
.roulette-item-drawn { opacity: 0.4; text-decoration: line-through; }
.roulette-item-history { opacity: 0.8; }
.roulette-item-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.roulette-item-num { font-size: 10px; opacity: 0.5; min-width: 18px; }

.roulette-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 12px;
  z-index: 1;
}

.roulette-wheel-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

/* QR mini panel */
.roulette-qr-mini {
  padding: 8px;
  border-top: 1px solid rgba(255,255,255,0.1);
  text-align: center;
}
.roulette-qr-mini__img {
  width: 100%;
  max-width: 140px;
  border-radius: 6px;
  margin: 0 auto 4px;
  display: block;
}
.roulette-qr-mini__url {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 9px;
  opacity: 0.5;
  word-break: break-all;
  margin-bottom: 3px;
}
.roulette-qr-mini__ips {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: center;
  margin: 3px 0;
}
.roulette-qr-mini__ip {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 6px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  cursor: pointer;
  font-family: monospace;
}
.roulette-qr-mini__ip--active { color: #2ecc71; border-color: rgba(46,204,113,0.4); }
.roulette-qr-mini__count { font-size: 11px; font-weight: 600; color: #2ecc71; }

/* Vencedor em overlay centralizado sobre a roda */
.rw-top-winner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 15;
  font-size: clamp(16px, 4vh, 40px);
  font-weight: 900;
  text-align: center;
  max-width: 85%;
  word-break: break-word;
  white-space: normal;
  line-height: 1.2;
  text-shadow: 0 3px 16px rgba(0,0,0,0.9);
  background: rgba(0,0,0,0.60);
  padding: 12px 24px;
  border-radius: 16px;
  border: 1.5px solid rgba(255,255,255,0.20);
  pointer-events: none;
}
.rw-top-enter-active { animation: rw-top-in  0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
.rw-top-leave-active { animation: rw-top-out 0.3s ease forwards; }
@keyframes rw-top-in  { from { opacity:0; transform:translate(-50%,-50%) scale(0.80); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
@keyframes rw-top-out { from { opacity:1; } to { opacity:0; } }
</style>
