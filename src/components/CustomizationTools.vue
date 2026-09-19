<template>
  <v-slide-group show-arrows class="__customization_tools px-1">
    <!-- BLOCOS -->
    <v-slide-group-item
      v-for="(block, indx_block) in menu_items"
      :key="indx_block"
    >
      <v-divider v-if="indx_block > 0" vertical class="mx-1" />
      <v-card flat class="d-flex flex-column pt-2 ct-block">
        <!-- Presets — só nos blocos que declararam presetKey (ver toBlock).
             Salva/aplica só os campos DESSE bloco (ex.: um bloco "Fundo" com
             background_color/image/image_opacity/image_fit), não o módulo
             inteiro — outros blocos (texto, alinhamento, etc.) ficam de fora. -->
        <div v-if="block.presetKey" class="__ct-presets px-2 mb-1">
          <div class="d-flex align-center flex-wrap" style="gap: 4px">
            <v-chip
              v-for="preset in presetsFor(block)"
              :key="preset.id"
              size="x-small"
              variant="tonal"
              color="primary"
              closable
              @click="applyPreset(block, preset)"
              @click:close="deletePreset(block, preset)"
            >
              {{ preset.name }}
            </v-chip>
            <v-btn
              size="x-small"
              variant="outlined"
              icon="mdi-plus"
              :title="$t('components.customization.save_preset')"
              @click="saveCurrentAsPreset(block)"
            />
          </div>
        </div>
        <v-card-text style="flex: 1" class="d-flex pa-0 ma-0">
          <!-- GRUPOS -->
          <template
            v-for="(group, indx_group) in block.items"
            :key="indx_group"
          >
            <v-divider v-if="indx_group > 0" vertical class="mx-1" />
            <div class="d-flex flex-column justify-center">
              <!-- ITEMS -->
              <div
                v-for="(item, indx_item) in group"
                :key="indx_item"
                class="my-2"
              >
                <v-text-field
                  v-if="item?.type == 'color'"
                  v-model="userdata[item.property]"
                  :label="item?.label"
                  :width="100"
                  type="color"
                  prepend-inner-icon="mdi-palette"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
                <v-number-input
                  v-else-if="
                    ['font-size', 'border-spacing'].includes(item?.type)
                  "
                  v-model="userdata[item.property]"
                  :label="item?.label"
                  :width="150"
                  :min="1"
                  :max="90"
                  :prepend-inner-icon="
                    item?.type == 'font-size'
                      ? 'mdi-format-font-size-increase'
                      : 'mdi-border-all-variant'
                  "
                  density="compact"
                  variant="outlined"
                  control-variant="split"
                  hide-details
                />
                <v-select
                  v-else-if="item?.type == 'font'"
                  v-model="userdata[item.property]"
                  :label="item?.label"
                  :width="200"
                  prepend-inner-icon="mdi-format-font"
                  density="compact"
                  variant="outlined"
                  :items="fonts"
                  item-title="label"
                  item-value="value"
                  hide-details
                />
                <!-- h-align + v-align no mesmo grupo → um único "pad" de
                     posição arrastável, em vez de duas barras de botões
                     separadas (ver PositionPad.vue). -->
                <l-position-pad
                  v-else-if="item?.type == 'h-align' && pairedVAlignItem(group)"
                  :horizontal="userdata[item.property]"
                  @update:horizontal="userdata[item.property] = $event"
                  :vertical="userdata[pairedVAlignItem(group).property]"
                  @update:vertical="userdata[pairedVAlignItem(group).property] = $event"
                />
                <v-btn-toggle
                  v-else-if="item?.type == 'h-align'"
                  v-model="userdata[item.property]"
                  :label="item?.label"
                  density="compact"
                  variant="outlined"
                >
                  <v-btn value="start" size="small" stacked>
                    <v-icon>mdi-format-horizontal-align-left</v-icon>
                    <span class="ct-align-btn-label">Esquerda</span>
                  </v-btn>
                  <v-btn value="center" size="small" stacked>
                    <v-icon>mdi-format-horizontal-align-center</v-icon>
                    <span class="ct-align-btn-label">Centro</span>
                  </v-btn>
                  <v-btn value="end" size="small" stacked>
                    <v-icon>mdi-format-horizontal-align-right</v-icon>
                    <span class="ct-align-btn-label">Direita</span>
                  </v-btn>
                </v-btn-toggle>
                <!-- v-align sozinho só renderiza se não tiver h-align irmão
                     no grupo (esse caso já é coberto pelo pad acima). -->
                <v-btn-toggle
                  v-else-if="item?.type == 'v-align' && !pairedHAlignItem(group)"
                  v-model="userdata[item.property]"
                  :label="item?.label"
                  density="compact"
                  variant="outlined"
                >
                  <v-btn value="start" size="small" stacked>
                    <v-icon>mdi-format-vertical-align-top</v-icon>
                    <span class="ct-align-btn-label">Em Cima</span>
                  </v-btn>
                  <v-btn value="center" size="small" stacked>
                    <v-icon>mdi-format-vertical-align-center</v-icon>
                    <span class="ct-align-btn-label">Meio</span>
                  </v-btn>
                  <v-btn value="end" size="small" stacked>
                    <v-icon>mdi-format-vertical-align-bottom</v-icon>
                    <span class="ct-align-btn-label">Em Baixo</span>
                  </v-btn>
                </v-btn-toggle>
                <!-- v-align pareado com h-align: já renderizado pelo pad
                     acima — precisa de um ramo próprio aqui só pra fechar a
                     cadeia v-if/else-if sem cair no "Type inválido" final. -->
                <template v-else-if="item?.type == 'v-align'" />
                <v-btn
                  v-else-if="item?.type == 'restore'"
                  icon="mdi-restore"
                  size="x-large"
                  variant="tonal"
                  color="primary"
                  @click="restore"
                />
                <div
                  v-else-if="item?.type == 'image'"
                  class="d-flex align-center"
                  style="gap: 4px; width: 210px"
                >
                  <v-btn
                    :prepend-icon="userdata[item.property] ? 'mdi-image-check' : 'mdi-image-area'"
                    :color="userdata[item.property] ? 'primary' : undefined"
                    size="small"
                    variant="tonal"
                    :title="item?.label"
                    :loading="pickingImage[item.property]"
                    @click="pickImage(item)"
                  >
                    <span
                      class="text-truncate"
                      style="max-width: 120px; display: inline-block"
                    >
                      {{ userdata[item.property] ? getFileName(userdata[item.property]) : item?.label }}
                    </span>
                  </v-btn>
                  <v-btn
                    v-if="userdata[item.property]"
                    icon="mdi-close-circle"
                    size="x-small"
                    variant="plain"
                    :title="$t('components.customization.clear_image')"
                    @click="clearImage(item)"
                  />
                </div>
                <v-select
                  v-else-if="item?.type == 'object-fit'"
                  v-model="userdata[item.property]"
                  :label="item?.label"
                  :width="200"
                  prepend-inner-icon="mdi-fit-to-page"
                  density="compact"
                  variant="outlined"
                  :items="fit"
                  item-title="label"
                  item-value="value"
                  hide-details
                />
                <div
                  v-else-if="item?.type == 'animated-bg'"
                  class="px-1"
                  style="width: 200px"
                >
                  <span
                    class="text-label-small px-2"
                    style="
                      opacity: var(--v-medium-emphasis-opacity);
                      font-size: 12px;
                    "
                  >
                    {{ item?.label }}
                  </span>
                  <l-animated-bg-picker
                    v-model="userdata[item.property]"
                    :color="userdata[item.property + '_color']"
                    :options="animatedBackgrounds"
                  />
                </div>
                <div
                  v-else-if="item?.type == 'opacity'"
                  class="px-1"
                  style="width: 200px"
                >
                  <span
                    class="text-label-small px-2"
                    style="
                      opacity: var(--v-medium-emphasis-opacity);
                      font-size: 12px;
                    "
                  >
                    {{ item?.label }}
                  </span>
                  <v-slider
                    v-model="userdata[item.property]"
                    :min="0"
                    :max="100"
                    hide-details
                    :thumb-size="15"
                    :track-size="1"
                  />
                </div>
                <!-- Slider genérico com faixa própria (min/max/step vêm do
                     manifest.json do módulo) — usado por campos que não são
                     0-100%, como intensidade/espalhamento de sombra. -->
                <div
                  v-else-if="item?.type == 'range'"
                  class="px-1"
                  style="width: 200px"
                >
                  <span
                    class="text-label-small px-2"
                    style="
                      opacity: var(--v-medium-emphasis-opacity);
                      font-size: 12px;
                    "
                  >
                    {{ item?.label }}:
                    {{ item?.percent ? Math.round((userdata[item.property] ?? 0) * 100) + '%' : userdata[item.property] }}
                  </span>
                  <v-slider
                    v-model="userdata[item.property]"
                    :min="item?.min ?? 0"
                    :max="item?.max ?? 1"
                    :step="item?.step ?? 0.1"
                    hide-details
                    :thumb-size="15"
                    :track-size="1"
                  />
                </div>
                <!-- Interruptor simples (booleano). -->
                <div
                  v-else-if="item?.type == 'toggle'"
                  class="d-flex align-center justify-space-between px-2"
                  style="width: 200px"
                >
                  <span
                    class="text-label-small"
                    style="opacity: var(--v-medium-emphasis-opacity); font-size: 12px"
                  >
                    {{ item?.label }}
                  </span>
                  <v-switch
                    v-model="userdata[item.property]"
                    color="primary"
                    density="compact"
                    hide-details
                  />
                </div>
                <div v-else class="text-error">
                  Type "{{ item?.type }}" invalid!
                </div>
              </div>
            </div>
          </template>
        </v-card-text>
        <v-card-subtitle class="text-center">
          <small>{{ block.name }}</small>
        </v-card-subtitle>
      </v-card>
    </v-slide-group-item>
  </v-slide-group>
</template>

<script>
import AnimatedBgPicker from "@/components/AnimatedBgPicker.vue";
import PositionPad from "@/components/PositionPad.vue";

export default {
  name: "CustomizationToolsComponent",
  components: {
    LAnimatedBgPicker: AnimatedBgPicker,
    LPositionPad: PositionPad,
  },
  props: {
    module: Object,
    items: Array,
  },
  data: () => ({
    pickingImage: {},
    fonts: [
      { label: "Arial", value: "Arial, sans-serif" },
      { label: "Helvetica", value: "Helvetica, sans-serif" },
      { label: "Times New Roman", value: "Times New Roman, serif" },
      { label: "Georgia", value: "Georgia, serif" },
      { label: "Courier New", value: "Courier New, monospace" },
      { label: "Verdana", value: "Verdana, sans-serif" },
      { label: "DIN Condensed", value: "DINCondensedBold, sans-serif" },
      { label: "Roboto", value: "Roboto, sans-serif" },
    ],
  }),
  computed: {
    menu_items() {
      return [
        ...this.items.map((block) => {
          return this.toBlock(block);
        }),
        {
          name: this.$t("components.customization.restore"),
          items: [
            [
              {
                type: "restore",
                label: this.$t("components.customization.restore_configs"),
              },
            ],
          ],
        },
      ];
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            // Cai pro "default" declarado no manifest.json (quando existir)
            // em vez de sempre null -- sem isso, um campo boolean com
            // default:true (ex.: text_box) aparecia OFF na barra até o
            // usuário tocar nele, mesmo já estando ON de verdade (ver
            // Slide.vue, que trata ausência como true nesse caso).
            const def = this.module?.manifest?.customization?.[key]?.default ?? null;
            return this.$userdata.get(`modules.${this.module.id}.${key}`, def);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    fit() {
      return [
        { label: this.$t("components.customization.fit.none"), value: "none" },
        { label: this.$t("components.customization.fit.fill"), value: "fill" },
        {
          label: this.$t("components.customization.fit.contain"),
          value: "contain",
        },
        {
          label: this.$t("components.customization.fit.cover"),
          value: "cover",
        },
      ];
    },
    // Fundos animados (ver components/AnimatedBackground.vue) — camada de
    // ambiente opcional, por trás da cor/imagem já existentes.
    animatedBackgrounds() {
      return [
        { label: this.$t("components.customization.animated_bg.none"), value: "none" },
        { label: this.$t("components.customization.animated_bg.three"), value: "three" },
        { label: this.$t("components.customization.animated_bg.gsap"), value: "gsap" },
        { label: this.$t("components.customization.animated_bg.anime"), value: "anime" },
        { label: this.$t("components.customization.animated_bg.motion"), value: "motion" },
      ];
    },
  },
  methods: {
    // h-align/v-align no mesmo grupo viram um único PositionPad em vez de
    // duas barras de botões separadas (ver bloco h-align/v-align no template).
    pairedVAlignItem(group) {
      return group.find((i) => i?.type === "v-align");
    },
    pairedHAlignItem(group) {
      return group.find((i) => i?.type === "h-align");
    },
    t(text) {
      if (!text) return '';
      const key = `modules.${this.module.id}.${text}`;
      const result = this.$t(key);
      if (result === key) {
        const locale = this.$i18n?.locale?.value || this.$i18n?.locale || 'pt';
        const manifest = this.$appdata.get(`modules.${this.module.id}.manifest`);
        const translations = manifest?.translations?.[locale] || manifest?.translations?.['pt'];
        if (translations) {
          const val = text.split('.').reduce((obj, k) => obj?.[k], translations);
          if (typeof val === 'string') return val;
        }
      }
      return result;
    },
    toBlock(item) {
      /* Blocos */
      if (typeof item == "string") {
        item = { name: this.label(item), items: this.toArray(item) };
      } else if (Array.isArray(item)) {
        item = { name: "", items: item };
      }

      const presetKey = item?.presetKey;
      // Propriedades extras que um preset precisa capturar/restaurar junto,
      // mas que não são um "item" visível desta barra (ex.: slide_bg tem um
      // seletor de tipo de fundo — none/image/video — fora do
      // CustomizationTools; sem incluir esse campo aqui, aplicar um preset
      // de imagem não mudaria nada se o tipo atual estivesse em "none").
      const presetExtraProps = item?.presetExtraProps;
      item.items = this.toArray(item?.items).map((group) => {
        /* Grupos */
        return this.toArray(group).map((el) => {
          /* Elementos */
          return {
            ...this.properties(el),
            property: el,
            label: this.label(el),
          };
        });
      });
      // presetKey/presetExtraProps precisam sobreviver ao reassign de
      // item.items acima — mantidos fora do spread pra não colidir com
      // nenhuma propriedade que properties(el) devolva.
      if (presetKey) item.presetKey = presetKey;
      if (presetExtraProps) item.presetExtraProps = presetExtraProps;
      return item;
    },
    // ── Presets — salva/aplica só os campos de UM bloco (ex.: "Fundo") por
    // vez, nunca o módulo inteiro. Guardados em modules.<id>.presets.<key>,
    // mesmo mecanismo $userdata (reativo, persistido) de qualquer outro
    // campo de customização — assim funciona igual pra qualquer módulo que
    // declare presetKey num bloco, sem precisar de código específico por
    // módulo (Sorteio, Bíblia, Coletâneas Personalizadas, etc.).
    presetsFor(block) {
      return this.$userdata.get(`modules.${this.module.id}.presets.${block.presetKey}`, []);
    },
    blockProperties(block) {
      return [
        ...block.items.flatMap((group) => group.map((el) => el.property)),
        ...(block.presetExtraProps || []),
      ];
    },
    saveCurrentAsPreset(block) {
      this.$alert.prompt(
        { title: this.$t("components.customization.save_preset"), translate: false },
        (name) => {
          if (!name) return;
          const values = {};
          this.blockProperties(block).forEach((prop) => { values[prop] = this.userdata[prop]; });
          const list = this.presetsFor(block).slice();
          list.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name, values });
          this.$userdata.set(`modules.${this.module.id}.presets.${block.presetKey}`, list);
        },
      );
    },
    applyPreset(block, preset) {
      Object.entries(preset.values || {}).forEach(([prop, value]) => {
        this.userdata[prop] = value;
      });
    },
    deletePreset(block, preset) {
      this.$alert.yesno("components.customization.delete_preset_dialog", (btn) => {
        if (btn !== "yes") return;
        const list = this.presetsFor(block).filter((p) => p.id !== preset.id);
        this.$userdata.set(`modules.${this.module.id}.presets.${block.presetKey}`, list);
      });
    },
    toArray(item) {
      if (item == null) {
        return [];
      }
      if (typeof item == "string") {
        return [item];
      }
      if (!Array.isArray(item)) {
        return [];
      }
      return item;
    },
    label(item) {
      return this.t(this.module?.manifest?.customization[item]?.label);
    },
    properties(item) {
      return this.module?.manifest?.customization[item];
    },
    async pickImage(item) {
      if (!this.$electron) return;
      this.pickingImage = { ...this.pickingImage, [item.property]: true };
      try {
        const fp = await this.$electron.selectFile({
          title: 'Selecionar imagem de fundo',
          filters: [{ name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] }],
        });
        if (fp) {
          this.userdata[item.property] = this.toFileUrl(fp);
        }
      } finally {
        this.pickingImage = { ...this.pickingImage, [item.property]: false };
      }
    },
    toFileUrl(fp) {
      if (!fp) return '';
      if (fp.startsWith('file://')) return fp;
      return 'file:///' + fp.replace(/\\/g, '/');
    },
    getFileName(url) {
      if (!url) return '';
      return url.split(/[/\\]/).pop() || url;
    },
    clearImage(item) {
      this.userdata[item.property] = '';
    },
    restore() {
      let self = this;
      this.$alert.yesno(
        "components.customization.restore_dialog",
        function (btn) {
          if (btn == "yes") {
            self.menu_items?.map((block) => {
              block.items?.map((group) => {
                group.map((item) => {
                  if (item.property) {
                    self.userdata[item.property] = item.default;
                  }
                });
              });
            });
          }
        },
      );
    },
  },
};
</script>

<style lang="scss">
.__customization_tools {
  input {
    &[type="color"] {
      padding: 4px;
    }
  }
  .__ct-presets {
    max-width: 260px;
  }
  // Cada bloco (Fundo | Posição da Letra | Texto | Janela | Restaurar) ganha
  // um cartão com cantos arredondados próprio, em vez de só um traço fino
  // entre eles — mesmo tratamento visual usado no resto do sistema (ex.: a
  // própria barra de personalização, ver CustomizationBar.vue).
  .ct-block {
    border-radius: 12px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    background: rgba(128, 128, 128, 0.03);
    padding: 8px;
    margin: 4px 2px;
  }
  // Rótulo de texto embaixo do ícone nos botões de alinhamento (h-align/
  // v-align sem par) — "Esquerda/Centro/Direita", "Em Cima/Meio/Em Baixo".
  .ct-align-btn-label {
    font-size: 9px;
    line-height: 1.1;
    text-transform: none;
    margin-top: 2px;
  }
}
</style>
