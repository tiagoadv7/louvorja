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
            presetKey: 'background',
            // bg_type: o seletor de tipo (none/image/video) no topo desta
            // janela, fora da barra do CustomizationTools — sem incluir aqui,
            // aplicar um preset com imagem não mudaria nada se o tipo atual
            // estivesse em none.
            presetExtraProps: ['bg_type'],
            items: [
              'background_color',
              ['image', 'image_opacity', 'image_fit'],
              ['animated_bg', 'animated_bg_color'],
            ],
          },
          {
            name: t('customization.align'),
            items: [['horizontal_align', 'vertical_align']],
          },
          {
            name: t('customization.text'),
            items: [
              ['font', 'font_size', 'font_color'],
              ['cover_font_size', 'cover_font_color'],
              'repeat_font_color',
              ['panel_font_size', 'panel_font_color'],
            ],
          },
          {
            name: t('shadow_box_section'),
            items: [
              'text_shadow',
              ['shadow_intensity', 'shadow_blur'],
              'text_box',
              ['box_opacity', 'box_border'],
            ],
          },
          { name: t('customization.window'), items: ['border_spacing'] },
        ]"
      />
    </template>

    <!-- ── Conteúdo principal ─────────────────────────────────────────────── -->
    <div class="sbg-root">

      <!-- ── Prévia ao vivo — fundo (cor/imagem/vídeo/animado) + letra de
           exemplo juntos, no mesmo estilo visual usado pelo resto do sistema
           (cartão com cantos arredondados) — reflete exatamente o que vai
           aparecer na projeção, em vez de ícones de placeholder separados. -->
      <div class="sbg-live-preview mb-4" :style="previewContainerStyle">
        <AnimatedBackground
          v-if="animatedBg !== 'none'"
          :variant="animatedBg"
          :color="animatedBgColor"
        />
        <img
          v-if="bgType === 'image' && imageUrl"
          :src="imageUrl"
          class="sbg-live-preview-media"
          :style="{ objectFit: imageFit, opacity: imageOpacity / 100 }"
        />
        <video
          v-else-if="bgType === 'video' && videoUrl"
          :src="videoUrl"
          class="sbg-live-preview-media"
          :style="{ objectFit: imageFit, opacity: imageOpacity / 100 }"
          autoplay loop muted playsinline
        />
        <span v-if="textEnabled" class="sbg-live-preview-text" :style="previewTextStyle">
          EXEMPLO DE LETRA
        </span>
      </div>

      <!-- Seletor de tipo de fundo -->
      <div class="text-caption text-medium-emphasis mb-2">{{ t('bg_type_label') }}</div>
      <v-btn-toggle
        :model-value="bgType"
        @update:modelValue="setBgType"
        density="compact"
        variant="outlined"
        color="primary"
        class="mb-4 sbg-toggle"
      >
        <v-btn value="none"  size="small" class="flex-grow-1" prepend-icon="mdi-text-box-outline">
          Sem Fundo
        </v-btn>
        <v-btn value="image" size="small" class="flex-grow-1" prepend-icon="mdi-image-outline">
          Imagem
        </v-btn>
        <v-btn value="video" size="small" class="flex-grow-1" prepend-icon="mdi-video-outline">
          Vídeo
        </v-btn>
      </v-btn-toggle>

      <!-- ── Estado neutro: nenhum tipo selecionado (padrão inicial) ─── -->
      <div v-if="bgType === null" class="text-caption text-medium-emphasis text-center mb-3">
        Usando imagem padrão do slide. Selecione um tipo acima para personalizar.
      </div>

      <!-- ── Imagem de fundo ───────────────────────────────────────────── -->
      <template v-if="bgType === 'image'">
        <div v-if="imageUrl" class="text-caption text-medium-emphasis mb-2 sbg-filename">
          {{ imageFilename }}
        </div>

        <div class="d-flex ga-2 align-center flex-wrap mb-3">
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
        <div v-if="videoUrl" class="text-caption text-medium-emphasis mb-2 sbg-filename">
          {{ videoFilename }}
        </div>

        <div class="d-flex ga-2 align-center flex-wrap mb-3">
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

      <!-- ── Redefinir para padrão (visível em todas as abas) ──────────── -->
      <div class="d-flex justify-center mt-3 mb-1">
        <v-btn
          size="small"
          variant="tonal"
          color="secondary"
          prepend-icon="mdi-image-sync-outline"
          @click="resetToDefault"
        >
          Redefinir para imagem padrão do slide
        </v-btn>
      </div>

      <!-- ── Personalização de Texto ──────────────────────────────────── -->
      <v-divider class="my-4" />
      <div class="text-subtitle-2 mb-3 d-flex align-center ga-2">
        <v-icon size="16">mdi-format-text</v-icon>
        {{ t('text_section') }}
      </div>

      <!-- Ativar/desativar personalização de texto (independente do fundo) -->
      <v-btn-toggle
        :model-value="textEnabled"
        @update:modelValue="setTextEnabled"
        mandatory
        density="compact"
        variant="outlined"
        color="primary"
        class="mb-4 sbg-toggle"
      >
        <v-btn :value="false" size="small" class="flex-grow-1" prepend-icon="mdi-format-text-variant-outline">
          {{ t('text_enabled_off') }}
        </v-btn>
        <v-btn :value="true" size="small" class="flex-grow-1" prepend-icon="mdi-format-text">
          {{ t('text_enabled_on') }}
        </v-btn>
      </v-btn-toggle>

      <!-- ── Texto desativado: usa fonte/tamanho padrão do slide ───────── -->
      <div v-if="!textEnabled" class="text-caption text-medium-emphasis text-center mb-3">
        {{ t('text_enabled_desc') }}
      </div>

      <!-- ── Texto ativado: controles de fonte, tamanho e cor ──────────── -->
      <template v-else>
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

        <!-- Tamanho + Cor do título na mesma linha -->
        <div class="d-flex ga-3 mb-3">
          <div style="flex:1">
            <div class="text-caption text-medium-emphasis mb-1">{{ t('text_title_size') }}: {{ coverFontSize }}</div>
            <v-slider
              :model-value="coverFontSize"
              @update:modelValue="setCoverFontSize"
              min="8" max="60" step="1"
              color="primary" hide-details density="compact" :thumb-size="14"
            />
          </div>
          <div class="d-flex flex-column align-center" style="min-width:72px">
            <div class="text-caption text-medium-emphasis mb-1">{{ t('text_title_color') }}</div>
            <input
              type="color"
              :value="coverFontColor || '#F6C32A'"
              @input="e => setCoverFontColor(e.target.value)"
              class="sbg-color-input"
              :title="t('text_title_color')"
            />
          </div>
        </div>

        <!-- Tamanho (compartilhado com o texto de repetição — mesmo tamanho,
             sem controle duplicado) + Cor do texto + Cor do texto de repetição -->
        <div class="d-flex ga-3 mb-3">
          <div style="flex:1">
            <div class="text-caption text-medium-emphasis mb-1">{{ t('text_size') }}: {{ fontSize }}</div>
            <v-slider
              :model-value="fontSize"
              @update:modelValue="setFontSize"
              min="8" max="50" step="1"
              color="primary" hide-details density="compact" :thumb-size="14"
            />
          </div>
          <div class="d-flex ga-6">
            <div class="d-flex flex-column align-center" style="width:78px">
              <div class="text-caption text-medium-emphasis mb-1 sbg-color-label">{{ t('text_color') }}</div>
              <input
                type="color"
                :value="fontColor || '#FFFFFF'"
                @input="e => setFontColor(e.target.value)"
                class="sbg-color-input"
                :title="t('text_color')"
              />
            </div>
            <div class="d-flex flex-column align-center" style="width:78px">
              <div class="text-caption text-medium-emphasis mb-1 sbg-color-label">{{ t('text_repeat_color') }}</div>
              <input
                type="color"
                :value="repeatFontColor || '#F6C32A'"
                @input="e => setRepeatFontColor(e.target.value)"
                class="sbg-color-input"
                :title="t('text_repeat_color')"
              />
            </div>
          </div>
        </div>

        <!-- Tamanho + Cor do texto auxiliar na mesma linha -->
        <div class="d-flex ga-3 mb-1">
          <div style="flex:1">
            <div class="text-caption text-medium-emphasis mb-1">{{ t('text_aux_size') }}: {{ panelFontSize }}</div>
            <v-slider
              :model-value="panelFontSize"
              @update:modelValue="setPanelFontSize"
              min="6" max="30" step="1"
              color="primary" hide-details density="compact" :thumb-size="14"
            />
          </div>
          <div class="d-flex flex-column align-center" style="min-width:72px">
            <div class="text-caption text-medium-emphasis mb-1">{{ t('text_aux_color') }}</div>
            <input
              type="color"
              :value="panelFontColor || '#F6C32A'"
              @input="e => setPanelFontColor(e.target.value)"
              class="sbg-color-input"
              :title="t('text_aux_color')"
            />
          </div>
        </div>
      </template>

      <!-- ── Sombra e Caixinha ──────────────────────────────────────────── -->
      <v-divider class="my-4" />
      <div class="text-subtitle-2 mb-3 d-flex align-center ga-2">
        <v-icon size="16">mdi-square-opacity</v-icon>
        {{ t('shadow_box_section') }}
      </div>

      <div class="d-flex align-center justify-space-between mb-2">
        <span class="text-body-2">{{ t('text_shadow_label') }}</span>
        <v-switch
          :model-value="textShadow"
          @update:modelValue="setTextShadow"
          color="primary" density="compact" hide-details
        />
      </div>
      <template v-if="textShadow">
        <div class="text-caption text-medium-emphasis mb-1">
          {{ t('shadow_intensity_label') }}: {{ Math.round(shadowIntensity * 100) }}%
        </div>
        <v-slider
          :model-value="shadowIntensity"
          @update:modelValue="setShadowIntensity"
          min="0.2" max="1" step="0.05"
          color="primary" hide-details density="compact" :thumb-size="14" class="mb-3"
        />
        <div class="text-caption text-medium-emphasis mb-1">
          {{ t('shadow_blur_label') }}: {{ shadowBlur.toFixed(1) }}
        </div>
        <v-slider
          :model-value="shadowBlur"
          @update:modelValue="setShadowBlur"
          min="0.5" max="5" step="0.1"
          color="primary" hide-details density="compact" :thumb-size="14" class="mb-3"
        />
      </template>

      <div class="d-flex align-center justify-space-between mb-2">
        <span class="text-body-2">{{ t('text_box_label') }}</span>
        <v-switch
          :model-value="textBox"
          @update:modelValue="setTextBox"
          color="primary" density="compact" hide-details
        />
      </div>
      <template v-if="textBox">
        <div class="text-caption text-medium-emphasis mb-1">
          {{ t('box_opacity_label') }}: {{ Math.round(boxOpacity * 100) }}%
        </div>
        <v-slider
          :model-value="boxOpacity"
          @update:modelValue="setBoxOpacity"
          min="0.1" max="0.9" step="0.05"
          color="primary" hide-details density="compact" :thumb-size="14" class="mb-3"
        />
        <div class="d-flex align-center justify-space-between mb-1">
          <span class="text-body-2">{{ t('box_border_label') }}</span>
          <v-switch
            :model-value="boxBorder"
            @update:modelValue="setBoxBorder"
            color="primary" density="compact" hide-details
          />
        </div>
      </template>

    </div>
  </ModuleContainer>
</template>

<script setup>
import { ref, computed, watch, onMounted, getCurrentInstance } from "vue";
import manifest from "../manifest.json";
import ModuleContainer from "@/components/ModuleContainer.vue";
import LCustomizationTools from "@/components/CustomizationTools.vue";
import AnimatedBackground from "@/components/AnimatedBackground.vue";

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

// Lidos direto do $userdata (reativo) em vez de refs próprias — são escritos
// pelo CustomizationTools genérico (barra de personalização), não por um
// setter desta tela; usados aqui só pra alimentar a prévia ao vivo.
const animatedBg      = computed(() => proxy?.$userdata?.get(`modules.${ID}.animated_bg`, 'none') || 'none');
const animatedBgColor = computed(() => proxy?.$userdata?.get(`modules.${ID}.animated_bg_color`, '#7aa0ff') || '#7aa0ff');
const imageFit        = computed(() => proxy?.$userdata?.get(`modules.${ID}.image_fit`, 'cover') || 'cover');

// Flag para evitar que o watcher re-escreva o localStorage após um reset
let _resetPending = false;

// ── Estado local reativo ──────────────────────────────────────────────────
const bgType       = ref(null); // null = estado neutro (imagem padrão do slide)
const imageUrl     = ref('');
const videoUrl     = ref('');
const imageOpacity = ref(85);
// Texto
const textEnabled  = ref(true); // padrão true preserva o comportamento anterior (texto sempre acoplado ao fundo)
const font         = ref('');
const fontSize     = ref(20);
const fontColor    = ref('#FFFFFF');
const coverFontSize   = ref(25);
const coverFontColor  = ref('#F6C32A');
const repeatFontColor = ref('#F6C32A');
const panelFontSize= ref(14);
const panelFontColor = ref('#F6C32A');
// Sombra e Caixinha — defaults reproduzem o visual fixo de antes (caixinha
// preta a 75%, sem borda, sem sombra); ver Slide.vue#boxAndShadowStyle.
const textShadow      = ref(false);
const shadowIntensity = ref(0.8);
const shadowBlur      = ref(2.2);
const textBox         = ref(true);
const boxOpacity      = ref(0.75);
const boxBorder       = ref(false);

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

// ── Prévia ao vivo (fundo + letra) ─────────────────────────────────────────
// Cor de fundo lida direto do $userdata (mesmo motivo de animatedBg/imageFit
// acima) — cai por trás da imagem/vídeo/fundo animado, igual ao Slide.vue.
const previewBgColor = computed(() => proxy?.$userdata?.get(`modules.${ID}.background_color`, '') || '#000000');
const previewContainerStyle = computed(() => ({ backgroundColor: previewBgColor.value }));

// Estilo da letra de exemplo — mesmos campos usados no slide de verdade
// (fonte/tamanho/cor + sombra/caixinha), com escala fixa (a prévia é bem
// menor que a projeção real, então não há um fontSizePc equivalente aqui).
const previewTextStyle = computed(() => ({
  fontFamily:      font.value || 'DINCondensedBold, sans-serif',
  fontSize:        `${fontSize.value}px`,
  color:           fontColor.value || '#FFFFFF',
  textTransform:   'uppercase',
  backgroundColor: textBox.value ? `rgba(0, 0, 0, ${boxOpacity.value})` : 'transparent',
  border:          (textBox.value && boxBorder.value) ? '1px solid rgba(255, 255, 255, 0.25)' : 'none',
  textShadow:      textShadow.value ? `0 0 ${shadowBlur.value * 3}px rgba(0, 0, 0, ${shadowIntensity.value})` : 'none',
  padding:         '6px 18px',
  borderRadius:    '4px',
  textAlign:       'center',
}));

// ── Carrega estado local a partir do $userdata ────────────────────────────
function loadFromUserdata() {
  const ud = proxy?.$userdata;
  if (!ud) return;
  // bgType NÃO é carregado do userdata aqui — ele é determinado pelo estado atual
  // do localStorage em onMounted (fonte de verdade = o que o slide está mostrando).
  imageUrl.value      = ud.get(`modules.${ID}.image`,          '')    ?? '';
  videoUrl.value      = ud.get(`modules.${ID}.video`,          '')    ?? '';
  imageOpacity.value  = ud.get(`modules.${ID}.image_opacity`,  85)    ?? 85;
  textEnabled.value   = ud.get(`modules.${ID}.text_enabled`,   true)  ?? true;
  font.value          = ud.get(`modules.${ID}.font`,           '')    ?? '';
  fontSize.value      = ud.get(`modules.${ID}.font_size`,      20)    ?? 20;
  fontColor.value     = ud.get(`modules.${ID}.font_color`,     '#FFFFFF') ?? '#FFFFFF';
  coverFontSize.value   = ud.get(`modules.${ID}.cover_font_size`,   25) ?? 25;
  coverFontColor.value  = ud.get(`modules.${ID}.cover_font_color`,  '#F6C32A') ?? '#F6C32A';
  repeatFontColor.value = ud.get(`modules.${ID}.repeat_font_color`, '#F6C32A') ?? '#F6C32A';
  panelFontSize.value = ud.get(`modules.${ID}.panel_font_size`, 14)   ?? 14;
  panelFontColor.value = ud.get(`modules.${ID}.panel_font_color`, '#F6C32A') ?? '#F6C32A';
  textShadow.value      = ud.get(`modules.${ID}.text_shadow`,      false) ?? false;
  shadowIntensity.value = ud.get(`modules.${ID}.shadow_intensity`, 0.8)   ?? 0.8;
  shadowBlur.value      = ud.get(`modules.${ID}.shadow_blur`,      2.2)   ?? 2.2;
  textBox.value         = ud.get(`modules.${ID}.text_box`,         true)  ?? true;
  boxOpacity.value      = ud.get(`modules.${ID}.box_opacity`,      0.75)  ?? 0.75;
  boxBorder.value       = ud.get(`modules.${ID}.box_border`,       false) ?? false;
}

// ── Sync para localStorage — Slide.vue lê desta chave ─────────────────────
// Lê direto do $userdata para capturar também mudanças do CustomizationTools.
function syncToLocalStorage() {
  // Após um reset, o watcher dispara mas não deve re-escrever o localStorage
  if (_resetPending) { _resetPending = false; return; }
  // Sombra/Caixinha contam como personalização ativa mesmo com fundo/texto
  // desligados — sem isso, ajustar só a sombra (bgType e textEnabled ainda
  // nos defaults) caía direto no ramo neutro abaixo e nunca era salvo.
  const shadowBoxCustomized = textShadow.value || !textBox.value || boxBorder.value
    || boxOpacity.value !== 0.75 || shadowIntensity.value !== 0.8 || shadowBlur.value !== 2.2;
  // Estado neutro (nem fundo, nem texto, nem sombra/caixinha personalizados):
  // remove qualquer personalização anterior — do contrário um "Desativado" no
  // texto depois de um fundo já resetado deixaria font/font_color velhos
  // presos no slide.
  if (!bgType.value && !textEnabled.value && !shadowBoxCustomized) {
    try { localStorage.removeItem('slide_global_bg'); } catch (_) {}
    window.dispatchEvent(new CustomEvent('slide-bg-changed'));
    if (window.electron && !proxy?.$appdata?.get?.('is_popup')) {
      window.electron.sendStateUpdate({ param: 'slide_global_bg', value: null });
    }
    // Marca o recurso como inativo — é isso que o App.vue lê na próxima
    // inicialização pra saber se deve restaurar o fundo personalizado ou não.
    proxy?.$electron?.storeRemove?.('slide_global_bg_persisted').catch(() => {});
    return;
  }
  const ud = proxy?.$userdata;
  if (!ud) return;
  const type = bgType.value; // null = mantém a imagem padrão de cada slide
  const url  = type === 'video' ? (videoUrl.value || '') : (imageUrl.value || '');
  const effectiveType = !type ? 'default' : ((type !== 'none' && !url) ? 'none' : type);
  try {
    const bgData = {
      // Fundo
      type:             effectiveType,
      bgType:           type,           // seleção real do usuário (restaurado no onMounted)
      url,
      opacity:          imageOpacity.value,
      fit:              ud.get(`modules.${ID}.image_fit`,        'cover')      || 'cover',
      background_color: ud.get(`modules.${ID}.background_color`, '') || '',
      // Fundo animado (Three.js/GSAP/anime.js/Motion — ver components/
      // AnimatedBackground.vue) — independente do tipo acima (imagem/vídeo),
      // pra poder combinar os dois (ex.: fundo animado com um logo em imagem
      // semi-transparente por cima, já suportado pela ordem de camadas do
      // Slide.vue).
      animated_bg:       ud.get(`modules.${ID}.animated_bg`, 'none') || 'none',
      animated_bg_color: ud.get(`modules.${ID}.animated_bg_color`, '#7aa0ff') || '#7aa0ff',
      // Posição da letra em tela — independente de textEnabled (é a posição
      // do bloco de texto, não sua fonte/cor), sempre aplicada como as demais
      // opções de layout (ex.: border_spacing, mais abaixo).
      horizontal_align: ud.get(`modules.${ID}.horizontal_align`, 'center') || 'center',
      vertical_align:   ud.get(`modules.${ID}.vertical_align`,   'center') || 'center',
      // Texto — independente do fundo; só aplica quando textEnabled (lê refs
      // direto para garantir valor mais recente, sem delay de Vuex)
      font:             textEnabled.value ? (font.value || '')  : '',
      font_size:        textEnabled.value ? fontSize.value      : null,
      font_color:       textEnabled.value ? (fontColor.value || '') : '',
      cover_font_size:  textEnabled.value ? coverFontSize.value : null,
      cover_font_color: textEnabled.value ? (coverFontColor.value || '') : '',
      repeat_font_color: textEnabled.value ? (repeatFontColor.value || '') : '',
      panel_font_size:  textEnabled.value ? panelFontSize.value : null,
      panel_font_color: textEnabled.value ? (panelFontColor.value || '') : '',
      // Sombra e Caixinha — independentes de textEnabled, mesma lógica do
      // animated_bg/alinhamento acima (ver Slide.vue#boxAndShadowStyle).
      text_shadow:      textShadow.value,
      shadow_intensity: shadowIntensity.value,
      shadow_blur:      shadowBlur.value,
      text_box:         textBox.value,
      box_opacity:      boxOpacity.value,
      box_border:       boxBorder.value,
      // Janela
      border_spacing:   ud.get(`modules.${ID}.border_spacing`,   5)            ?? 5,
    };
    localStorage.setItem('slide_global_bg', JSON.stringify(bgData));

    // Atualiza a janela atual (mesma aba / modo web)
    window.dispatchEvent(new CustomEvent('slide-bg-changed'));

    // Sincroniza em tempo real com a janela de saída via IPC (Electron)
    // state-update é interceptado pelo main process e reenviado para o outputWindow
    if (window.electron && !proxy?.$appdata?.get?.('is_popup')) {
      window.electron.sendStateUpdate({ param: 'slide_global_bg', value: bgData });
    }

    // Persiste o recurso como ATIVO no electron-store (sobrevive a reinícios do
    // app) — o App.vue lê essa chave na próxima inicialização pra restaurar o
    // mesmo fundo/texto personalizado em vez de sempre voltar ao padrão.
    proxy?.$electron?.storeSet?.('slide_global_bg_persisted', bgData).catch(() => {});
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
  // v === null significa que o usuário clicou no botão já ativo (toggle off)
  // — não fazemos nada; para voltar ao padrão usa-se "Redefinir".
  if (!v) return;
  bgType.value = v;           // reativo imediato → botão ativo atualiza
  proxy?.$userdata?.set(`modules.${ID}.bg_type`, v);
  // Fundo animado tem precedência sobre tipo (ver Slide.vue style_bg) —
  // sem isso, escolher Sem Fundo/Imagem/Vídeo aqui não tinha efeito visual
  // nenhum enquanto um fundo animado já selecionado continuasse "preso".
  proxy?.$userdata?.set(`modules.${ID}.animated_bg`, 'none');
  // Garante o sync mesmo quando $userdata.set não dispara o watcher
  // (valor igual no store, ex: 'none' → 'none' após um Redefinir).
  syncToLocalStorage();
}
function setOpacity(v) {
  imageOpacity.value = v;
  proxy?.$userdata?.set(`modules.${ID}.image_opacity`, v);
  if (bgType.value) syncToLocalStorage();
}

function setTextEnabled(v) {
  if (v === undefined || v === null) return; // ignora toggle-off (mandatory mantém sempre um valor)
  textEnabled.value = v;
  proxy?.$userdata?.set(`modules.${ID}.text_enabled`, v);
  syncToLocalStorage();
}
function setFont(v) {
  font.value = v;
  proxy?.$userdata?.set(`modules.${ID}.font`, v);
  if (bgType.value || textEnabled.value) syncToLocalStorage();
}
function setFontSize(v) {
  fontSize.value = v;
  proxy?.$userdata?.set(`modules.${ID}.font_size`, v);
  if (bgType.value || textEnabled.value) syncToLocalStorage();
}
function setFontColor(v) {
  fontColor.value = v;
  proxy?.$userdata?.set(`modules.${ID}.font_color`, v);
  if (bgType.value || textEnabled.value) syncToLocalStorage();
}
function setCoverFontSize(v) {
  coverFontSize.value = v;
  proxy?.$userdata?.set(`modules.${ID}.cover_font_size`, v);
  if (bgType.value || textEnabled.value) syncToLocalStorage();
}
function setCoverFontColor(v) {
  coverFontColor.value = v;
  proxy?.$userdata?.set(`modules.${ID}.cover_font_color`, v);
  if (bgType.value || textEnabled.value) syncToLocalStorage();
}
function setRepeatFontColor(v) {
  repeatFontColor.value = v;
  proxy?.$userdata?.set(`modules.${ID}.repeat_font_color`, v);
  if (bgType.value || textEnabled.value) syncToLocalStorage();
}
function setPanelFontSize(v) {
  panelFontSize.value = v;
  proxy?.$userdata?.set(`modules.${ID}.panel_font_size`, v);
  if (bgType.value || textEnabled.value) syncToLocalStorage();
}
function setPanelFontColor(v) {
  panelFontColor.value = v;
  proxy?.$userdata?.set(`modules.${ID}.panel_font_color`, v);
  if (bgType.value || textEnabled.value) syncToLocalStorage();
}

// ── Setters de Sombra e Caixinha (independentes de bgType/textEnabled) ────
function setTextShadow(v) {
  textShadow.value = v;
  proxy?.$userdata?.set(`modules.${ID}.text_shadow`, v);
  syncToLocalStorage();
}
function setShadowIntensity(v) {
  shadowIntensity.value = v;
  proxy?.$userdata?.set(`modules.${ID}.shadow_intensity`, v);
  syncToLocalStorage();
}
function setShadowBlur(v) {
  shadowBlur.value = v;
  proxy?.$userdata?.set(`modules.${ID}.shadow_blur`, v);
  syncToLocalStorage();
}
function setTextBox(v) {
  textBox.value = v;
  proxy?.$userdata?.set(`modules.${ID}.text_box`, v);
  syncToLocalStorage();
}
function setBoxOpacity(v) {
  boxOpacity.value = v;
  proxy?.$userdata?.set(`modules.${ID}.box_opacity`, v);
  syncToLocalStorage();
}
function setBoxBorder(v) {
  boxBorder.value = v;
  proxy?.$userdata?.set(`modules.${ID}.box_border`, v);
  syncToLocalStorage();
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
      if (bgType.value) syncToLocalStorage();
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
      if (bgType.value) syncToLocalStorage();
    }
  } finally { pickingVideo.value = false; }
}

function clearImage() {
  imageUrl.value = '';
  proxy?.$userdata?.set(`modules.${ID}.image`, '');
  if (bgType.value) syncToLocalStorage();
}
function clearVideo() {
  videoUrl.value = '';
  proxy?.$userdata?.set(`modules.${ID}.video`, '');
  if (bgType.value) syncToLocalStorage();
}

// Redefine o fundo para o padrão do slide. Texto é independente — se estiver
// ativado, syncToLocalStorage mantém a personalização (só o fundo é resetado);
// se não, cai no ramo "neutro" e limpa o localStorage por completo.
function resetToDefault() {
  bgType.value = null;
  proxy?.$userdata?.set(`modules.${ID}.animated_bg`, 'none');
  syncToLocalStorage();

  // Suprime um possível sync automático subsequente do watcher (bgType mudou
  // via ref, não userdata — não deveria disparar o watcher, mas por segurança).
  _resetPending = true;
  setTimeout(() => { _resetPending = false; }, 0);
}

// ── Inicialização ─────────────────────────────────────────────────────────
onMounted(() => {
  loadFromUserdata(); // carrega imageUrl, videoUrl, font, etc. do userdata

  // bgType reflete o ESTADO ATUAL DO SLIDE (localStorage) — não o userdata salvo.
  // Isso garante que o botão exibido corresponde ao que o slide está mostrando:
  //   • App recém-iniciado (localStorage limpo por App.vue): null → nenhum botão
  //   • Sessão ativa com bg personalizado (localStorage tem valor): botão correto
  try {
    const raw = localStorage.getItem('slide_global_bg');
    if (raw) {
      const stored = JSON.parse(raw);
      // bgType = seleção real do usuário; type = effectiveType (pode ser 'none'/'default'
      // mesmo em modo 'image'). "bgType" pode ser explicitamente null (texto ativado sem
      // fundo personalizado) — só cai para "type" quando a chave nem existe (dado antigo).
      bgType.value = ('bgType' in stored) ? stored.bgType : (stored?.type ?? null);
    } else {
      bgType.value = null;
    }
  } catch (_) {
    bgType.value = null;
  }
});
</script>

<style scoped>
.sbg-root  { padding: 16px 8px; max-width: 560px; margin: 0 auto; }
.sbg-toggle { width: 100%; }

.sbg-filename {
  max-width: 100%; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}

/* ── Prévia ao vivo — fundo (cor/imagem/vídeo/animado) + letra, no mesmo
     estilo de cartão com cantos arredondados usado no resto do sistema
     (ex.: a barra de personalização, ver CustomizationBar.vue). ──────── */
.sbg-live-preview {
  position: relative;
  width: 100%;
  height: 150px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(128, 128, 128, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}
.sbg-live-preview-media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.sbg-live-preview-text {
  position: relative;
  z-index: 1;
  font-weight: 700;
  letter-spacing: 0.04em;
  word-break: break-word;
  max-width: 90%;
  text-align: center;
}

/* ── Rótulo dos seletores de cor — quebra em 2 linhas em vez de vazar
     para a coluna vizinha quando o texto é longo (ex.: "de repetição") ── */
.sbg-color-label {
  max-width: 78px;
  white-space: normal;
  text-align: center;
  line-height: 1.15;
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
