<template>
  <ModuleContainer ref="mc" :manifest="manifest" compact>

    <!-- ── Barra de personalização (ícone de paleta) ───────────────────────
         Fundo | Texto | Janela | Restaurar  →  igual ao módulo Sorteio -->
    <template #customize>
      <l-customization-tools
        v-if="module"
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

    <!-- ── Conteúdo principal ─────────────────────────────────────────────── -->
    <div class="sbg-root">

      <!-- Seletor de tipo de fundo -->
      <div class="text-caption text-medium-emphasis mb-2">{{ t('bg_type_label') }}</div>
      <v-btn-toggle
        :model-value="bgType"
        @update:modelValue="setBgType"
        mandatory
        density="compact"
        variant="outlined"
        color="primary"
        class="mb-4 sbg-toggle"
      >
        <v-btn value="none"  size="small" class="flex-grow-1" prepend-icon="mdi-text-box-outline">
          {{ t('type_none') }}
        </v-btn>
        <v-btn value="image" size="small" class="flex-grow-1" prepend-icon="mdi-image-outline">
          {{ t('type_image') }}
        </v-btn>
        <v-btn value="video" size="small" class="flex-grow-1" prepend-icon="mdi-video-outline">
          {{ t('type_video') }}
        </v-btn>
      </v-btn-toggle>

      <!-- ── Sem fundo ─────────────────────────────────────────────────── -->
      <div v-if="bgType === 'none'" class="sbg-empty">
        <v-icon size="38" style="opacity:0.25">mdi-image-off-outline</v-icon>
        <div class="text-caption text-medium-emphasis mt-2 text-center">
          {{ t('type_none_desc') }}
        </div>
      </div>

      <!-- ── Imagem de fundo ───────────────────────────────────────────── -->
      <template v-if="bgType === 'image'">
        <div class="sbg-preview mb-3">
          <img v-if="imageUrl" :src="imageUrl" class="sbg-preview-img" alt="preview" />
          <v-icon v-else size="40" style="opacity:0.20">mdi-image-off-outline</v-icon>
        </div>

        <div v-if="imageUrl" class="text-caption text-medium-emphasis mb-2 sbg-filename">
          {{ imageFilename }}
        </div>

        <div class="d-flex gap-2 align-center flex-wrap mb-3">
          <v-btn
            color="primary" variant="tonal" size="small"
            prepend-icon="mdi-folder-open-outline"
            :loading="pickingImage"
            @click="pickImage"
          >{{ t('pick_image') }}</v-btn>
          <v-btn
            v-if="imageUrl"
            icon="mdi-close-circle-outline"
            color="error" variant="text" size="small"
            density="compact"
            @click="clearImage"
          />
        </div>

        <!-- Opacidade rápida -->
        <div class="text-caption text-medium-emphasis mb-1">
          {{ t('opacity_label') }}: {{ imageOpacity }}%
        </div>
        <v-slider
          :model-value="imageOpacity"
          @update:modelValue="setOpacity"
          min="10" max="100" step="5"
          color="primary" hide-details density="compact" :thumb-size="14"
        />
      </template>

      <!-- ── Vídeo de fundo ─────────────────────────────────────────────── -->
      <template v-if="bgType === 'video'">
        <div class="sbg-preview sbg-preview--video mb-3">
          <v-icon size="40" :color="videoUrl ? 'primary' : undefined" style="opacity:0.55">
            mdi-video-outline
          </v-icon>
        </div>

        <div v-if="videoUrl" class="text-caption text-medium-emphasis mb-2 sbg-filename">
          {{ videoFilename }}
        </div>

        <div class="d-flex gap-2 align-center flex-wrap mb-3">
          <v-btn
            color="primary" variant="tonal" size="small"
            prepend-icon="mdi-folder-open-outline"
            :loading="pickingVideo"
            @click="pickVideo"
          >{{ t('pick_video') }}</v-btn>
          <v-btn
            v-if="videoUrl"
            icon="mdi-close-circle-outline"
            color="error" variant="text" size="small"
            density="compact"
            @click="clearVideo"
          />
        </div>

        <!-- Opacidade rápida -->
        <div class="text-caption text-medium-emphasis mb-1">
          {{ t('opacity_label') }}: {{ imageOpacity }}%
        </div>
        <v-slider
          :model-value="imageOpacity"
          @update:modelValue="setOpacity"
          min="10" max="100" step="5"
          color="primary" hide-details density="compact" :thumb-size="14"
        />
      </template>

      <!-- ── Personalização de Texto ──────────────────────────────────── -->
      <v-divider class="my-4" />
      <div class="text-subtitle-2 mb-3 d-flex align-center gap-2">
        <v-icon size="16">mdi-format-text</v-icon>
        {{ t('text_section') }}
      </div>

      <!-- Preview do texto -->
      <div class="sbg-text-preview mb-4" :style="textPreviewStyle">
        EXEMPLO DE LETRA
      </div>

      <!-- Fonte -->
      <v-select
        :model-value="font"
        @update:modelValue="setFont"
        :label="t('text_font')"
        :items="fontOptions"
        item-title="label"
        item-value="value"
        density="compact"
        variant="outlined"
        hide-details
        prepend-inner-icon="mdi-format-font"
        class="mb-3"
      />

      <!-- Tamanho + Cor na mesma linha -->
      <div class="d-flex gap-3 mb-3">
        <div style="flex:1">
          <div class="text-caption text-medium-emphasis mb-1">{{ t('text_size') }}: {{ fontSize }}</div>
          <v-slider
            :model-value="fontSize"
            @update:modelValue="setFontSize"
            min="8" max="50" step="1"
            color="primary" hide-details density="compact" :thumb-size="14"
          />
        </div>
        <div class="d-flex flex-column align-center" style="min-width:72px">
          <div class="text-caption text-medium-emphasis mb-1">{{ t('text_color') }}</div>
          <input
            type="color"
            :value="fontColor || '#FFFFFF'"
            @input="e => setFontColor(e.target.value)"
            class="sbg-color-input"
            :title="t('text_color')"
          />
        </div>
      </div>

      <!-- Tamanho lateral (aux text) -->
      <div class="text-caption text-medium-emphasis mb-1">{{ t('text_aux_size') }}: {{ panelFontSize }}</div>
      <v-slider
        :model-value="panelFontSize"
        @update:modelValue="setPanelFontSize"
        min="6" max="30" step="1"
        color="primary" hide-details density="compact" :thumb-size="14"
        class="mb-1"
      />

    </div>
  </ModuleContainer>
</template>

<script setup>
import { ref, computed, watch, onMounted, getCurrentInstance } from "vue";
import manifest from "../manifest.json";
import ModuleContainer from "@/components/ModuleContainer.vue";

const mc           = ref(null);
const pickingImage = ref(false);
const pickingVideo = ref(false);

const { proxy } = getCurrentInstance();
const ID        = manifest.id;

// ── Tradução ──────────────────────────────────────────────────────────────
function t(key) {
  if (mc.value) {
    const r = mc.value.t(key);
    if (r && r !== `modules.${ID}.${key}`) return r;
  }
  const locale = proxy?.$i18n?.locale?.value ?? proxy?.$i18n?.locale ?? 'pt';
  const tr = manifest.translations?.[locale] ?? manifest.translations?.pt ?? {};
  return key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : o), tr) ?? key;
}

// ── Módulo para CustomizationTools (guarded com v-if no template) ─────────
const module = computed(() => proxy?.$modules?.get(ID));

// ── Estado local reativo ──────────────────────────────────────────────────
const bgType       = ref('none');
const imageUrl     = ref('');
const videoUrl     = ref('');
const imageOpacity = ref(85);
// Texto
const font         = ref('');
const fontSize     = ref(20);
const fontColor    = ref('#FFFFFF');
const panelFontSize= ref(14);

const imageFilename = computed(() =>
  decodeURIComponent((imageUrl.value || '').split('/').pop() || '')
);
const videoFilename = computed(() =>
  decodeURIComponent((videoUrl.value || '').split('/').pop() || '')
);

// Fontes disponíveis (mesmas do CustomizationTools)
const fontOptions = [
  { label: 'DIN Condensed (padrão)', value: 'DINCondensedBold, sans-serif' },
  { label: 'Arial',          value: 'Arial, sans-serif' },
  { label: 'Helvetica',      value: 'Helvetica, sans-serif' },
  { label: 'Verdana',        value: 'Verdana, sans-serif' },
  { label: 'Georgia',        value: 'Georgia, serif' },
  { label: 'Times New Roman',value: 'Times New Roman, serif' },
  { label: 'Courier New',    value: 'Courier New, monospace' },
  { label: 'Roboto',         value: 'Roboto, sans-serif' },
];

// Preview do estilo de texto em tempo real
const textPreviewStyle = computed(() => ({
  fontFamily:      font.value || 'DINCondensedBold, sans-serif',
  fontSize:        `${fontSize.value}px`,
  color:           fontColor.value || '#FFFFFF',
  textTransform:   'uppercase',
  backgroundColor: 'rgba(0,0,0,0.75)',
  padding:         '6px 18px',
  borderRadius:    '4px',
  textAlign:       'center',
}));

// ── Carrega estado local a partir do $userdata ────────────────────────────
function loadFromUserdata() {
  const ud = proxy?.$userdata;
  if (!ud) return;
  bgType.value        = ud.get(`modules.${ID}.bg_type`,       'none') ?? 'none';
  imageUrl.value      = ud.get(`modules.${ID}.image`,          '')    ?? '';
  videoUrl.value      = ud.get(`modules.${ID}.video`,          '')    ?? '';
  imageOpacity.value  = ud.get(`modules.${ID}.image_opacity`,  85)    ?? 85;
  font.value          = ud.get(`modules.${ID}.font`,           '')    ?? '';
  fontSize.value      = ud.get(`modules.${ID}.font_size`,      20)    ?? 20;
  fontColor.value     = ud.get(`modules.${ID}.font_color`,     '#FFFFFF') ?? '#FFFFFF';
  panelFontSize.value = ud.get(`modules.${ID}.panel_font_size`, 14)   ?? 14;
}

// ── Sync para localStorage — Slide.vue lê desta chave ─────────────────────
// Lê direto do $userdata para capturar também mudanças do CustomizationTools.
function syncToLocalStorage() {
  const ud = proxy?.$userdata;
  if (!ud) return;
  const type = bgType.value || 'none';
  const url  = type === 'video' ? (videoUrl.value || '') : (imageUrl.value || '');
  const effectiveType = (type !== 'none' && !url) ? 'none' : type;
  try {
    localStorage.setItem('slide_global_bg', JSON.stringify({
      // Fundo
      type:             effectiveType,
      url,
      opacity:          ud.get(`modules.${ID}.image_opacity`,   85)           ?? 85,
      fit:              ud.get(`modules.${ID}.image_fit`,        'cover')      || 'cover',
      background_color: ud.get(`modules.${ID}.background_color`, '#000000')   || '#000000',
      // Texto (controlado pelo CustomizationTools na barra inferior)
      font:             ud.get(`modules.${ID}.font`,             '')           || '',
      font_size:        ud.get(`modules.${ID}.font_size`,        20)           ?? 20,
      font_color:       ud.get(`modules.${ID}.font_color`,       '')           || '',
      panel_font_size:  ud.get(`modules.${ID}.panel_font_size`,  14)           ?? 14,
      // Janela
      border_spacing:   ud.get(`modules.${ID}.border_spacing`,   5)            ?? 5,
    }));
    window.dispatchEvent(new CustomEvent('slide-bg-changed'));
  } catch (_) {}
}

// Observa o slice do Vuex store deste módulo.
// Captura mudanças do seletor principal E do CustomizationTools (barra inferior).
watch(
  () => proxy?.$store?.state?.user_data?.modules?.[ID],
  () => {
    loadFromUserdata();     // mantém refs locais em sincronia
    syncToLocalStorage();   // exporta para o Slide.vue
  },
  { deep: true }
);

// ── Setters do conteúdo principal ─────────────────────────────────────────
function setBgType(v) {
  bgType.value = v;           // reativo imediato → botão ativo atualiza
  proxy?.$userdata?.set(`modules.${ID}.bg_type`, v);
}
function setOpacity(v) {
  imageOpacity.value = v;
  proxy?.$userdata?.set(`modules.${ID}.image_opacity`, v);
}
function setFont(v) {
  font.value = v;
  proxy?.$userdata?.set(`modules.${ID}.font`, v);
}
function setFontSize(v) {
  fontSize.value = v;
  proxy?.$userdata?.set(`modules.${ID}.font_size`, v);
}
function setFontColor(v) {
  fontColor.value = v;
  proxy?.$userdata?.set(`modules.${ID}.font_color`, v);
}
function setPanelFontSize(v) {
  panelFontSize.value = v;
  proxy?.$userdata?.set(`modules.${ID}.panel_font_size`, v);
}

// ── File picker via Electron ──────────────────────────────────────────────
function toFileUrl(fp) {
  if (!fp) return '';
  if (fp.startsWith('file://')) return fp;
  return 'file:///' + fp.replace(/\\/g, '/');
}

async function pickImage() {
  if (!proxy?.$electron) return;
  pickingImage.value = true;
  try {
    const fp = await proxy.$electron.selectFile({
      title: 'Selecionar imagem de fundo',
      filters: [{ name: 'Imagens', extensions: ['jpg','jpeg','png','gif','webp','bmp','svg'] }],
    });
    if (fp) {
      const url = toFileUrl(fp);
      imageUrl.value = url;
      proxy.$userdata.set(`modules.${ID}.image`, url);
    }
  } finally { pickingImage.value = false; }
}

async function pickVideo() {
  if (!proxy?.$electron) return;
  pickingVideo.value = true;
  try {
    const fp = await proxy.$electron.selectFile({
      title: 'Selecionar vídeo de fundo',
      filters: [{ name: 'Vídeo', extensions: ['mp4','webm','ogg','mov','avi','mkv'] }],
    });
    if (fp) {
      const url = toFileUrl(fp);
      videoUrl.value = url;
      proxy.$userdata.set(`modules.${ID}.video`, url);
    }
  } finally { pickingVideo.value = false; }
}

function clearImage() {
  imageUrl.value = '';
  proxy?.$userdata?.set(`modules.${ID}.image`, '');
}
function clearVideo() {
  videoUrl.value = '';
  proxy?.$userdata?.set(`modules.${ID}.video`, '');
}

// ── Inicialização ─────────────────────────────────────────────────────────
onMounted(() => {
  loadFromUserdata();
  syncToLocalStorage();
});
</script>

<style scoped>
.sbg-root  { padding: 16px; }
.sbg-toggle { width: 100%; }

.sbg-preview {
  width: 100%; height: 110px;
  border-radius: 10px;
  background: rgba(128,128,128,0.07);
  border: 1px solid rgba(128,128,128,0.14);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.sbg-preview--video {
  background: rgba(99,102,241,0.06);
  border-color: rgba(99,102,241,0.20);
}
.sbg-preview-img { width: 100%; height: 100%; object-fit: cover; }

.sbg-empty {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 22px 8px;
}
.sbg-filename {
  max-width: 100%; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}

/* ── Preview de texto ──────────────────────────────────────────────── */
.sbg-text-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 54px;
  border-radius: 8px;
  border: 1px solid rgba(128,128,128,0.14);
  background: rgba(30,30,30,0.9);
  font-weight: 700;
  letter-spacing: 0.04em;
  word-break: break-word;
  overflow: hidden;
}

/* ── Color picker nativo estilizado ────────────────────────────────── */
.sbg-color-input {
  width: 44px;
  height: 44px;
  border: 1px solid rgba(128,128,128,0.25);
  border-radius: 8px;
  padding: 2px;
  cursor: pointer;
  background: transparent;
}
</style>
