<template>
  <Window
    v-model="module.show"
    :title="t('title')"
    :icon="module.icon"
    :index="module.show ? 1 : 0"
    closable
    minimizable
    compact
    @close="close()"
    @minimize="$modules.minimize(module_id)"
  >
    <div class="lt-root">

      <!-- ── RIBBON TOOLBAR ─────────────────────────────────────── -->
      <div class="lt-ribbon">

        <!-- Adicionar -->
        <div class="lt-group">
          <div class="lt-group-body">
            <button class="lt-btn lt-btn--large" @click="openAdd">
              <v-icon size="22">mdi-plus</v-icon>
              <span>Adicionar Item</span>
            </button>
          </div>
          <div class="lt-group-label">Adicionar</div>
        </div>

        <div class="lt-sep" />

        <!-- Itens -->
        <div class="lt-group">
          <div class="lt-group-body lt-group-body--col">
            <button class="lt-btn lt-btn--sm" @click="selectAll">
              <v-icon size="14">mdi-checkbox-multiple-marked-outline</v-icon>Marcar Todos
            </button>
            <button class="lt-btn lt-btn--sm" @click="deselectAll">
              <v-icon size="14">mdi-checkbox-multiple-blank-outline</v-icon>Desmarcar Todos
            </button>
            <button class="lt-btn lt-btn--sm" @click="invertSel">
              <v-icon size="14">mdi-select-inverse</v-icon>Inverter Seleção
            </button>
          </div>
          <div class="lt-group-label">Itens</div>
        </div>

        <div class="lt-sep" />

        <!-- Apagar -->
        <div class="lt-group">
          <div class="lt-group-body">
            <button class="lt-btn lt-btn--large lt-btn--danger" :disabled="!hasSelected" @click="deleteSelected">
              <v-icon size="22">mdi-close</v-icon>
              <span>Apagar<br>Selecionados</span>
            </button>
          </div>
          <div class="lt-group-label">Apagar</div>
        </div>

        <div class="lt-sep" />

        <!-- Opções -->
        <div class="lt-group">
          <div class="lt-group-body lt-group-body--col">
            <button class="lt-btn lt-btn--sm" :disabled="!hasSelected" @click="markDone">
              <v-icon size="14">mdi-check-circle-outline</v-icon>Marcar como Concluído
            </button>
            <button class="lt-btn lt-btn--sm" @click="showPresentation">
              <v-icon size="14">mdi-monitor-screenshot</v-icon>Exibir Painel de Apres.
            </button>
            <button class="lt-btn lt-btn--sm" :disabled="!hasSelected" @click="toggleLock">
              <v-icon size="14">mdi-lock-outline</v-icon>Bloquear Itens
            </button>
          </div>
          <div class="lt-group-label">Opções</div>
        </div>

      </div>

      <!-- ── DAY TABS ───────────────────────────────────────────── -->
      <div class="lt-days">
        <button
          v-for="day in DAYS"
          :key="day.key"
          :class="['lt-day', { 'lt-day--active': currentDay === day.key, 'lt-day--sabado': day.key === 'sabado' }]"
          @click="currentDay = day.key"
        >
          <v-icon size="14" class="lt-day-icon">
            {{ day.key === 'sabado' ? 'mdi-calendar-star' : 'mdi-calendar' }}
          </v-icon>
          {{ day.label }}
        </button>
      </div>

      <!-- ── BODY ───────────────────────────────────────────────── -->
      <div class="lt-body">

        <!-- Content: items list or empty state -->
        <div class="lt-content">
          <!-- Empty state -->
          <div v-if="dayItems.length === 0" class="lt-empty">
            <v-icon size="60" color="grey-lighten-1">mdi-script-text-outline</v-icon>
            <div class="lt-empty-title">Liturgia vazia</div>
            <div class="lt-empty-sub">
              Adicione músicas, anotações, sites, arquivos e categorias para montar seu culto.
            </div>
            <button class="lt-add-center-btn" @click="openAdd">
              <v-icon size="16">mdi-plus</v-icon> Adicionar item
            </button>
          </div>

          <!-- Items list -->
          <div v-else class="lt-list">
            <div
              v-for="(item, idx) in dayItems"
              :key="item.id"
              :class="['lt-item', {
                'lt-item--selected': item.selected,
                'lt-item--done':     item.done,
                'lt-item--locked':   item.locked,
              }]"
              @click="toggleSelect(idx)"
            >
              <div class="lt-item-stripe" :style="{ background: item.color }" />
              <input
                type="checkbox"
                class="lt-item-check"
                :checked="item.selected"
                @click.stop
                @change="setSelected(idx, $event.target.checked)"
              />
              <div
                class="lt-item-icon-badge"
                :style="{ background: item.color + '22', color: item.color }"
              >
                <v-icon size="15" :color="item.color">{{ typeIcon(item.type) }}</v-icon>
              </div>
              <div class="lt-item-info">
                <div class="lt-item-name">{{ item.name }}</div>
                <div class="lt-item-sub">{{ typeLabel(item.type) }}</div>
              </div>
              <div class="lt-item-dur" v-if="item.duration">{{ formatDur(item.duration) }}</div>
              <v-icon v-if="item.locked" size="13" class="lt-item-lock">mdi-lock</v-icon>
              <div class="lt-item-actions" @click.stop>
                <button class="lt-row-btn" :disabled="idx === 0" @click="moveUp(idx)">
                  <v-icon size="13">mdi-chevron-up</v-icon>
                </button>
                <button class="lt-row-btn" :disabled="idx === dayItems.length - 1" @click="moveDown(idx)">
                  <v-icon size="13">mdi-chevron-down</v-icon>
                </button>
                <MusicMenuTable
                  v-if="item.type === 'musica'"
                  :id_music="item.id_music"
                  :has_instrumental_music="item.has_instrumental_music"
                  class="lt-item-music-menu"
                />
                <button class="lt-row-btn lt-row-btn--del" @click="removeItem(idx)">
                  <v-icon size="13">mdi-close</v-icon>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right panel: Anotações -->
        <div class="lt-notes">
          <div class="lt-notes-head">
            <v-icon size="14" class="me-1">mdi-note-text-outline</v-icon>
            <span>Anotações</span>
            <span class="lt-notes-day">{{ currentDayUpper }}</span>
          </div>

          <textarea
            v-model="dayNotes"
            class="lt-notes-area"
            placeholder="Anotações para este dia..."
            :style="notesTextStyle"
          />

          <!-- Font controls -->
          <div class="lt-notes-bar">
            <div class="lt-notes-bar-row">
              <select v-model="nFont" class="lt-ns lt-ns-font">
                <option v-for="f in FONTS" :key="f" :value="f">{{ f }}</option>
              </select>
              <select v-model="nSize" class="lt-ns lt-ns-size">
                <option v-for="s in SIZES" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
            <div class="lt-notes-bar-row">
              <button :class="['lt-fb', { 'lt-fb--on': nBold }]"   @click="nBold   = !nBold"><b>N</b></button>
              <button :class="['lt-fb', { 'lt-fb--on': nItalic }]" @click="nItalic = !nItalic"><i>I</i></button>
              <button :class="['lt-fb', { 'lt-fb--on': nStrike }]" @click="nStrike = !nStrike" style="text-decoration:line-through">S</button>
              <button :class="['lt-fb', { 'lt-fb--on': nUnder }]"  @click="nUnder  = !nUnder"  style="text-decoration:underline">abc</button>
              <span class="lt-vbar" />
              <button class="lt-fb lt-fb--color" @click="$refs.nColor.click()">
                <div class="lt-fb-swatch" :style="{ background: nColor || 'currentColor' }" />
              </button>
              <input ref="nColor" type="color" :value="nColor || '#ffffff'" style="display:none" @change="nColor = $event.target.value" />
            </div>
            <div class="lt-notes-bar-row">
              <button :class="['lt-fb', { 'lt-fb--on': nAlign==='left' }]"    @click="nAlign='left'">
                <v-icon size="13">mdi-format-align-left</v-icon>
              </button>
              <button :class="['lt-fb', { 'lt-fb--on': nAlign==='center' }]"  @click="nAlign='center'">
                <v-icon size="13">mdi-format-align-center</v-icon>
              </button>
              <button :class="['lt-fb', { 'lt-fb--on': nAlign==='right' }]"   @click="nAlign='right'">
                <v-icon size="13">mdi-format-align-right</v-icon>
              </button>
              <button :class="['lt-fb', { 'lt-fb--on': nAlign==='justify' }]" @click="nAlign='justify'">
                <v-icon size="13">mdi-format-align-justify</v-icon>
              </button>
              <span class="lt-vbar" />
              <button :class="['lt-fb', { 'lt-fb--on': nList==='bullet' }]" @click="nList = nList==='bullet'?'':'bullet'">
                <v-icon size="13">mdi-format-list-bulleted</v-icon>
              </button>
              <button :class="['lt-fb', { 'lt-fb--on': nList==='number' }]" @click="nList = nList==='number'?'':'number'">
                <v-icon size="13">mdi-format-list-numbered</v-icon>
              </button>
            </div>
          </div>

          <div class="lt-status">
            <v-icon size="13" class="me-1">mdi-clock-outline</v-icon>
            Tempo total estimado: {{ totalTimeLabel }}
          </div>
        </div>

      </div>
    </div>

    <!-- ── ADD ITEM DIALOG ───────────────────────────────────────── -->
    <v-dialog v-model="addDialog" max-width="540" scrollable @after-leave="resetForm">
      <v-card>
        <v-card-title class="d-flex align-center pa-3 text-body-1 font-weight-medium">
          <v-icon start size="16">mdi-plus</v-icon>
          Adicionar Item
          <v-spacer />
          <v-btn icon size="small" variant="text" @click="addDialog = false">
            <v-icon size="16">mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider />

        <v-card-text class="pa-4">
          <!-- Linha 1: Tipo + Nome -->
          <div class="lt-form-row">
            <div class="lt-form-field">
              <label class="lt-label">Tipo:</label>
              <v-select
                v-model="form.type"
                :items="[
                  { title: 'Anotação',          value: 'anotacao'  },
                  { title: 'Arquivo/Diretório',  value: 'arquivo'   },
                  { title: 'Categoria',          value: 'categoria' },
                  { title: 'Itens Agendados',    value: 'agendados' },
                  { title: 'Música',             value: 'musica'    },
                  { title: 'Site',               value: 'site'      },
                ]"
                density="compact"
                variant="outlined"
                hide-details
                style="min-width: 155px"
              />
            </div>
            <div class="lt-form-field lt-form-field--grow">
              <label class="lt-label">Nome do Item:</label>
              <input
                v-model="form.name"
                class="lt-input"
                :placeholder="form.type === 'musica' ? 'Selecione uma música abaixo...' : 'Ex.: Boas-vindas, Oração inicial, Oferta...'"
                :readonly="form.type === 'musica'"
              />
            </div>
          </div>

          <!-- Linha 2: Cor + Duração -->
          <div class="lt-form-row" style="margin-top:10px; align-items:flex-end">
            <div class="lt-form-field">
              <label class="lt-label">Cor:</label>
              <button class="lt-color-swatch" :style="{ background: form.color }" @click="$refs.formColor.click()" />
              <input ref="formColor" type="color" v-model="form.color" style="display:none" />
            </div>
            <div class="lt-form-field">
              <label class="lt-label">Duração (min):</label>
              <input type="number" v-model.number="form.duration" class="lt-input lt-input--sm" min="0" max="999" />
            </div>
          </div>

          <!-- Anotação -->
          <template v-if="form.type === 'anotacao'">
            <div class="lt-section-lbl">ANOTAÇÕES</div>
            <label class="lt-label">Texto do item:</label>
            <textarea v-model="form.text" class="lt-textarea" placeholder="Anotações ou lembrado..." />
          </template>

          <!-- Arquivo -->
          <template v-else-if="form.type === 'arquivo'">
            <div class="lt-section-lbl">ARQUIVO / DIRETÓRIO</div>
            <label class="lt-label">Caminho:</label>
            <input v-model="form.url" class="lt-input lt-input--full" placeholder="C:\caminho\arquivo.pdf" />
          </template>

          <!-- Site -->
          <template v-else-if="form.type === 'site'">
            <div class="lt-section-lbl">SITE</div>
            <label class="lt-label">URL:</label>
            <input v-model="form.url" class="lt-input lt-input--full" placeholder="https://..." />
          </template>

          <!-- Música -->
          <template v-else-if="form.type === 'musica'">
            <div class="lt-section-lbl">MÚSICA</div>
            <input v-model="musicSearch" class="lt-input lt-input--full" placeholder="Buscar música..." style="margin-bottom:8px" />
            <div class="lt-music-list">
              <div v-if="musicLoading" class="d-flex justify-center pa-4">
                <v-progress-circular indeterminate size="24" color="primary" />
              </div>
              <template v-else>
                <div
                  v-for="m in filteredMusics"
                  :key="m.id_music"
                  :class="['lt-music-row', { 'lt-music-row--sel': form.id_music === m.id_music }]"
                  @click="pickMusic(m)"
                >
                  <div class="lt-music-name">{{ m.name }}</div>
                  <div class="lt-music-sub">{{ m.albums_names }}</div>
                </div>
                <div v-if="!filteredMusics.length" class="lt-music-empty">Nenhuma música encontrada</div>
              </template>
            </div>
          </template>
        </v-card-text>

        <v-divider />
        <v-card-actions class="pa-3">
          <v-spacer />
          <v-btn variant="text" @click="addDialog = false">Cancelar</v-btn>
          <v-btn color="primary" prepend-icon="mdi-plus" :disabled="!canAdd" @click="confirmAdd">
            Adicionar item
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </Window>
</template>

<script>
import manifest from '../manifest.json';
import Window from '@/components/Window.vue';
import MusicMenuTable from '@/components/MusicMenuTable.vue';

const DAYS = [
  { key: 'domingo', label: 'Domingo' },
  { key: 'segunda', label: 'Segunda' },
  { key: 'terca',   label: 'Terça'   },
  { key: 'quarta',  label: 'Quarta'  },
  { key: 'quinta',  label: 'Quinta'  },
  { key: 'sexta',   label: 'Sexta'   },
  { key: 'sabado',  label: 'Sábado'  },
];

const FONTS = ['Tahoma', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48];

const TYPE_LABEL = {
  anotacao:  'Anotação',
  arquivo:   'Arquivo/Diretório',
  categoria: 'Categoria',
  agendados: 'Itens Agendados',
  musica:    'Música',
  site:      'Site',
};

const TYPE_ICON = {
  anotacao:  'mdi-note-text-outline',
  arquivo:   'mdi-folder-outline',
  categoria: 'mdi-music-box-multiple-outline',
  agendados: 'mdi-calendar-check-outline',
  musica:    'mdi-music-note',
  site:      'mdi-web',
};

function emptyForm() {
  return { type: 'anotacao', name: '', color: '#1a237e', duration: 0, text: '', url: '', id_music: null, has_instrumental_music: false };
}

export default {
  name: 'LiturgiaModule',
  components: { Window, MusicMenuTable },

  data: () => ({
    DAYS,
    FONTS,
    SIZES,

    addDialog:    false,
    form:         emptyForm(),
    musicSearch:  '',
    musicLoading: false,
    allMusics:    [],

    nFont:   'Tahoma',
    nSize:   12,
    nBold:   false,
    nItalic: false,
    nStrike: false,
    nUnder:  false,
    nColor:  null,   // null = herda a cor do tema; valor hex = cor explícita do usuário
    nAlign:  'left',
    nList:   '',
  }),

  computed: {
    /* ── obrigatórias ── */
    module_id() { return manifest.id; },
    module()    { return this.$modules.get(this.module_id) || {}; },

    currentDay: {
      get() { return this.$userdata.get('modules.liturgia.currentDay', 'segunda'); },
      set(v) { this.$userdata.set('modules.liturgia.currentDay', v); },
    },
    currentDayLabel() { return DAYS.find(d => d.key === this.currentDay)?.label || ''; },
    currentDayUpper() { return this.currentDayLabel.toUpperCase(); },

    dayItems: {
      get() { return this.$userdata.get(`modules.liturgia.days.${this.currentDay}.items`) || []; },
      set(v) { this.$userdata.set(`modules.liturgia.days.${this.currentDay}.items`, v); },
    },
    dayNotes: {
      get() { return this.$userdata.get(`modules.liturgia.days.${this.currentDay}.notes`) || ''; },
      set(v) { this.$userdata.set(`modules.liturgia.days.${this.currentDay}.notes`, v); },
    },

    hasSelected() { return this.dayItems.some(i => i.selected); },

    totalTime() {
      return this.dayItems.reduce((s, i) => s + (Number(i.duration) || 0), 0);
    },
    totalTimeLabel() {
      const m = this.totalTime;
      if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}min`;
      return `${m}min`;
    },

    notesTextStyle() {
      const style = {
        fontFamily:     this.nFont,
        fontSize:       `${this.nSize}px`,
        fontWeight:     this.nBold   ? 'bold'   : 'normal',
        fontStyle:      this.nItalic ? 'italic' : 'normal',
        textDecoration: [this.nStrike ? 'line-through' : '', this.nUnder ? 'underline' : ''].filter(Boolean).join(' ') || 'none',
        textAlign:      this.nAlign,
      };
      if (this.nColor) style.color = this.nColor;
      return style;
    },

    filteredMusics() {
      const q = this.$string.clean(this.musicSearch.trim());
      if (!q) return this.allMusics.slice(0, 60);
      return this.allMusics
        .filter(m => (m._nc || '').includes(q) || (m._ac || '').includes(q))
        .slice(0, 60);
    },

    canAdd() {
      return this.form.type === 'musica' ? !!this.form.id_music : !!this.form.name.trim();
    },
  },

  watch: {
    addDialog(v) {
      if (v && !this.allMusics.length) this.loadMusics();
    },
  },

  methods: {
    /* ── obrigatórios ── */
    t(text) {
      const key = `modules.${this.module_id}.${text}`;
      const result = this.$t(key);
      if (result === key) {
        if (text === 'title') return manifest.name || result;
        const locale = this.$i18n?.locale?.value || this.$i18n?.locale || 'pt';
        const stored = this.$appdata.get(`modules.${this.module_id}.manifest`);
        const tr = stored?.translations?.[locale] || stored?.translations?.['pt'];
        if (tr) {
          const val = text.split('.').reduce((o, k) => o?.[k], tr);
          if (typeof val === 'string') return val;
        }
      }
      return result;
    },
    close() { this.$modules.close(this.module_id); },

    typeLabel(t) { return TYPE_LABEL[t] || t; },
    typeIcon(t)  { return TYPE_ICON[t]  || 'mdi-circle-outline'; },
    formatDur(m) {
      return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}min` : ''}` : `${m}min`;
    },

    /* ── music loader ── */
    async loadMusics() {
      this.musicLoading = true;
      try {
        const locale = this.$i18n?.locale?.value || this.$i18n?.locale || 'pt';
        const data = await this.$database.get(`${locale}_musics`);
        const arr = Array.isArray(data) ? data : Object.values(data || {});
        arr.sort((a, b) => this.$string.sort(a.name, b.name));
        this.allMusics = arr.map(m => ({
          ...m,
          _nc: this.$string.clean(m.name),
          _ac: this.$string.clean(m.albums_names || ''),
        }));
      } catch (_) {
        this.allMusics = [];
      } finally {
        this.musicLoading = false;
      }
    },

    pickMusic(m) {
      this.form.id_music = m.id_music;
      this.form.name = m.name;
      this.form.has_instrumental_music = !!m.has_instrumental_music;
      const sec = Number(m.duration) || 0;
      this.form.duration = sec ? Math.ceil(sec / 60) : 0;
    },

    openAdd()    { this.addDialog = true; },
    resetForm()  { this.form = emptyForm(); this.musicSearch = ''; },

    confirmAdd() {
      if (!this.canAdd) return;
      const { type, name, color, duration, text, url, id_music, has_instrumental_music } = this.form;
      this.dayItems = [...this.dayItems, {
        id:                    Date.now(),
        type,
        name:                  name.trim(),
        color:                 color || '#1a237e',
        duration:              Number(duration) || 0,
        text:                  text || '',
        url:                   url  || '',
        id_music:              id_music || null,
        has_instrumental_music: !!has_instrumental_music,
        selected:              false,
        done:                  false,
        locked:                false,
      }];
      this.addDialog = false;
    },

    /* ── item row ── */
    removeItem(idx) {
      const l = [...this.dayItems]; l.splice(idx, 1); this.dayItems = l;
    },
    moveUp(idx) {
      if (idx === 0) return;
      const l = [...this.dayItems];
      [l[idx - 1], l[idx]] = [l[idx], l[idx - 1]];
      this.dayItems = l;
    },
    moveDown(idx) {
      const l = [...this.dayItems];
      if (idx >= l.length - 1) return;
      [l[idx], l[idx + 1]] = [l[idx + 1], l[idx]];
      this.dayItems = l;
    },
    toggleSelect(idx) {
      const l = [...this.dayItems];
      l[idx] = { ...l[idx], selected: !l[idx].selected };
      this.dayItems = l;
    },
    setSelected(idx, v) {
      const l = [...this.dayItems];
      l[idx] = { ...l[idx], selected: v };
      this.dayItems = l;
    },
    playItem(item) {
      if (item.type === 'musica') this.$media.open({ id_music: item.id_music, mode: 'audio' });
    },

    /* ── toolbar ── */
    selectAll()      { this.dayItems = this.dayItems.map(i => ({ ...i, selected: true  })); },
    deselectAll()    { this.dayItems = this.dayItems.map(i => ({ ...i, selected: false })); },
    invertSel()      { this.dayItems = this.dayItems.map(i => ({ ...i, selected: !i.selected })); },
    deleteSelected() { this.dayItems = this.dayItems.filter(i => !i.selected); },
    markDone()       { this.dayItems = this.dayItems.map(i => i.selected ? { ...i, done: !i.done } : i); },
    toggleLock()     { this.dayItems = this.dayItems.map(i => i.selected ? { ...i, locked: !i.locked } : i); },
    showPresentation() {
      const item = this.dayItems.find(i => i.selected && i.type === 'musica') ||
                   this.dayItems.find(i => i.type === 'musica');
      if (item) this.$media.open({ id_music: item.id_music, mode: 'audio' });
    },
  },
};
</script>

<style scoped>
/*
 * Usamos rgb(var(--v-theme-*)) do Vuetify 4 para background e texto.
 * Essas vars são definidas no elemento com v-theme--light/dark e cascadeiam
 * corretamente para todo conteúdo incluindo dialogs teleportados.
 * Vars customizadas são mantidas apenas para cores de destaque únicas.
 */
.lt-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

/* ── Ribbon ── */
.lt-ribbon {
  display: flex;
  align-items: stretch;
  gap: 0;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 3px 6px 0;
  flex-shrink: 0;
  user-select: none;
}

.lt-group {
  display: flex;
  flex-direction: column;
  padding: 0 4px 2px;
}
.lt-group-body {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 2px;
}
.lt-group-body--col {
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 1px;
}
.lt-group-label {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.38);
  text-align: center;
  padding-top: 2px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  margin-top: 2px;
}

.lt-sep {
  width: 1px;
  background: rgba(var(--v-border-color), var(--v-border-opacity));
  margin: 2px 3px 4px;
  align-self: stretch;
}

.lt-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px 10px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: none;
  cursor: pointer;
  font-size: 11px;
  line-height: 1.3;
  color: rgb(var(--v-theme-on-surface));
  text-align: center;
  transition: background 0.15s;
  min-width: 56px;
}
.lt-btn:hover:not(:disabled) {
  background: rgba(var(--v-theme-on-surface), 0.08);
  border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}
.lt-btn:disabled { opacity: 0.38; cursor: default; }
.lt-btn--large { min-height: 50px; }
.lt-btn--danger { color: #c62828; }
.v-theme--dark .lt-btn--danger { color: #ef9a9a; }
.lt-btn--sm {
  flex-direction: row;
  gap: 5px;
  padding: 3px 6px;
  min-width: 0;
  justify-content: flex-start;
  white-space: nowrap;
}

/* ── Day tabs ── */
.lt-days {
  display: flex;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  flex-shrink: 0;
  overflow-x: auto;
  background: rgb(var(--v-theme-surface));
}

.lt-day {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 16px;
  border: none;
  border-right: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.5));
  background: none;
  cursor: pointer;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
  transition: background 0.12s, color 0.12s;
}
.lt-day:hover:not(.lt-day--active) { background: rgba(var(--v-theme-on-surface), 0.05); }
.lt-day--active {
  background: rgba(230, 81, 0, 0.08);
  color: #e65100;
  border-bottom: 2px solid #e65100;
  font-weight: 600;
}
.v-theme--dark .lt-day--active {
  background: rgba(255, 183, 77, 0.10);
  color: #ffb74d;
  border-bottom-color: #ffb74d;
}

/* Sábado — destaque especial */
.lt-day--sabado {
  color: #7c3aed;
}
.lt-day--sabado .lt-day-icon { color: #7c3aed !important; }
.v-theme--dark .lt-day--sabado { color: #c4b5fd; }
.v-theme--dark .lt-day--sabado .lt-day-icon { color: #c4b5fd !important; }
.lt-day--sabado.lt-day--active {
  background: rgba(124, 58, 237, 0.08);
  color: #7c3aed;
  border-bottom-color: #7c3aed;
}
.v-theme--dark .lt-day--sabado.lt-day--active {
  background: rgba(196, 181, 253, 0.10);
  color: #c4b5fd;
  border-bottom-color: #c4b5fd;
}

.lt-day-icon { opacity: 0.75; }

/* ── Body ── */
.lt-body { display: flex; flex: 1; overflow: hidden; }

.lt-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* Empty */
.lt-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px;
  color: rgba(var(--v-theme-on-surface), 0.38);
}
.lt-empty-title {
  font-size: 20px;
  font-weight: 500;
  margin: 12px 0 8px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.lt-empty-sub {
  font-size: 13px;
  max-width: 380px;
  line-height: 1.5;
}
.lt-add-center-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 20px;
  padding: 8px 22px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: filter 0.15s;
}
.lt-add-center-btn:hover { filter: brightness(1.1); }

/* Item rows */
.lt-list { flex: 1; }

.lt-item {
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.6));
  cursor: pointer;
  transition: background 0.1s;
  min-height: 40px;
}
.lt-item:hover { background: rgba(var(--v-theme-on-surface), 0.04); }
.lt-item--selected { background: rgba(var(--v-theme-primary), 0.08) !important; }
.lt-item--done .lt-item-name { text-decoration: line-through; opacity: 0.4; }

.lt-item-stripe { width: 4px; align-self: stretch; flex-shrink: 0; }

.lt-item-check {
  margin: 0 8px;
  cursor: pointer;
  flex-shrink: 0;
  accent-color: rgb(var(--v-theme-primary));
}

.lt-item-icon-badge {
  width: 32px;
  height: 32px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 10px;
}

.lt-item-info { flex: 1; overflow: hidden; padding: 5px 4px 5px 0; }
.lt-item-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgb(var(--v-theme-on-surface));
}
.lt-item-sub  { font-size: 11px; color: rgba(var(--v-theme-on-surface), 0.45); }
.lt-item-dur  { font-size: 11px; color: rgba(var(--v-theme-on-surface), 0.45); padding: 0 8px; white-space: nowrap; }
.lt-item-lock { opacity: 0.4; margin-right: 4px; }

.lt-item-actions {
  display: flex;
  align-items: center;
  gap: 1px;
  padding-right: 6px;
  flex-shrink: 0;
}
.lt-row-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(var(--v-theme-on-surface), 0.5);
  transition: background 0.1s, color 0.1s;
}
.lt-row-btn:hover:not(:disabled) {
  background: rgba(var(--v-theme-on-surface), 0.08);
  color: rgb(var(--v-theme-on-surface));
}
.lt-row-btn:disabled { opacity: 0.25; cursor: default; }
.lt-row-btn--del  { color: #e53935; }
.v-theme--dark .lt-row-btn--del { color: #ef9a9a; }

/* MusicMenuTable dentro do item da liturgia — mesmo estilo do álbum */
.lt-item-music-menu { display: flex; align-items: center; }
.lt-item-music-menu :deep(.v-btn) { color: rgba(var(--v-theme-on-surface), 0.6) !important; }
.lt-item-music-menu :deep(.v-btn:hover) { color: rgb(var(--v-theme-on-surface)) !important; }

/* ── Notes panel ── */
.lt-notes {
  width: 220px;
  border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: rgba(var(--v-theme-on-surface), 0.02);
}

.lt-notes-head {
  display: flex;
  align-items: center;
  padding: 7px 10px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  font-size: 12px;
  font-weight: 600;
  gap: 4px;
  flex-shrink: 0;
  color: rgb(var(--v-theme-on-surface));
}
.lt-notes-day {
  margin-left: auto;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: rgba(var(--v-theme-on-surface), 0.38);
}

.lt-notes-area {
  flex: 1;
  width: 100%;
  padding: 8px;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  min-height: 0;
  color: rgb(var(--v-theme-on-surface));
}

/* Font bar */
.lt-notes-bar {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 5px 6px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgba(var(--v-theme-on-surface), 0.04);
  flex-shrink: 0;
}

.lt-notes-bar-row { display: flex; align-items: center; gap: 2px; }

.lt-ns {
  font-size: 11px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 2px;
  padding: 1px 3px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}
.lt-ns-font { max-width: 100px; }
.lt-ns-size { width: 42px; }

.lt-fb {
  min-width: 22px;
  height: 20px;
  padding: 0 3px;
  border: 1px solid transparent;
  border-radius: 2px;
  font-size: 11px;
  cursor: pointer;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(var(--v-theme-on-surface), 0.6);
  transition: background 0.1s;
}
.lt-fb:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
  border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}
.lt-fb--on {
  background: rgba(var(--v-theme-primary), 0.15);
  border-color: rgba(var(--v-theme-primary), 0.4);
  color: rgb(var(--v-theme-primary));
}
.lt-fb-swatch {
  width: 14px;
  height: 10px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 1px;
}

.lt-vbar {
  width: 1px;
  height: 14px;
  background: rgba(var(--v-border-color), var(--v-border-opacity));
  margin: 0 2px;
}

.lt-status {
  padding: 5px 10px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.38);
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* ── Dialog form ── */
/*
 * O v-dialog teleporta para fora de .lt-root. Aqui os vars do Vuetify
 * (--v-theme-surface etc.) já funcionam pois o Vuetify injeta o tema
 * no wrapper do overlay, então rgb(var(--v-theme-*)) funciona aqui também.
 */
.lt-form-row { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
.lt-form-field { display: flex; flex-direction: column; gap: 4px; }
.lt-form-field--grow { flex: 1; min-width: 0; }

.lt-label {
  font-size: 11px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.v-theme--dark .lt-label { color: rgba(var(--v-theme-on-surface), 0.7); }


.lt-input {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  color: rgb(var(--v-theme-on-surface));
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.lt-input:focus { border-color: rgb(var(--v-theme-primary)); }
.lt-input--sm   { width: 70px; }
.lt-input--full { width: 100%; display: block; }
.lt-input[readonly] { opacity: 0.6; cursor: default; }
.v-theme--dark .lt-input { background: rgba(255,255,255,0.07); }

.lt-color-swatch {
  width: 36px;
  height: 36px;
  border: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  cursor: pointer;
  display: block;
  transition: border-color 0.15s, transform 0.1s;
}
.lt-color-swatch:hover { border-color: rgba(var(--v-theme-primary), 0.8); transform: scale(1.05); }

.lt-section-lbl {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.5);
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding-bottom: 5px;
  margin: 16px 0 8px;
}

.lt-textarea {
  width: 100%;
  min-height: 90px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
  display: block;
  background: rgba(var(--v-theme-on-surface), 0.05);
  color: rgb(var(--v-theme-on-surface));
  transition: border-color 0.15s;
}
.lt-textarea:focus { border-color: rgb(var(--v-theme-primary)); }
.v-theme--dark .lt-textarea { background: rgba(255,255,255,0.07); }

.lt-music-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  background: rgba(var(--v-theme-on-surface), 0.03);
}

.lt-music-row {
  padding: 7px 10px;
  cursor: pointer;
  border-bottom: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.5));
  transition: background 0.1s;
}
.lt-music-row:hover { background: rgba(var(--v-theme-on-surface), 0.06); }
.lt-music-row--sel  { background: rgba(var(--v-theme-primary), 0.10); }

.lt-music-name { font-size: 13px; color: rgb(var(--v-theme-on-surface)); }
.lt-music-sub  { font-size: 11px; color: rgba(var(--v-theme-on-surface), 0.5); }
.lt-music-empty {
  padding: 16px;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.38);
  font-size: 12px;
}
</style>
