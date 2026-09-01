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

      <!-- ── DAY TABS ───────────────────────────────────────────── -->
      <div class="lt-days">
        <button
          v-for="day in DAYS"
          :key="day.key"
          :class="[
            'lt-day',
            {
              'lt-day--active':  currentDay === day.key,
              'lt-day--sabado':  day.key === 'sabado',
              'lt-day--domingo': day.key === 'domingo',
              'lt-day--quarta':  day.key === 'quarta',
            },
          ]"
          @click="currentDay = day.key"
        >
          <v-icon size="14">{{ day.key === 'sabado' ? 'mdi-calendar-star' : 'mdi-calendar-outline' }}</v-icon>
          {{ day.label }}
        </button>

        <span class="lt-days-sep" />

        <button
          :class="['lt-day', 'lt-day--avulsa', { 'lt-day--active': currentDay === 'avulsa' }]"
          @click="currentDay = 'avulsa'"
        >
          <v-icon size="14">mdi-star-outline</v-icon>
          Avulsa
        </button>
      </div>

      <!-- ── TOOLBAR ────────────────────────────────────────────── -->
      <div class="lt-toolbar">
        <div class="lt-toolbar-title">{{ currentTabLabel }}</div>
        <div class="lt-toolbar-actions">
          <button class="lt-btn-outline" @click="importJaFile">
            <v-icon size="15">mdi-file-import-outline</v-icon> Importar
          </button>
          <button class="lt-btn-outline" @click="exportJaFile">
            <v-icon size="15">mdi-file-export-outline</v-icon> Exportar
          </button>
          <button class="lt-btn-outline" @click="openSaveLiturgia">
            <v-icon size="15">mdi-content-save-outline</v-icon> Salvar
          </button>
          <button class="lt-btn-outline" @click="openLoadLiturgia">
            <v-icon size="15">mdi-folder-open-outline</v-icon> Carregar
          </button>
          <button class="lt-btn-outline lt-btn-outline--danger" :disabled="!dayItems.length" @click="confirmClearAll">
            <v-icon size="15">mdi-delete-sweep-outline</v-icon> Limpar Dia
          </button>
          <button class="lt-btn-primary" @click="openAdd">
            <v-icon size="16">mdi-plus</v-icon> Adicionar Item
          </button>

          <span class="lt-toolbar-sep" />

          <button class="lt-btn-icon" title="Marcar/Desmarcar Todos" @click="toggleSelectAll">
            <v-icon size="18">mdi-checkbox-multiple-marked-outline</v-icon>
          </button>
          <button class="lt-btn-icon" title="Desmarcar Todos" @click="deselectAll">
            <v-icon size="18">mdi-checkbox-multiple-blank-outline</v-icon>
          </button>
          <button class="lt-btn-icon" title="Inverter Seleção" @click="invertSel">
            <v-icon size="18">mdi-select-inverse</v-icon>
          </button>
          <button class="lt-btn-icon" title="Marcar como Concluído" :disabled="!hasSelected" @click="markDone">
            <v-icon size="18">mdi-check-circle-outline</v-icon>
          </button>
          <button class="lt-btn-icon" title="Bloquear Itens" :disabled="!hasSelected" @click="toggleLock">
            <v-icon size="18">mdi-lock-outline</v-icon>
          </button>
          <button class="lt-btn-icon" title="Apagar Selecionados" :disabled="!hasSelected" @click="deleteSelected">
            <v-icon size="18">mdi-close</v-icon>
          </button>
          <button class="lt-btn-icon" title="Copiar p/ Outros Dias" :disabled="!hasSelected" @click="openCopyToDays()">
            <v-icon size="18">mdi-content-copy</v-icon>
          </button>
        </div>
      </div>

      <!-- ── BODY ───────────────────────────────────────────────── -->
      <div class="lt-body">

        <!-- Content: items list or empty state -->
        <div
          class="lt-content"
          :class="{ 'lt-content--dragover': listDragOver }"
          @dragover.prevent="listDragOver = true"
          @dragleave.self="listDragOver = false"
          @drop.prevent="onDropFiles($event)"
        >
          <!-- Empty state -->
          <div v-if="dayItems.length === 0" class="lt-empty">
            <v-icon size="60" color="grey-lighten-1">mdi-script-text-outline</v-icon>
            <div class="lt-empty-title">Liturgia vazia</div>
            <div class="lt-empty-sub">
              Adicione músicas, anotações, mídias e categorias para montar seu culto,
              ou arraste qualquer arquivo até aqui.
            </div>
          </div>

          <!-- Items list -->
          <draggable
            v-else
            v-model="dayItems"
            item-key="id"
            handle=".lt-drag-handle"
            class="lt-list"
            :animation="150"
          >
            <template v-slot:item="{ element: item, index: idx }">
              <div
                :class="['lt-item', {
                  'lt-item--selected': item.selected,
                  'lt-item--done':     isItemDone(item),
                  'lt-item--locked':   item.locked,
                  'lt-item--categoria': item.type === 'categoria',
                }]"
                :style="{
                  border: `2px solid ${item.color}`,
                  background: item.type === 'categoria' ? item.color : undefined,
                  '--lt-cat-fg': item.type === 'categoria' ? categoriaContrastColor(item.color) : undefined,
                }"
                @click="onItemRowClick(item, idx)"
              >

                <button v-if="item.type !== 'categoria'" class="lt-status-btn" @click.stop="toggleDone(idx)">
                  <v-icon size="18" :color="item.done ? 'success' : undefined" :class="{ 'lt-status-off': !item.done }">
                    {{ item.done ? 'mdi-check-circle' : 'mdi-circle-outline' }}
                  </v-icon>
                </button>

                <div
                  class="lt-item-icon-badge"
                  :style="item.type === 'categoria'
                    ? { background: categoriaContrastColor(item.color) + '22', color: categoriaContrastColor(item.color) }
                    : { background: item.color + '22', color: item.color }"
                >
                  <v-icon size="15" :color="item.type === 'categoria' ? categoriaContrastColor(item.color) : item.color">{{ itemIcon(item) }}</v-icon>
                </div>
                <div class="lt-item-info">
                  <div :class="['lt-item-name', { 'lt-item-name--categoria': item.type === 'categoria' }]">{{ item.name }}</div>
                  <div v-if="item.type !== 'categoria'" class="lt-item-sub">{{ itemTypeLabel(item) }}</div>
                </div>
                <div class="lt-item-dur" v-if="item.duration">{{ formatDur(item.duration) }}</div>
                <v-icon v-if="item.locked" size="13" class="lt-item-lock">mdi-lock</v-icon>
                <div class="lt-item-actions" @click.stop>
                  <!-- Categoria: inicia o cronômetro dessa seção (com base na
                       Duração configurada no item) e marca a categoria como
                       concluída — marcação só desta sessão, ver isItemDone(). -->
                  <button
                    v-if="item.type === 'categoria'"
                    class="lt-row-btn"
                    :title="activeTimer && activeTimer.itemId === item.id ? 'Reiniciar Cronômetro' : 'Iniciar'"
                    @click="startCategoryTimer(item)"
                  >
                    <v-icon size="15">{{ activeTimer && activeTimer.itemId === item.id ? 'mdi-timer-sand' : 'mdi-play-circle-outline' }}</v-icon>
                  </button>
                  <!-- Link do YouTube: controles de reprodução (play/pause/parar,
                       com fade — ver $webLink/WebLinkFrame.vue) iguais aos do
                       video_player, em vez do botão de play genérico abaixo. -->
                  <template v-if="item.type === 'link' && item.url && $webLink.isYoutube(item.url)">
                    <button
                      class="lt-row-btn lt-row-btn--play"
                      :title="isYoutubeItemPlaying(item) ? 'Pausar' : 'Reproduzir'"
                      @click="toggleYoutubeItem(item, idx)"
                    >
                      <v-icon size="17">{{ isYoutubeItemPlaying(item) ? 'mdi-pause-circle-outline' : 'mdi-play-circle-outline' }}</v-icon>
                    </button>
                    <button
                      v-if="isYoutubeItemActive(item)"
                      class="lt-row-btn"
                      title="Encerrar"
                      @click="$webLink.stop()"
                    >
                      <v-icon size="15">mdi-stop-circle-outline</v-icon>
                    </button>
                  </template>
                  <!-- Música (coletânea/hinário) já tem seus próprios controles no
                       MusicMenuTable (cantado/instrumental/letra) — o botão de play
                       genérico aqui seria redundante. -->
                  <button
                    v-else-if="isPlayable(item) && item.type !== 'musica'"
                    class="lt-row-btn lt-row-btn--play"
                    @click="playItem(item, idx)"
                  >
                    <v-icon size="17">mdi-play-circle-outline</v-icon>
                  </button>
                  <MusicMenuTable
                    v-if="item.type === 'musica' && item.id_music"
                    :id_music="item.id_music"
                    :has_instrumental_music="item.has_instrumental_music"
                    class="lt-item-music-menu"
                    @action="markItemDone(idx)"
                  />
                  <template v-else-if="item.type === 'musica' && !item.id_music">
                    <button class="lt-row-btn" title="Cantado" @click="openPendingPicker(idx, 'audio')">
                      <v-icon size="15">mdi-play-box-multiple</v-icon>
                    </button>
                    <button class="lt-row-btn" title="Playback" @click="openPendingPicker(idx, 'instrumental')">
                      <v-icon size="15">mdi-play-box-multiple-outline</v-icon>
                    </button>
                    <button class="lt-row-btn" title="Sem Áudio" @click="openPendingPicker(idx, null)">
                      <v-icon size="15">mdi-checkbox-multiple-blank-outline</v-icon>
                    </button>
                    <button class="lt-row-btn" title="Letra" @click="openPendingPicker(idx, 'lyrics')">
                      <v-icon size="15">mdi-text-box-outline</v-icon>
                    </button>
                  </template>
                  <!-- Trocar o arquivo de áudio/vídeo/imagem já anexado — antes só
                       era possível indiretamente, quando o arquivo já não existia
                       mais no disco (ver promptRelinkFile em playItem). Agora fica
                       sempre disponível, mesmo em item já executado (done). -->
                  <button
                    v-if="(item.type === 'midia' || item.type === 'arquivo') && item.url"
                    class="lt-row-btn"
                    title="Trocar arquivo"
                    @click="relinkItemFile(idx)"
                  >
                    <v-icon size="13">mdi-file-replace-outline</v-icon>
                  </button>
                  <button class="lt-row-btn" title="Duplicar item" @click="duplicateItemBelow(idx)">
                    <v-icon size="13">mdi-content-duplicate</v-icon>
                  </button>
                  <button class="lt-row-btn" @click="openEdit(idx)">
                    <v-icon size="13">mdi-pencil</v-icon>
                  </button>
                  <button class="lt-row-btn lt-row-btn--del" @click="removeItem(idx)">
                    <v-icon size="13">mdi-close</v-icon>
                  </button>
                </div>

                <v-icon size="16" class="lt-drag-handle" @click.stop>mdi-drag-vertical</v-icon>
              </div>
            </template>
          </draggable>
        </div>

        <!-- Right panel: Anotações -->
        <div class="lt-notes-resizer" @mousedown="startNotesResize"></div>
        <div class="lt-notes" :style="{ width: (notesDragWidth ?? notesWidth) + 'px' }">
          <div class="lt-notes-head">
            <v-icon size="14" class="me-1">mdi-note-text-outline</v-icon>
            <span>Anotações</span>
            <span class="lt-notes-day">{{ currentTabLabel.toUpperCase() }}</span>
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
              <label class="lt-fb lt-fb--color">
                <div class="lt-fb-swatch" :style="{ background: nColor || 'currentColor' }" />
                <input type="color" :value="nColor || '#ffffff'" class="lt-color-input" @change="nColor = $event.target.value" />
              </label>
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

      <!-- ── BARRA DE CRONÔMETRO DA CATEGORIA ATIVA ────────────────── -->
      <div v-if="activeTimer" class="lt-timer-bar">
        <v-icon size="15" class="me-1">mdi-timer-outline</v-icon>
        <span class="lt-timer-name">{{ activeTimer.name }}</span>
        <span class="lt-timer-time" :class="{ 'lt-timer-time--over': activeTimerOver }">{{ activeTimerLabel }}</span>
        <v-spacer />
        <button class="lt-btn-icon" title="Parar Cronômetro" @click="stopCategoryTimer">
          <v-icon size="16">mdi-stop-circle-outline</v-icon>
        </button>
      </div>
    </div>

    <!-- ── ADD/EDIT ITEM DIALOG ──────────────────────────────────── -->
    <v-dialog v-model="addDialog" max-width="560" scrollable @after-leave="resetForm">
      <v-card>
        <v-card-title v-if="dialogStep === 'type'" class="d-flex align-center pa-3 text-body-1 font-weight-medium">
          <v-icon start size="16">mdi-plus</v-icon>
          Adicionar Item
          <v-spacer />
          <v-btn icon size="small" variant="text" @click="addDialog = false">
            <v-icon size="16">mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-title v-else class="d-flex align-center pa-3 text-body-1 font-weight-medium">
          <v-btn v-if="dialogMode === 'add'" icon size="small" variant="text" class="me-1" @click="dialogStep = 'type'">
            <v-icon size="18">mdi-arrow-left</v-icon>
          </v-btn>
          <v-icon start size="18">{{ currentTypeConfig?.icon }}</v-icon>
          {{ dialogMode === 'edit' ? 'Editar Item' : `Adicionar Item: ${currentTypeConfig?.title}` }}
          <v-spacer />
          <v-btn icon size="small" variant="text" @click="addDialog = false">
            <v-icon size="16">mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider />

        <!-- STEP 1: escolha do tipo -->
        <v-card-text v-if="dialogStep === 'type'" class="pa-4">
          <div class="lt-type-list">
            <div v-for="tp in TYPES" :key="tp.value" class="lt-type-row" @click="chooseType(tp.value)">
              <div class="lt-type-icon" :style="{ background: tp.color + '22', color: tp.color }">
                <v-icon size="20">{{ tp.icon }}</v-icon>
              </div>
              <div class="lt-type-info">
                <div class="lt-type-title">{{ tp.title }}</div>
                <div class="lt-type-desc">{{ tp.desc }}</div>
              </div>
              <v-icon size="18" class="lt-type-chevron">mdi-chevron-right</v-icon>
            </div>
          </div>
        </v-card-text>

        <!-- STEP 2: formulário do tipo -->
        <v-card-text v-else class="pa-4">
          <form @submit.prevent="submitForm">
          <!-- Linha 1: Nome -->
          <div class="lt-form-row">
            <div class="lt-form-field lt-form-field--grow">
              <label class="lt-label">Nome do Item:</label>
              <input
                v-model="form.name"
                class="lt-input"
                :placeholder="form.type === 'musica' ? (form.chooseLater ? 'Música (nome opcional)' : 'Selecione uma música abaixo...') : 'Ex.: Boas-vindas, Oração inicial, Oferta...'"
                :readonly="form.type === 'musica' && !form.chooseLater"
              />
            </div>
          </div>

          <!-- Linha 2: Cor + Duração -->
          <div class="lt-form-row" style="margin-top:10px; align-items:flex-end">
            <div class="lt-form-field">
              <label class="lt-label">Cor:</label>
              <label class="lt-color-swatch" :style="{ background: form.color }">
                <input type="color" v-model="form.color" class="lt-color-input" />
              </label>
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

          <!-- Categoria: sem campos extras -->

          <!-- Música -->
          <template v-else-if="form.type === 'musica'">
            <div class="lt-section-lbl">MÚSICA</div>
            <label class="lt-checkbox-row">
              <input type="checkbox" v-model="form.chooseLater" />
              A música será escolhida na hora
            </label>
            <template v-if="!form.chooseLater">
              <input ref="musicSearchInput" v-model="musicSearch" class="lt-input lt-input--full" placeholder="Buscar música..." style="margin-bottom:8px" />
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
          </template>

          <!-- Versículo -->
          <template v-else-if="form.type === 'versiculo'">
            <template v-if="dialogMode === 'add'">
              <div class="lt-section-lbl">VERSÍCULO</div>
              <div class="lt-form-row">
                <div class="lt-form-field">
                  <label class="lt-label">Versão:</label>
                  <v-select
                    v-model="versicle.id_bible_version"
                    :items="vsVersionItems"
                    density="compact"
                    variant="outlined"
                    hide-details
                    style="min-width: 160px"
                  />
                </div>
                <div class="lt-form-field lt-form-field--grow">
                  <label class="lt-label">Livro:</label>
                  <v-select
                    v-model="versicle.id_bible_book"
                    :items="vsBookItems"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                </div>
              </div>
              <div class="lt-form-row" style="margin-top:10px">
                <div class="lt-form-field">
                  <label class="lt-label">Capítulo:</label>
                  <v-select
                    v-model="versicle.chapter"
                    :items="vsChaptersList"
                    density="compact"
                    variant="outlined"
                    hide-details
                    style="min-width: 100px"
                  />
                </div>
                <div class="lt-form-field lt-form-field--grow">
                  <label class="lt-label">Versículos:</label>
                  <v-select
                    v-model="versicle.verses"
                    :items="vsVersesList"
                    multiple
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                </div>
              </div>
              <div v-if="vsText" class="lt-verse-preview">{{ vsText }}</div>
            </template>
            <template v-else>
              <div class="lt-section-lbl">TEXTO DO VERSÍCULO</div>
              <label class="lt-label">Texto:</label>
              <textarea v-model="form.text" class="lt-textarea" placeholder="Texto do versículo..." />
            </template>
          </template>

          <!-- Mídia — inclui 'arquivo' (áudio local, tipo derivado de resolvedType()
               ao salvar/trocar arquivo, nunca escolhido diretamente no step 1):
               sem esse ramo cobrir 'arquivo' também, editar um item de áudio já
               existente não mostrava nenhum campo de arquivo (área em branco). -->
          <template v-else-if="form.type === 'midia' || form.type === 'arquivo'">
            <div class="lt-section-lbl">MÍDIA (QUALQUER ARQUIVO)</div>
            <label class="lt-label">Arquivo local:</label>
            <div class="lt-file-row">
              <input ref="mediaUrlInput" :value="form.url" class="lt-input" readonly placeholder="Nenhum arquivo selecionado" />
              <button type="button" class="lt-btn-outline" @click="pickMediaFile">
                <v-icon size="15">mdi-magnify</v-icon> Selecionar
              </button>
            </div>

            <template v-if="videoPlaylist.length">
              <div class="lt-section-lbl" style="margin-top:14px">OU ESCOLHER DA FILA DO VÍDEO/IMAGEM</div>
              <div class="lt-music-list">
                <div
                  v-for="v in videoPlaylist" :key="v.id"
                  :class="['lt-music-row', { 'lt-music-row--sel': form.url === v.path }]"
                  @click="pickFromVideoPlaylist(v)"
                >
                  <div class="lt-music-name">{{ v.name }}</div>
                  <div class="lt-music-sub">{{ v.duration ? formatDur(Math.round(v.duration / 60)) : '' }}</div>
                </div>
              </div>
            </template>
          </template>

          <!-- Link -->
          <template v-else-if="form.type === 'link'">
            <div class="lt-section-lbl">LINK</div>
            <label class="lt-label">URL:</label>
            <input v-model="form.url" class="lt-input lt-input--full" placeholder="https://..." />
          </template>

          <!-- Botão de submit invisível: com múltiplos campos de texto, o
               Enter só dispara o submit do <form> nativo se ele tiver um
               botão de submit — o botão visível real fica em v-card-actions,
               fora do <form>, então esse aqui só existe pra habilitar o Enter. -->
          <button type="submit" style="display:none" aria-hidden="true" />
          </form>
        </v-card-text>

        <v-divider />
        <v-card-actions class="pa-3">
          <v-spacer />
          <v-btn variant="text" @click="addDialog = false">Cancelar</v-btn>
          <v-btn
            v-if="dialogStep === 'form'"
            color="primary"
            :prepend-icon="dialogMode === 'edit' ? 'mdi-content-save' : 'mdi-plus'"
            :disabled="!canAdd"
            @click="submitForm"
          >
            {{ dialogMode === 'edit' ? 'Salvar' : 'Adicionar item' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ── ESCOLHER MÚSICA (item "escolhida na hora") ────────────────────── -->
    <v-dialog v-model="pickMusicDialog" max-width="480" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center pa-3 text-body-1 font-weight-medium">
          <v-icon start size="18">mdi-music-note</v-icon>
          Escolher música
          <v-spacer />
          <v-btn icon size="small" variant="text" @click="pickMusicDialog = false">
            <v-icon size="16">mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <input v-model="pickMusicSearch" class="lt-input lt-input--full" placeholder="Buscar música..." style="margin-bottom:8px" autofocus />
          <div class="lt-music-list">
            <div v-if="musicLoading" class="d-flex justify-center pa-4">
              <v-progress-circular indeterminate size="24" color="primary" />
            </div>
            <template v-else>
              <div
                v-for="m in pickMusicFiltered"
                :key="m.id_music"
                class="lt-music-row"
                @click="resolvePendingMusic(m)"
              >
                <div class="lt-music-name">{{ m.name }}</div>
                <div class="lt-music-sub">{{ m.albums_names }}</div>
              </div>
              <div v-if="!pickMusicFiltered.length" class="lt-music-empty">Nenhuma música encontrada</div>
            </template>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- ── CONFIRMAR LIMPAR TUDO ─────────────────────────────────────────── -->
    <v-dialog v-model="clearAllDialog" max-width="380" content-class="lt-confirm-dialog">
      <v-card class="lt-confirm-card">
        <div class="lt-confirm-header">
          <span>Limpar Dia</span>
          <v-btn icon="mdi-close" size="small" variant="text" density="comfortable" color="white" @click="clearAllDialog = false" />
        </div>
        <div class="lt-confirm-body">
          <div class="lt-confirm-warning">
            <v-avatar size="40" color="error" variant="tonal" class="flex-shrink-0">
              <v-icon size="20">mdi-alert-circle-outline</v-icon>
            </v-avatar>
            <div class="lt-confirm-title">Apagar todos os itens de {{ currentTabLabel }}?</div>
          </div>
          <div class="lt-confirm-sub">
            Só os itens deste dia são apagados — os outros dias e as liturgias salvas não são afetados.
            Essa ação não pode ser desfeita.
          </div>
          <div class="lt-confirm-actions">
            <button class="lt-confirm-link" @click="clearAllDialog = false">
              <v-icon size="16">mdi-close</v-icon> Cancelar
            </button>
            <button class="lt-confirm-link lt-confirm-link--danger" @click="doClearAll">
              <v-icon size="16">mdi-delete-sweep-outline</v-icon> Apagar Itens do Dia
            </button>
          </div>
        </div>
      </v-card>
    </v-dialog>

    <!-- ── COPIAR ITENS PARA OUTROS DIAS ──────────────────────────────────── -->
    <v-dialog v-model="copyDaysDialog" max-width="380">
      <v-card>
        <v-card-title class="d-flex align-center pa-3 text-body-1 font-weight-medium">
          <v-icon start size="16">mdi-content-copy</v-icon>
          Copiar Itens para Outros Dias
          <v-spacer />
          <v-btn icon size="small" variant="text" @click="copyDaysDialog = false">
            <v-icon size="16">mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <div class="lt-copy-hint">
            Selecione os dias para colar {{ copyClipboard.length }} item(ns) copiado(s) de {{ currentTabLabel }}:
          </div>
          <div class="lt-copy-days">
            <label v-for="day in copyDaysOptions" :key="day.key" class="lt-copy-day-row">
              <input
                type="checkbox"
                :checked="copyDaysTargets.includes(day.key)"
                @change="toggleCopyTarget(day.key)"
              />
              {{ day.label }}
            </label>
          </div>
          <label class="lt-copy-overwrite">
            <input type="checkbox" v-model="copyDaysOverwrite" />
            Sobrescrever todo o conteúdo dos dias selecionados
          </label>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-3">
          <v-spacer />
          <v-btn variant="text" @click="copyDaysDialog = false">Cancelar</v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-content-copy"
            :disabled="!copyDaysTargets.length"
            @click="confirmCopyToDays"
          >
            Copiar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ── SALVAR LITURGIA ──────────────────────────────────────────────── -->
    <v-dialog v-model="saveLiturgiaDialog" max-width="380">
      <v-card>
        <v-card-title class="d-flex align-center pa-3 text-body-1 font-weight-medium">
          <v-icon start size="16">mdi-content-save-outline</v-icon>
          Salvar Liturgia
          <v-spacer />
          <v-btn icon size="small" variant="text" @click="saveLiturgiaDialog = false">
            <v-icon size="16">mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <v-text-field
            v-model="saveLiturgiaName"
            label="Nome da liturgia salva"
            density="comfortable"
            variant="outlined"
            autofocus
            @keyup.enter="confirmSaveLiturgia"
          />
          <div class="lt-copy-days">
            <label class="lt-copy-day-row">
              <input type="radio" value="dia" v-model="saveLiturgiaScope" />
              Somente {{ currentTabLabel }} (este dia)
            </label>
            <label class="lt-copy-day-row">
              <input type="radio" value="completa" v-model="saveLiturgiaScope" />
              Liturgia completa (todos os dias)
            </label>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-3">
          <v-spacer />
          <v-btn variant="text" @click="saveLiturgiaDialog = false">Cancelar</v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-content-save-outline"
            :disabled="!saveLiturgiaName.trim()"
            @click="confirmSaveLiturgia"
          >
            Salvar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ── CARREGAR / GERENCIAR LITURGIAS SALVAS ───────────────────────────── -->
    <v-dialog v-model="loadLiturgiaDialog" max-width="460">
      <v-card>
        <v-card-title class="d-flex align-center pa-3 text-body-1 font-weight-medium">
          <v-icon start size="16">mdi-folder-open-outline</v-icon>
          Liturgias Salvas
          <v-spacer />
          <v-btn icon size="small" variant="text" @click="loadLiturgiaDialog = false">
            <v-icon size="16">mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-0">
          <div v-if="!savedLiturgiasSorted.length" class="lt-saved-empty">
            Nenhuma liturgia salva ainda.
          </div>
          <div v-else class="lt-saved-list">
            <div v-for="s in savedLiturgiasSorted" :key="s.id" class="lt-saved-row">
              <div class="lt-saved-info">
                <div class="lt-saved-name">{{ s.name }}</div>
                <div class="lt-saved-meta">
                  {{ s.scope === 'dia' ? `Dia: ${s.dayLabel}` : 'Liturgia completa' }} · {{ formatSavedDate(s.savedAt) }}
                </div>
              </div>
              <template v-if="loadLiturgiaConfirmId === s.id">
                <span class="lt-saved-confirm-label">Sobrescrever?</span>
                <v-btn size="small" variant="text" @click="cancelLoadLiturgia">Cancelar</v-btn>
                <v-btn size="small" color="primary" @click="applyLoadLiturgia(s.id)">Confirmar</v-btn>
              </template>
              <template v-else>
                <v-btn icon size="small" variant="text" title="Carregar" @click="askLoadLiturgia(s.id)">
                  <v-icon size="18">mdi-tray-arrow-down</v-icon>
                </v-btn>
                <v-btn icon size="small" variant="text" color="error" title="Excluir" @click="deleteSavedLiturgia(s.id)">
                  <v-icon size="18">mdi-delete-outline</v-icon>
                </v-btn>
              </template>
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-3">
          <v-spacer />
          <v-btn variant="text" @click="loadLiturgiaDialog = false">Fechar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </Window>
</template>

<script>
import manifest from '../manifest.json';
import Window from '@/components/Window.vue';
import MusicMenuTable from '@/components/MusicMenuTable.vue';
import Draggable from 'vuedraggable';

const DAYS = [
  { key: 'domingo', label: 'Domingo' },
  { key: 'segunda', label: 'Segunda' },
  { key: 'terca',   label: 'Terça'   },
  { key: 'quarta',  label: 'Quarta'  },
  { key: 'quinta',  label: 'Quinta'  },
  { key: 'sexta',   label: 'Sexta'   },
  { key: 'sabado',  label: 'Sábado'  },
];

// Date.prototype.getDay() já retorna 0=domingo...6=sábado — mesma ordem do
// array DAYS acima, então o índice bate direto, sem precisar de mapa.
const todayDayKey = () => DAYS[new Date().getDay()].key;

// Todas as "abas" de dia que existem na liturgia, incluindo a avulsa —
// usado ao salvar/carregar a liturgia completa (todos os dias de uma vez).
const ALL_DAY_KEYS = [...DAYS.map(d => d.key), 'avulsa'];

// Data local (não UTC, pra não pular de dia perto da meia-noite) no formato
// AAAA-MM-DD — usada só pra saber se hoje já foi sincronizado, não pra exibir.
const todayDateStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const FONTS = ['Tahoma', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48];

const TYPES = [
  { value: 'anotacao',  title: 'Anotação',  desc: 'Texto livre sem ação (ex: Oração, Doxologia)',  icon: 'mdi-text-long',                      color: '#42a5f5' },
  { value: 'categoria', title: 'Categoria', desc: 'Separador visual de seção',                      icon: 'mdi-tag-outline',                    color: '#fb8c00' },
  { value: 'musica',    title: 'Música',    desc: 'Selecione uma música do Hinário ou Coletânea',   icon: 'mdi-music-note',                     color: '#43a047' },
  { value: 'midia',     title: 'Mídia',     desc: 'Selecione qualquer arquivo (vídeo, imagem, áudio ou outro)', icon: 'mdi-file-video-outline', color: '#fb8c00' },
  { value: 'link',      title: 'Link',      desc: 'Adicione uma URL para projetar em tela cheia (Canva, YouTube, etc.)', icon: 'mdi-link-variant', color: '#26a69a' },
];

const TYPE_LABEL = {
  anotacao:  'Anotação',
  categoria: 'Categoria',
  musica:    'Música',
  versiculo: 'Versículo',
  midia:     'Mídia',
  link:      'Link',
  // legado — itens salvos antes do redesign do módulo
  arquivo:   'Arquivo/Diretório',
  site:      'Site',
  agendados: 'Itens Agendados',
};

const TYPE_ICON = {
  anotacao:  'mdi-text-long',
  categoria: 'mdi-tag-outline',
  musica:    'mdi-music-note',
  versiculo: 'mdi-book-open-page-variant-outline',
  midia:     'mdi-file-video-outline',
  link:      'mdi-link-variant',
  arquivo:   'mdi-folder-outline',
  site:      'mdi-web',
  agendados: 'mdi-calendar-check-outline',
};

let _idSeq = 0;
function newId() {
  _idSeq += 1;
  return `${Date.now()}_${_idSeq}`;
}

// Mapa de dia da semana do formato legado .ja (TDate.DayOfWeek do Delphi:
// domingo=1 ... sábado=7) para as chaves de dia usadas neste módulo.
const JA_DAY_MAP = { '1': 'domingo', '2': 'segunda', '3': 'terca', '4': 'quarta', '5': 'quinta', '6': 'sexta', '7': 'sabado' };

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']);
function isAudioFile(path) {
  const ext = (path || '').split('.').pop()?.toLowerCase();
  return AUDIO_EXTENSIONS.has(ext);
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']);
function isImageFile(path) {
  const ext = (path || '').split('.').pop()?.toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv']);
function isVideoFile(path) {
  const ext = (path || '').split('.').pop()?.toLowerCase();
  return VIDEO_EXTENSIONS.has(ext);
}

const POWERPOINT_EXTENSIONS = new Set(['ppt', 'pptx']);
function isPowerPointFile(path) {
  const ext = (path || '').split('.').pop()?.toLowerCase();
  return POWERPOINT_EXTENSIONS.has(ext);
}

function isPdfFile(path) {
  return (path || '').split('.').pop()?.toLowerCase() === 'pdf';
}

// Parser do formato .ja (INI legado do LouvorJA Delphi): seções [item_<id>]
// com os campos do item, e uma seção [Geral] cujas chaves numéricas (1-7)
// listam, em ordem e separados por ";", os ids dos itens de cada dia.
function parseJaSections(raw) {
  const sections = {};
  let current = null;
  // Remove BOM do início do arquivo — "﻿" (BOM real) ou "ï»¿"
  // (bytes do BOM UTF-8 decodificados como latin1, já que o .ja é lido nessa
  // codificação para os acentos). Sem isso a 1ª linha "[Geral]" não bate no
  // regex de seção e o arquivo inteiro é ignorado (0 itens importados).
  raw = raw.replace(/^﻿/, '').replace(/^ï»¿/, '');
  raw.split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (!line) return;
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      current = sectionMatch[1];
      sections[current] = {};
      return;
    }
    if (!current) return;
    const eq = line.indexOf('=');
    if (eq < 0) return;
    sections[current][line.slice(0, eq).trim()] = line.slice(eq + 1);
  });
  return sections;
}

// TColor do Delphi serializado como "$00BBGGRR" — converte para "#rrggbb".
function delphiColorToHex(raw) {
  if (!raw) return null;
  const hex = raw.replace('$', '').padStart(8, '0').slice(-8);
  const bb = hex.slice(2, 4);
  const gg = hex.slice(4, 6);
  const rr = hex.slice(6, 8);
  if (![bb, gg, rr].every(h => /^[0-9a-fA-F]{2}$/.test(h))) return null;
  return `#${rr}${gg}${bb}`.toLowerCase();
}

// O app Delphi grava "subitem" como o texto exibido na listbox, que já vem
// prefixado com o rótulo do tipo (ex.: "Música <título>", "Arquivo <caminho>")
// em vez do valor puro — por isso não dá para usar "subitem" como nome direto
// para "musica" (resolvemos pelo id na base atual) nem para "arquivo" (usamos
// o nome do arquivo a partir de "dir", que tem o mesmo caminho sem o prefixo).
function jaSectionToItem(sec, musicsById, stats) {
  if (!sec) return null;
  const type = (sec.tipo || '').trim() || 'anotacao';
  let name = (sec.subitem || sec.item || '').trim();
  let duration = 0;
  let id_music = null;
  let has_instrumental_music = false;

  if (type === 'musica') {
    // "escolha=1" (subtipo=escolha, musica=-1) = música ainda não escolhida no
    // Delphi — nesse caso "subitem" é só o texto de dica ("Clique para
    // escolher a música"), não o nome do item; o nome real está em "item".
    // id_music deve ficar null (e não -1), senão o botão de escolher música
    // some da lista (o template usa "!item.id_music" pra decidir se mostra).
    const pending = sec.escolha === '1' || sec.subtipo === 'escolha';
    if (pending) {
      name = (sec.item || '').trim() || name;
      id_music = null;
    } else {
      id_music = sec.musica ? Number(sec.musica) : null;
      const found = id_music != null ? musicsById?.get(id_music) : null;
      if (found) {
        name = found.name;
        duration = found.duration ? Math.ceil(Number(found.duration) / 60) : 0;
        has_instrumental_music = !!found.has_instrumental_music;
      } else if (id_music != null && stats) {
        stats.unresolvedMusic += 1;
      }
    }
  } else if (type === 'arquivo' && sec.dir) {
    const base = sec.dir.split(/[\\/]/).pop() || sec.dir;
    name = base.replace(/\.[^./\\]+$/, '') || base;
  }

  return {
    id: newId(),
    type,
    name,
    color: delphiColorToHex(sec.cor) || '#1a237e',
    duration,
    text: '',
    url: type === 'arquivo' ? (sec.dir || '') : '',
    id_music,
    has_instrumental_music,
    selected: false,
    done: !!(sec.checked && sec.checked.trim()),
    locked: false,
  };
}

// Converte o conteúdo bruto de um arquivo .ja em { byDay: {[dayKey]: item[]}, stats }.
// musicsById (Map<number, music>) permite resolver o nome/duração reais da
// música atual em vez do texto legado salvo no arquivo.
function parseJaLiturgia(raw, musicsById) {
  const sections = parseJaSections(raw);
  const geral = sections['Geral'];
  const stats = { unresolvedMusic: 0 };
  if (!geral) return { byDay: {}, stats };

  const byDay = {};
  Object.keys(geral).forEach(key => {
    if (!/^\d+$/.test(key)) return; // ignora chaves como "AlteraOrdem-2"
    const dayKey = JA_DAY_MAP[key];
    if (!dayKey) return;
    const ids = geral[key].split(';').map(s => s.trim()).filter(Boolean);
    const items = ids.map(id => jaSectionToItem(sections[id], musicsById, stats)).filter(Boolean);
    if (items.length) byDay[dayKey] = [...(byDay[dayKey] || []), ...items];
  });
  return { byDay, stats };
}

// Inverso de delphiColorToHex — "#rrggbb" vira "$00BBGGRR" (TColor do Delphi).
function hexToDelphiColor(hex) {
  const h = (hex || '#1a237e').replace('#', '').padStart(6, '0');
  const rr = h.slice(0, 2), gg = h.slice(2, 4), bb = h.slice(4, 6);
  return `$00${bb}${gg}${rr}`.toUpperCase();
}

function pad2(v) { return String(v).padStart(2, '0'); }
function jaDateTime(d) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} `
    + `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function jaDate(d) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Converte um item deste app para as chaves de uma seção [item_<id>] no
// formato .ja — inverso de jaSectionToItem, para reabrir no Delphi ou nesta
// própria tela sem perder o que faz sentido nesse formato (cor, escolha,
// música vinculada, concluído, arquivo/diretório).
function itemToJaLines(item) {
  const lines = { tipo: item.type, item: item.name || '', cor: hexToDelphiColor(item.color) };

  if (item.type === 'musica') {
    const pending = item.id_music == null;
    lines.escolha = pending ? '1' : '0';
    lines.musica  = pending ? '-1' : String(item.id_music);
    lines.subtipo = pending ? 'escolha' : 'ja';
    lines.subitem = pending ? 'Clique para escolher a música' : `Música ${item.name || ''}`;
  } else if (item.url) {
    lines.subtipo = 'arq';
    lines.subitem = `Arquivo ${item.url}`;
    lines.dir = item.url;
    lines.dir_info = 'E';
  }

  lines.checked = item.done ? jaDate(new Date()) : '';
  return lines;
}

// Monta o conteúdo bruto de um arquivo .ja a partir de { [dayKey]: item[] }
// (mesma forma que parseJaLiturgia retorna em byDay) — todos os dias que
// tiverem itens entram no mesmo arquivo, exatamente como o Delphi salva.
// "avulsa" não existe no formato original (só 7 dias da semana) e é ignorado.
function serializeJaLiturgia(byDayItems) {
  const now = new Date();
  const reverseMap = Object.fromEntries(Object.entries(JA_DAY_MAP).map(([n, key]) => [key, n]));
  const geralLines = [];
  const itemSections = [];

  Object.keys(byDayItems).forEach(dayKey => {
    const dayNum = reverseMap[dayKey];
    const items = byDayItems[dayKey];
    if (!dayNum || !items?.length) return;

    const ids = items.map(item => `item_${item.id}`);
    geralLines.push(`${dayNum}=${ids.join(';')};`);
    geralLines.push(`AlteraOrdem-${dayNum}=${jaDateTime(now)}`);

    items.forEach(item => {
      const lines = itemToJaLines(item);
      itemSections.push(
        `[item_${item.id}]\n` + Object.entries(lines).map(([k, v]) => `${k}=${v}`).join('\n'),
      );
    });
  });

  return `[Geral]\n${geralLines.join('\n')}\n\n${itemSections.join('\n\n')}\n`;
}

function emptyForm() {
  return { type: '', name: '', color: '#1a237e', duration: 0, text: '', url: '', id_music: null, has_instrumental_music: false, chooseLater: false };
}

function emptyVersicle() {
  return { id_bible_version: null, id_bible_book: null, chapter: null, verses: [] };
}

export default {
  name: 'LiturgiaModule',
  components: { Window, MusicMenuTable, Draggable },

  data: () => ({
    DAYS,
    FONTS,
    SIZES,
    TYPES,

    addDialog:     false,
    dialogMode:    'add',   // 'add' | 'edit'
    dialogStep:    'type',  // 'type' | 'form'
    editingIndex:  null,
    clearAllDialog: false,
    listDragOver:  false,
    notesDragWidth: null,

    // Cronômetro de categoria + marcação "concluído" transitória — não
    // persistidos em $userdata de propósito: devem voltar ao normal se a
    // liturgia for fechada e reaberta, mesmo no mesmo dia.
    sessionDone:    {},
    activeTimer:    null,   // { itemId, name, budgetMin, startedAt }
    timerNow:       Date.now(),
    timerInterval:  null,
    copyDaysDialog:    false,
    copyDaysTargets:   [],
    copyDaysOverwrite: false,
    copyClipboard:     [],

    saveLiturgiaDialog:  false,
    saveLiturgiaName:    '',
    saveLiturgiaScope:   'dia',
    loadLiturgiaDialog:  false,
    loadLiturgiaConfirmId: null,
    form:          emptyForm(),
    musicSearch:   '',
    musicLoading:  false,
    allMusics:     [],

    pickMusicDialog: false,
    pickMusicIndex:  null,
    pickMusicMode:   null,
    pickMusicSearch: '',

    versicle:    emptyVersicle(),
    vsVersions:  [],
    vsBooks:     [],
    vsVerseMap:  {},
    vsLoading:   false,

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
    currentTabLabel() { return this.currentDay === 'avulsa' ? 'Avulsa' : this.currentDayLabel; },

    dayItems: {
      get() { return this.$userdata.get(`modules.liturgia.days.${this.currentDay}.items`) || []; },
      set(v) { this.$userdata.set(`modules.liturgia.days.${this.currentDay}.items`, v); },
    },
    dayNotes: {
      get() { return this.$userdata.get(`modules.liturgia.days.${this.currentDay}.notes`) || ''; },
      set(v) { this.$userdata.set(`modules.liturgia.days.${this.currentDay}.notes`, v); },
    },
    notesWidth: {
      get() { return this.$userdata.get('modules.liturgia.notesWidth', 240); },
      set(v) { this.$userdata.set('modules.liturgia.notesWidth', Math.min(480, Math.max(180, v))); },
    },

    hasSelected() { return this.dayItems.some(i => i.selected); },
    copyDaysOptions() {
      return [...DAYS, { key: 'avulsa', label: 'Avulsa' }].filter(d => d.key !== this.currentDay);
    },

    savedLiturgias: {
      get() { return this.$userdata.get('modules.liturgia.saved') || []; },
      set(v) { this.$userdata.set('modules.liturgia.saved', v); },
    },
    savedLiturgiasSorted() {
      return [...this.savedLiturgias].sort((a, b) => b.savedAt - a.savedAt);
    },

    totalTime() {
      return this.dayItems.reduce((s, i) => s + (Number(i.duration) || 0), 0);
    },
    totalTimeLabel() {
      const m = this.totalTime;
      if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}min`;
      return `${m}min`;
    },

    activeTimerElapsedSec() {
      if (!this.activeTimer) return 0;
      return Math.floor((this.timerNow - this.activeTimer.startedAt) / 1000);
    },
    activeTimerOver() {
      if (!this.activeTimer || !this.activeTimer.budgetMin) return false;
      return this.activeTimerElapsedSec >= this.activeTimer.budgetMin * 60;
    },
    activeTimerLabel() {
      if (!this.activeTimer) return '';
      const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      const budgetSec = this.activeTimer.budgetMin * 60;
      return budgetSec > 0 ? `${fmt(this.activeTimerElapsedSec)} / ${fmt(budgetSec)}` : fmt(this.activeTimerElapsedSec);
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

    pickMusicFiltered() {
      const q = this.$string.clean(this.pickMusicSearch.trim());
      if (!q) return this.allMusics.slice(0, 60);
      return this.allMusics
        .filter(m => (m._nc || '').includes(q) || (m._ac || '').includes(q))
        .slice(0, 60);
    },

    currentTypeConfig() {
      // 'arquivo' é tipo derivado (nunca escolhido no step 1 — ver TYPES), então
      // não tem entrada própria; usa o ícone/cor de 'midia' (mesmo formulário,
      // ver template do form) em vez de deixar o cabeçalho do diálogo em branco.
      const key = this.form.type === 'arquivo' ? 'midia' : this.form.type;
      return this.TYPES.find(t => t.value === key);
    },

    canAdd() {
      if (this.form.type === 'musica') return this.form.chooseLater || !!this.form.id_music;
      if (this.form.type === 'versiculo' && this.dialogMode === 'add') return this.versicle.verses.length > 0;
      return !!this.form.name.trim();
    },

    // Fila do módulo Vídeo — permite escolher um vídeo já adicionado lá em
    // vez de procurar o arquivo local de novo.
    videoPlaylist() { return this.$videoPlayer.getPlaylist(); },

    /* ── versículo ── */
    vsBook()    { return this.vsBooks.find(b => b.id_bible_book === this.versicle.id_bible_book); },
    vsVersion() { return this.vsVersions.find(v => v.id_bible_version === this.versicle.id_bible_version); },

    vsVersionItems() {
      return this.vsVersions.map(v => ({ title: `${v.abbreviation} - ${v.name}`, value: v.id_bible_version }));
    },
    vsBookItems() {
      return this.vsBooks.map(b => ({ title: b.name, value: b.id_bible_book }));
    },
    vsChaptersList() {
      if (!this.vsBook) return [];
      return Array.from({ length: this.vsBook.chapters }, (_, i) => ({ title: String(i + 1), value: i + 1 }));
    },
    vsVersesList() {
      return Object.keys(this.vsVerseMap)
        .map(n => ({ title: n, value: +n }))
        .sort((a, b) => a.value - b.value);
    },
    vsReference() {
      if (!this.vsBook || !this.versicle.chapter) return '';
      const interval = this.numbersInterval([...this.versicle.verses]);
      const abbrev = this.vsVersion ? ` (${this.vsVersion.abbreviation})` : '';
      return `${this.vsBook.name} ${this.versicle.chapter}${interval ? `:${interval}` : ''}${abbrev}`;
    },
    vsText() {
      return [...this.versicle.verses]
        .sort((a, b) => a - b)
        .map(n => this.vsVerseMap[n])
        .filter(Boolean)
        .join(' ');
    },
  },

  watch: {
    // Ao abrir o painel, pula pra aba do dia da semana correspondente a hoje
    // — mas só na PRIMEIRA vez no dia (ver _syncDayIfNewDay): depois disso,
    // clicar manualmente em outra aba tem que "pegar" e continuar valendo em
    // reaberturas seguintes (minimizar/restaurar, etc.), sem ser puxado de
    // volta pra hoje toda vez que o painel reabre.
    'module.show'(show) {
      if (show) this._syncDayIfNewDay();
    },
    addDialog(v) {
      if (v && !this.allMusics.length) this.loadMusics();
    },
    'versicle.id_bible_version'() { this.versicle.verses = []; this.loadVerses(); },
    'versicle.id_bible_book'()    { this.versicle.chapter = 1; this.versicle.verses = []; this.loadVerses(); },
    'versicle.chapter'()          { this.versicle.verses = []; this.loadVerses(); },
    vsReference(v) {
      if (this.dialogMode === 'add' && this.form.type === 'versiculo') this.form.name = v;
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
    // Limpa a seleção (checkbox) de itens em TODOS os dias — usada ao fechar
    // de vez a janela (não ao minimizar, ver comentário em close() abaixo) e
    // também ao encerrar o app (ver App.vue). "selected" é só uma marcação
    // transitória pras ações em lote da toolbar (Concluir/Bloquear/Apagar/
    // Copiar), não faz sentido continuar marcado na próxima vez que a
    // liturgia for aberta.
    clearAllSelections() {
      const days = this.$userdata.get('modules.liturgia.days') || {};
      for (const key of Object.keys(days)) {
        const items = days[key]?.items;
        if (!Array.isArray(items) || !items.some(i => i.selected)) continue;
        this.$userdata.set(
          `modules.liturgia.days.${key}.items`,
          items.map(i => (i.selected ? { ...i, selected: false } : i)),
        );
      }
    },
    // Só a janela fechando de vez (botão fechar) — minimizar não passa por
    // aqui (ver @minimize="$modules.minimize(...)" no template), então a
    // seleção sobrevive normalmente a um minimizar/restaurar.
    close() {
      this.clearAllSelections();
      this.stopCategoryTimer();
      this.sessionDone = {};
      this.$modules.close(this.module_id);
    },

    typeLabel(t) { return TYPE_LABEL[t] || t; },
    typeIcon(t)  { return TYPE_ICON[t]  || 'mdi-circle-outline'; },
    // "midia" cobre vídeo e imagem, e "arquivo" cobre áudio local (toca no
    // SoundMaster) — distingue o ícone/rótulo pela extensão do arquivo, sem
    // precisar de um tipo de item separado para cada mídia.
    itemIcon(item) {
      if (item.type === 'midia' && isImageFile(item.url)) return 'mdi-image-outline';
      if (item.type === 'midia' && isPdfFile(item.url)) return 'mdi-file-pdf-box';
      if (item.type === 'arquivo' && isAudioFile(item.url)) return 'mdi-music-note';
      if (item.type === 'arquivo' && isPowerPointFile(item.url)) return 'mdi-microsoft-powerpoint';
      return this.typeIcon(item.type);
    },
    itemTypeLabel(item) {
      if (item.type === 'musica' && !item.id_music) return 'Clique para escolher a música';
      if (item.type === 'midia' && isImageFile(item.url)) return 'Imagem';
      if (item.type === 'midia' && isPdfFile(item.url)) return 'PDF';
      if (item.type === 'arquivo' && isAudioFile(item.url)) return 'Áudio';
      if (item.type === 'arquivo' && isPowerPointFile(item.url)) return 'Apresentação (PowerPoint)';
      return this.typeLabel(item.type);
    },
    formatDur(m) {
      return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}min` : ''}` : `${m}min`;
    },
    startNotesResize(e) {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = this.notesWidth;
      this.notesDragWidth = startWidth;
      const onMove = (ev) => {
        this.notesDragWidth = Math.min(480, Math.max(180, startWidth - (ev.clientX - startX)));
      };
      const onUp = () => {
        this.notesWidth = this.notesDragWidth;
        this.notesDragWidth = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    categoriaContrastColor(hex) {
      const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || '');
      if (!m) return '#ffffff';
      const full = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
      const r = parseInt(full.substring(0, 2), 16);
      const g = parseInt(full.substring(2, 4), 16);
      const b = parseInt(full.substring(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.55 ? '#000000' : '#ffffff';
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
      // A linha da lista é um <div> (não focável) — clicar nela tira o foco
      // do campo de busca, e sem nenhum campo focado o Enter não dispara o
      // submit nativo do <form>. Devolve o foco pro campo pra Enter confirmar.
      this.$nextTick(() => this.$refs.musicSearchInput?.focus());
    },

    /* ── música "escolhida na hora" ── */
    openPendingPicker(idx, mode) {
      this.pickMusicIndex = idx;
      this.pickMusicMode = mode;
      this.pickMusicSearch = '';
      if (!this.allMusics.length) this.loadMusics();
      this.pickMusicDialog = true;
    },
    resolvePendingMusic(m) {
      const l = [...this.dayItems];
      const item = l[this.pickMusicIndex];
      // Não grava id_music/duração no item: "escolhida na hora" é um slot
      // reaproveitado (ex.: liturgia semanal), não uma música fixa — assim que
      // executada, o item volta a ficar pendente (item.id_music == null) e os
      // botões de escolher música reaparecem, prontos pra próxima vez.
      l[this.pickMusicIndex] = {
        ...item,
        done: true,
      };
      this.dayItems = l;
      this.pickMusicDialog = false;
      this.runMusicAction(m.id_music, this.pickMusicMode);
    },
    runMusicAction(id_music, mode) {
      if (mode === 'audio') this.$media.open({ id_music, mode: 'audio' });
      else if (mode === 'instrumental') this.$media.open({ id_music, mode: 'instrumental' });
      else if (mode === 'lyrics') this.$media.openLyric(id_music);
      else this.$media.open(id_music);
    },

    /* ── bíblia / versículo ── */
    async loadBibleMeta() {
      if (this.vsVersions.length && this.vsBooks.length) return;
      this.vsLoading = true;
      try {
        const locale = this.$i18n?.locale?.value || this.$i18n?.locale || 'pt';
        this.vsVersions = (await this.$database.get(`${locale}_bible_version`)) || [];
        this.vsBooks = (await this.$database.get(`${locale}_bible_book`)) || [];
        if (!this.versicle.id_bible_version && this.vsVersions[0]) this.versicle.id_bible_version = this.vsVersions[0].id_bible_version;
        if (!this.versicle.id_bible_book && this.vsBooks[0]) this.versicle.id_bible_book = this.vsBooks[0].id_bible_book;
        if (!this.versicle.chapter) this.versicle.chapter = 1;
      } catch (_) {
        this.vsVersions = [];
        this.vsBooks = [];
      } finally {
        this.vsLoading = false;
      }
    },
    async loadVerses() {
      if (!this.versicle.id_bible_version || !this.versicle.id_bible_book || !this.versicle.chapter) {
        this.vsVerseMap = {};
        return;
      }
      this.vsLoading = true;
      try {
        this.vsVerseMap = (await this.$database.get(
          `bible_${this.versicle.id_bible_version}_${this.versicle.id_bible_book}_${this.versicle.chapter}`
        )) || {};
      } catch (_) {
        this.vsVerseMap = {};
      } finally {
        this.vsLoading = false;
      }
    },
    numbersInterval(numbers) {
      if (!numbers || numbers.length === 0) return '';
      numbers.sort((a, b) => a - b);
      const result = [];
      let start = numbers[0];
      let end = numbers[0];
      for (let i = 1; i <= numbers.length; i++) {
        if (numbers[i] === end + 1) {
          end = numbers[i];
        } else {
          result.push(start === end ? `${start}` : `${start}-${end}`);
          start = numbers[i];
          end = numbers[i];
        }
      }
      return result.join(', ');
    },

    /* ── mídia ── */
    async pickMediaFile() {
      const fp = await this.$electron.selectFile({
        title: 'Selecionar arquivo',
        filters: [
          {
            name: 'Vídeo, Imagem, PDF, PowerPoint ou Áudio',
            extensions: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'pdf', 'ppt', 'pptx', 'mp3', 'wav', 'flac', 'm4a', 'aac'],
          },
          { name: 'Vídeo', extensions: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'] },
          { name: 'Imagem', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
          { name: 'PDF', extensions: ['pdf'] },
          { name: 'PowerPoint', extensions: ['ppt', 'pptx'] },
          { name: 'Áudio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'] },
          { name: 'Todos os arquivos', extensions: ['*'] },
        ],
      });
      if (fp) {
        this.form.url = fp;
        this.form.type = this.resolvedType('midia', fp);
        if (!this.form.name.trim()) {
          this.form.name = fp.split(/[\\/]/).pop() || '';
        }
      }
      // O botão "Selecionar" continua focado depois que o diálogo nativo
      // fecha — e qualquer <button> focado dispara seu próprio clique ao
      // apertar Enter (reabrindo o seletor), independente de type="button".
      // Devolve o foco pro campo de arquivo pra Enter adicionar o item.
      this.$nextTick(() => this.$refs.mediaUrlInput?.focus());
      return fp;
    },
    pickFromVideoPlaylist(v) {
      this.form.url = v.path;
      this.form.name = v.name;
      if (v.duration) this.form.duration = Math.round(v.duration / 60);
    },

    /* ── dialog add/edit ── */
    openAdd() {
      this.dialogMode = 'add';
      this.editingIndex = null;
      this.dialogStep = 'type';
      this.addDialog = true;
    },
    openEdit(idx) {
      const item = this.dayItems[idx];
      this.dialogMode = 'edit';
      this.editingIndex = idx;
      this.form = {
        type: item.type,
        name: item.name,
        color: item.color || '#1a237e',
        duration: item.duration || 0,
        text: item.text || '',
        url: item.url || '',
        id_music: item.id_music || null,
        has_instrumental_music: !!item.has_instrumental_music,
        chooseLater: item.type === 'musica' && !item.id_music,
      };
      this.musicSearch = item.type === 'musica' ? item.name : '';
      this.dialogStep = 'form';
      this.addDialog = true;
    },
    // "Mídia" já abre o seletor de arquivo direto (em vez de mostrar o
    // formulário vazio primeiro, esperando o clique em "Selecionar") — o
    // nome do item só aparece pra edição DEPOIS que o arquivo é escolhido
    // (pickMediaFile já preenche form.name com o nome do arquivo). Se o
    // operador cancelar o seletor, volta pra escolha de tipo em vez de
    // entrar num formulário sem arquivo nenhum.
    async chooseType(value) {
      this.form.type = value;
      if (value === 'midia') {
        const fp = await this.pickMediaFile();
        if (!fp) { this.form.type = ''; return; }
        this.dialogStep = 'form';
        return;
      }
      this.dialogStep = 'form';
      if (value === 'musica' && !this.allMusics.length) this.loadMusics();
      if (value === 'versiculo') this.loadBibleMeta();
    },
    resetForm() {
      this.form = emptyForm();
      this.musicSearch = '';
      this.dialogMode = 'add';
      this.dialogStep = 'type';
      this.editingIndex = null;
      this.versicle = emptyVersicle();
      this.vsVerseMap = {};
    },

    // Enter em qualquer campo de texto do formulário (steps de add/editar item)
    // dispara o submit do <form> nativo, que cai aqui — mesma ação do botão
    // "Adicionar item"/"Salvar", sem precisar clicar.
    submitForm() {
      if (!this.canAdd) return;
      if (this.dialogMode === 'edit') this.confirmEdit();
      else this.confirmAdd();
    },

    confirmAdd() {
      if (!this.canAdd) return;
      const { type, name, color, duration, text, url, id_music, has_instrumental_music, chooseLater } = this.form;
      const finalText = type === 'versiculo' ? this.vsText : text;
      const finalName = name.trim() || (type === 'musica' && chooseLater ? 'Música' : '');
      this.dayItems = [...this.dayItems, {
        id:                    Date.now(),
        type:                  this.resolvedType(type, url),
        name:                  finalName,
        color:                 color || '#1a237e',
        duration:              Number(duration) || 0,
        text:                  finalText || '',
        url:                   url  || '',
        id_music:              id_music || null,
        has_instrumental_music: !!has_instrumental_music,
        selected:              false,
        done:                  false,
        locked:                false,
      }];
      this.addDialog = false;
    },
    confirmEdit() {
      if (!this.canAdd || this.editingIndex === null) return;
      const { type, name, color, duration, text, url, id_music, has_instrumental_music, chooseLater } = this.form;
      const finalName = name.trim() || (type === 'musica' && chooseLater ? 'Música' : '');
      const l = [...this.dayItems];
      l[this.editingIndex] = {
        ...l[this.editingIndex],
        type:                  this.resolvedType(type, url),
        name:                  finalName,
        color:                 color || '#1a237e',
        duration:              Number(duration) || 0,
        text:                  text || '',
        url:                   url  || '',
        id_music:              id_music || null,
        has_instrumental_music: !!has_instrumental_music,
      };
      this.dayItems = l;
      this.addDialog = false;
    },

    /* ── item row ── */
    removeItem(idx) {
      const l = [...this.dayItems]; l.splice(idx, 1); this.dayItems = l;
    },
    duplicateItemBelow(idx) {
      const l = [...this.dayItems];
      l.splice(idx + 1, 0, { ...l[idx], id: newId(), selected: false });
      this.dayItems = l;
    },
    toggleSelect(idx) {
      const l = [...this.dayItems];
      l[idx] = { ...l[idx], selected: !l[idx].selected };
      this.dayItems = l;
    },
    // Para mídia de áudio/vídeo, a linha inteira reproduz o item (a seleção
    // continua acessível pelo checkbox do badge, que já tem @click.stop).
    // Para os demais tipos, o clique na linha continua selecionando.
    onItemRowClick(item, idx) {
      if ((item.type === 'midia' || item.type === 'arquivo') && this.isPlayable(item)) {
        this.playItem(item, idx);
      } else {
        this.toggleSelect(idx);
      }
    },
    toggleDone(idx) {
      if (this.dayItems[idx]?.type === 'categoria') return;
      const l = [...this.dayItems];
      l[idx] = { ...l[idx], done: !l[idx].done };
      this.dayItems = l;
    },
    markItemDone(idx) {
      if (this.dayItems[idx]?.done) return;
      const l = [...this.dayItems];
      l[idx] = { ...l[idx], done: true };
      this.dayItems = l;
    },
    // "arquivo" (tipo legado "Arquivo/Diretório", vindo de liturgias .ja
    // importadas) não fica restrito a extensões de áudio reconhecidas: sem
    // isso, um item cujo caminho não existe mais nesta máquina (ex.: liturgia
    // exportada de outro computador) nem chega a acionar a checagem de
    // "arquivo não encontrado" em playItem() — a linha simplesmente não tinha
    // botão de play nem reagia ao clique.
    isPlayable(item) {
      return (item.type === 'musica' && !!item.id_music)
        || (item.type === 'midia' && !!item.url)
        || (item.type === 'link' && !!item.url)
        || (item.type === 'arquivo' && !!item.url);
    },
    // O tipo "midia" só faz sentido para vídeo/imagem (toca no video_player);
    // qualquer outro arquivo (áudio, ou qualquer outro tipo) vira "arquivo" —
    // áudio toca no SoundMaster, os demais ficam como referência na lista
    // (sem botão de play). Mesma regra usada no drag-and-drop (onDropFiles),
    // aplicada também ao arquivo escolhido pelo botão "Selecionar".
    // Bidirecional: além de rebaixar 'midia' pra 'arquivo' quando o arquivo
    // escolhido não é imagem/vídeo (comportamento original), também promove
    // 'arquivo' pra 'midia' quando o novo arquivo (trocado via relinkItemFile
    // ou editando o item — ver template do form mais abaixo) É imagem/vídeo.
    // Sem isso, trocar o arquivo de um item de áudio por um vídeo mantinha
    // type:'arquivo' e playItem() tentava tocar o vídeo no SoundMaster.
    resolvedType(type, url) {
      if (type !== 'midia' && type !== 'arquivo') return type;
      return (isImageFile(url) || isVideoFile(url) || isPdfFile(url)) ? 'midia' : 'arquivo';
    },
    // "midia"/"arquivo" guardam um caminho absoluto do disco — ao importar uma
    // liturgia (.ja) exportada de outro computador, esse caminho quase sempre
    // não existe na máquina atual. Confere antes de tentar tocar e, se não
    // achar, oferece atualizar o local do arquivo em vez de falhar em silêncio.
    async playItem(item, idx) {
      if ((item.type === 'midia' || item.type === 'arquivo') && item.url && this.$electron.isElectron()) {
        const exists = await this.$electron.fileExists(item.url);
        if (!exists) {
          this.promptRelinkFile(item, idx);
          return;
        }
      }
      if (item.type === 'musica') this.$media.open({ id_music: item.id_music, mode: 'audio' });
      else if (item.type === 'midia' && item.url) this.$videoPlayer.open(item.url, item.name, { addToPlaylist: false });
      // Projeta em tela cheia na janela de saída (Canva, YouTube, qualquer
      // link) em vez de abrir no navegador externo do Windows.
      else if (item.type === 'link' && item.url) this.$webLink.open(item.url);
      // PowerPoint não é projetado (ao contrário de vídeo/imagem/PDF) — abre
      // direto no PowerPoint/aplicativo nativo instalado no computador, igual
      // a dar duplo-clique no arquivo pelo Explorer (shell.openPath cuida de
      // achar o programa certo). Precisa vir ANTES do ramo genérico de
      // "arquivo" abaixo, senão tentaria tocar o .pptx como áudio no
      // SoundMaster.
      else if (item.type === 'arquivo' && item.url && isPowerPointFile(item.url)) this.$electron.shellOpenFolder(item.url);
      else if (item.type === 'arquivo' && item.url) this.$soundMaster.play(item.url, item.name);
      if (idx != null) this.markItemDone(idx);
    },

    // Mesmo padrão de modal usado em Media.js (alerts.not_loaded_offline) pra
    // arquivo de música não encontrado no dispositivo — aqui pro arquivo/mídia
    // local da Liturgia, com a ação de atualizar o caminho em vez de baixar.
    promptRelinkFile(item, idx) {
      this.$alert.show(
        {
          title: 'Arquivo não encontrado',
          text: `"${item.name}" não foi encontrado neste computador. Isso costuma acontecer ao importar uma liturgia exportada de outro computador. Deseja atualizar o local do arquivo?`,
          color: 'warning',
          translate: false,
          buttons: [
            { text: 'Cancelar', color: 'grey', value: 'cancel' },
            { text: 'Atualizar arquivo', color: 'primary', value: 'update' },
          ],
        },
        (val) => {
          if (val === 'update') this.relinkItemFile(idx);
        },
      );
    },

    // Reabre o seletor de arquivo pra apontar o item pro caminho correto nesta
    // máquina — só substitui o caminho, sem tocar em seguida (evita executar
    // um arquivo sem o operador ter escolhido isso; pra tocar, ele clica no
    // item normalmente depois).
    async relinkItemFile(idx) {
      const item = this.dayItems[idx];
      if (!item) return;
      const fp = await this.$electron.selectFile({
        title: 'Selecionar arquivo',
        filters: [
          {
            name: 'Vídeo, Imagem, PDF, PowerPoint ou Áudio',
            extensions: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'pdf', 'ppt', 'pptx', 'mp3', 'wav', 'flac', 'm4a', 'aac'],
          },
          { name: 'Todos os arquivos', extensions: ['*'] },
        ],
      });
      if (!fp) return;
      const l = [...this.dayItems];
      l[idx] = { ...l[idx], url: fp, type: this.resolvedType('midia', fp) };
      this.dayItems = l;
    },

    // Este item do YouTube é o que está ativo agora na projeção (mesmo vídeo
    // já aberto, tocando ou pausado) — controla se o botão "Encerrar"
    // aparece e se o ícone de play mostra o estado de pausa.
    isYoutubeItemActive(item) {
      const id = this.$webLink.extractVideoId(item.url);
      return !!id && id === (this.$appdata.get('modules.web_link.config.videoId') || null);
    },
    isYoutubeItemPlaying(item) {
      return this.isYoutubeItemActive(item) && !!this.$appdata.get('modules.web_link.config.isPlaying');
    },
    // Clique único: abre o vídeo (se ainda não for o ativo) ou alterna
    // play/pause do mesmo vídeo já projetado — igual ao video_player.
    toggleYoutubeItem(item, idx) {
      if (this.isYoutubeItemActive(item)) this.$webLink.togglePlay();
      else this.$webLink.open(item.url);
      if (idx != null) this.markItemDone(idx);
    },

    /* ── toolbar ── */
    // Categorias (separadores) agora contam como itens normais pra seleção —
    // sem isso, "Copiar p/ Outros Dias" nunca incluía os separadores, e uma
    // liturgia colada em outro dia vinha sem nenhuma seção organizada.
    toggleSelectAll() {
      const allSelected = this.dayItems.length > 0 && this.dayItems.every(i => i.selected);
      this.dayItems = this.dayItems.map(i => ({ ...i, selected: !allSelected }));
    },
    deselectAll()    { this.dayItems = this.dayItems.map(i => ({ ...i, selected: false })); },
    invertSel()      { this.dayItems = this.dayItems.map(i => ({ ...i, selected: !i.selected })); },
    deleteSelected() { this.dayItems = this.dayItems.filter(i => !i.selected); },
    markDone()       { this.dayItems = this.dayItems.map(i => i.selected && i.type !== 'categoria' ? { ...i, done: !i.done } : i); },
    toggleLock()     { this.dayItems = this.dayItems.map(i => i.selected ? { ...i, locked: !i.locked } : i); },

    /* ── cronômetro de categoria (transitório, ver sessionDone acima) ── */
    isItemDone(item) {
      return item.type === 'categoria' ? !!this.sessionDone[item.id] : item.done;
    },
    startCategoryTimer(item) {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.sessionDone = { ...this.sessionDone, [item.id]: true };
      this.timerNow = Date.now();
      this.activeTimer = { itemId: item.id, name: item.name, budgetMin: Number(item.duration) || 0, startedAt: this.timerNow };
      this.timerInterval = setInterval(() => { this.timerNow = Date.now(); }, 1000);
    },
    stopCategoryTimer() {
      if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
      this.activeTimer = null;
    },

    confirmClearAll() {
      if (!this.dayItems.length) return;
      this.clearAllDialog = true;
    },
    doClearAll() {
      this.dayItems = [];
      this.clearAllDialog = false;
    },

    /* ── importar arquivo .ja (formato legado do LouvorJA Delphi) ── */
    async importJaFile() {
      const fp = await this.$electron.selectFile({
        title: 'Importar Liturgia (.ja)',
        filters: [{ name: 'Liturgia (.ja)', extensions: ['ja'] }],
      });
      if (!fp) return;

      let raw = null;
      try {
        // O arquivo .ja é salvo pelo app antigo normalmente em Windows-1252,
        // mas alguns aparecem em UTF-8 (com ou sem BOM) — 'auto' detecta a
        // codificação real em vez de assumir sempre latin1 (que duplicava a
        // decodificação dos acentos nesses arquivos UTF-8, ex.: "ã" → "Ã£").
        raw = await this.$electron.readFile(fp, 'auto');
      } catch (_) {
        raw = null;
      }
      if (!raw) {
        this.$alert.error({ title: 'Erro ao importar', text: 'Não foi possível ler o arquivo selecionado.' });
        return;
      }

      // Carrega a base de músicas atual para resolver nome/duração reais dos
      // itens tipo "musica" pelo id, em vez do texto legado salvo no arquivo.
      if (!this.allMusics.length) await this.loadMusics();
      const musicsById = new Map(this.allMusics.map(m => [Number(m.id_music), m]));

      const { byDay, stats } = parseJaLiturgia(raw, musicsById);
      const dayKeys = Object.keys(byDay);
      if (!dayKeys.length) {
        this.$alert.error({ title: 'Erro ao importar', text: 'Nenhum item de liturgia foi encontrado nesse arquivo.' });
        return;
      }

      dayKeys.forEach(dayKey => {
        const path = `modules.liturgia.days.${dayKey}.items`;
        const existing = this.$userdata.get(path) || [];
        this.$userdata.set(path, [...existing, ...byDay[dayKey]]);
      });

      this.currentDay = dayKeys[0];

      const total = dayKeys.reduce((sum, k) => sum + byDay[k].length, 0);
      const summary = dayKeys.map(k => `${DAYS.find(d => d.key === k)?.label || k}: ${byDay[k].length}`).join(', ');
      let text = `${total} item(ns) importado(s) — ${summary}.`;
      if (stats.unresolvedMusic > 0) {
        text += ` Atenção: ${stats.unresolvedMusic} música(s) do arquivo não foram encontradas na base atual.`;
      }
      this.$alert.info({ title: 'Importação concluída', text });
    },

    /* ── exportar arquivo .ja (formato legado do LouvorJA Delphi) ── */
    async exportJaFile() {
      // Exporta todos os dias da semana de uma vez, igual ao arquivo original
      // do Delphi — "avulsa" não existe nesse formato (só domingo a sábado).
      const byDayItems = {};
      DAYS.forEach(d => {
        const items = this.$userdata.get(`modules.liturgia.days.${d.key}.items`) || [];
        if (items.length) byDayItems[d.key] = items;
      });

      if (!Object.keys(byDayItems).length) {
        this.$alert.error({ title: 'Erro ao exportar', text: 'Não há itens de liturgia para exportar.' });
        return;
      }

      const fp = await this.$electron.saveDialog({
        title: 'Exportar Liturgia (.ja)',
        defaultPath: 'liturgia.ja',
        filters: [{ name: 'Liturgia (.ja)', extensions: ['ja'] }],
      });
      if (!fp) return;

      const raw = serializeJaLiturgia(byDayItems);
      // Mesma codificação usada pelo Delphi (e pela importação) — grava os
      // acentos do jeito que o programa original espera ao reabrir o arquivo.
      const ok = await this.$electron.writeFile(fp, raw, 'latin1');
      if (!ok) {
        this.$alert.error({ title: 'Erro ao exportar', text: 'Não foi possível salvar o arquivo.' });
        return;
      }

      const total = Object.values(byDayItems).reduce((sum, items) => sum + items.length, 0);
      this.$alert.info({ title: 'Exportação concluída', text: `${total} item(ns) exportado(s) para ${fp}.` });
    },

    /* ── arrastar e soltar arquivo ── */
    // Aceita qualquer tipo de arquivo: só importa (adiciona o item), nunca
    // toca nada automaticamente — quem decide tocar é o operador, clicando no
    // ▶ do item depois. Vídeo/imagem vira "midia" (video_player); qualquer
    // outro arquivo (áudio, PDF, o que for) vira "arquivo" — áudio toca no
    // SoundMaster ao clicar em ▶, os demais ficam só como referência na lista.
    onDropFiles(e) {
      this.listDragOver = false;
      const files = [...(e.dataTransfer?.files || [])];
      if (!files.length) return;
      const newItems = files.map(f => {
        const fp = this.$electron.getPathForFile(f);
        if (!fp) return null;
        const name = f.name.replace(/\.[^./\\]+$/, '') || f.name;
        const visual = isImageFile(fp) || isVideoFile(fp) || isPdfFile(fp);
        return {
          id: newId(),
          type: visual ? 'midia' : 'arquivo',
          name,
          color: visual ? '#fb8c00' : '#26a69a',
          duration: 0,
          text: '',
          url: fp,
          id_music: null,
          has_instrumental_music: false,
          selected: false,
          done: false,
          locked: false,
        };
      }).filter(Boolean);
      if (newItems.length) this.dayItems = [...this.dayItems, ...newItems];
    },

    /* ── copiar itens (selecionados ou um único item da linha) para outros dias ── */
    openCopyToDays(items = null) {
      const sourceItems = items || this.dayItems.filter(i => i.selected);
      if (!sourceItems.length) return;
      this.copyClipboard = sourceItems;
      this.copyDaysTargets = this.copyDaysOptions.map(d => d.key);
      this.copyDaysOverwrite = false;
      this.copyDaysDialog = true;
    },
    toggleCopyTarget(key) {
      const idx = this.copyDaysTargets.indexOf(key);
      if (idx >= 0) this.copyDaysTargets.splice(idx, 1);
      else this.copyDaysTargets.push(key);
    },
    confirmCopyToDays() {
      const sourceItems = this.copyClipboard;
      if (!sourceItems.length || !this.copyDaysTargets.length) { this.copyDaysDialog = false; return; }
      this.copyDaysTargets.forEach(dayKey => {
        const path = `modules.liturgia.days.${dayKey}.items`;
        const existing = this.copyDaysOverwrite ? [] : (this.$userdata.get(path) || []);
        const clones = sourceItems.map(i => ({ ...i, id: newId(), selected: false, done: false }));
        this.$userdata.set(path, [...existing, ...clones]);
      });
      this.copyDaysDialog = false;
    },

    /* ── salvar / carregar / gerenciar liturgias nomeadas ── */
    openSaveLiturgia() {
      this.saveLiturgiaName = '';
      this.saveLiturgiaScope = 'dia';
      this.saveLiturgiaDialog = true;
    },
    confirmSaveLiturgia() {
      const name = this.saveLiturgiaName.trim();
      if (!name) return;
      const entry = {
        id: newId(),
        name,
        scope: this.saveLiturgiaScope,
        dayLabel: this.saveLiturgiaScope === 'dia' ? this.currentTabLabel : null,
        savedAt: Date.now(),
      };
      if (this.saveLiturgiaScope === 'dia') {
        entry.payload = { items: this.dayItems, notes: this.dayNotes };
      } else {
        const days = {};
        ALL_DAY_KEYS.forEach(k => {
          days[k] = {
            items: this.$userdata.get(`modules.liturgia.days.${k}.items`) || [],
            notes: this.$userdata.get(`modules.liturgia.days.${k}.notes`) || '',
          };
        });
        entry.payload = { days };
      }
      this.savedLiturgias = [...this.savedLiturgias, entry];
      this.saveLiturgiaDialog = false;
    },

    openLoadLiturgia() {
      this.loadLiturgiaConfirmId = null;
      this.loadLiturgiaDialog = true;
    },
    askLoadLiturgia(id) { this.loadLiturgiaConfirmId = id; },
    cancelLoadLiturgia() { this.loadLiturgiaConfirmId = null; },
    applyLoadLiturgia(id) {
      const entry = this.savedLiturgias.find(s => s.id === id);
      if (!entry) return;
      if (entry.scope === 'dia') {
        this.dayItems = entry.payload.items;
        this.dayNotes = entry.payload.notes;
      } else {
        Object.entries(entry.payload.days).forEach(([k, v]) => {
          this.$userdata.set(`modules.liturgia.days.${k}.items`, v.items || []);
          this.$userdata.set(`modules.liturgia.days.${k}.notes`, v.notes || '');
        });
      }
      this.loadLiturgiaConfirmId = null;
      this.loadLiturgiaDialog = false;
    },
    deleteSavedLiturgia(id) {
      this.savedLiturgias = this.savedLiturgias.filter(s => s.id !== id);
      if (this.loadLiturgiaConfirmId === id) this.loadLiturgiaConfirmId = null;
    },
    formatSavedDate(ts) {
      return new Date(ts).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    },

    // Sincroniza a aba com o dia da semana de hoje só na primeira vez que o
    // painel abre em cada dia (compara com a última data sincronizada,
    // salva em $userdata) — reaberturas seguintes no MESMO dia preservam
    // qualquer aba escolhida manualmente pelo operador.
    _syncDayIfNewDay() {
      const today = todayDateStr();
      if (this.$userdata.get('modules.liturgia.lastSyncDate', '') === today) return;
      this.$userdata.set('modules.liturgia.lastSyncDate', today);
      this.currentDay = todayDayKey();
    },
  },

  mounted() {
    // Cobre o caso do painel já estar aberto quando o componente monta (ex.:
    // estado restaurado do início do app) — o watch de "module.show" só
    // reage a mudanças depois de montado, não ao valor já vigente.
    if (this.module.show) this._syncDayIfNewDay();
  },

  unmounted() {
    if (this.timerInterval) clearInterval(this.timerInterval);
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

/* ── Day tabs ── */
.lt-days {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  flex-shrink: 0;
  overflow-x: auto;
  background: rgb(var(--v-theme-surface));
}

.lt-day {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: none;
  border-radius: 20px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  cursor: pointer;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
  transition: background 0.12s, color 0.12s;
}
.lt-day:hover:not(.lt-day--active) { background: rgba(var(--v-theme-on-surface), 0.1); }
.lt-day--active {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-weight: 600;
}

/* Sábado — destaque especial */
.lt-day--sabado:not(.lt-day--active) { color: #b8860b; }
.v-theme--dark .lt-day--sabado:not(.lt-day--active) { color: #ffd54f; }
.lt-day--sabado.lt-day--active { background: #d4af37; color: #3a2c00; }
.v-theme--dark .lt-day--sabado.lt-day--active { background: #ffd54f; color: #1a1a2e; }

/* Domingo e Quarta — dias de culto principal, cada um com sua cor própria */
.lt-day--domingo:not(.lt-day--active) { color: #1565c0; }
.v-theme--dark .lt-day--domingo:not(.lt-day--active) { color: #64b5f6; }
.lt-day--domingo.lt-day--active { background: #1565c0; color: #fff; }
.v-theme--dark .lt-day--domingo.lt-day--active { background: #64b5f6; color: #0d1b2a; }

.lt-day--quarta:not(.lt-day--active) { color: #00695c; }
.v-theme--dark .lt-day--quarta:not(.lt-day--active) { color: #4db6ac; }
.lt-day--quarta.lt-day--active { background: #00695c; color: #fff; }
.v-theme--dark .lt-day--quarta.lt-day--active { background: #4db6ac; color: #0a2420; }

.lt-days-sep {
  width: 1px;
  align-self: stretch;
  background: rgba(var(--v-border-color), var(--v-border-opacity));
  margin: 2px 4px;
}
.lt-day--avulsa:not(.lt-day--active) { color: rgba(var(--v-theme-on-surface), 0.5); }

/* ── Toolbar ── */
.lt-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  flex-shrink: 0;
  gap: 10px;
}
.lt-toolbar-title {
  font-size: 16px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
}
.lt-toolbar-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; row-gap: 8px; flex-shrink: 0; justify-content: flex-end; }

.lt-toolbar-sep {
  width: 1px;
  align-self: stretch;
  background: rgba(var(--v-border-color), var(--v-border-opacity));
  margin: 0 2px;
}

.lt-btn-outline, .lt-btn-primary, .lt-btn-icon {
  display: flex;
  align-items: center;
  gap: 5px;
  border-radius: 6px;
  font-size: 12.5px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: filter 0.15s, background 0.15s;
  white-space: nowrap;
}
.lt-btn-outline {
  padding: 6px 12px;
  background: transparent;
  border-color: rgba(var(--v-border-color), var(--v-border-opacity));
  color: rgb(var(--v-theme-on-surface));
}
.lt-btn-outline:hover:not(:disabled) { background: rgba(var(--v-theme-on-surface), 0.06); }
.lt-btn-outline--danger { color: #e53935; border-color: rgba(229, 57, 53, 0.4); }
.v-theme--dark .lt-btn-outline--danger { color: #ef9a9a; border-color: rgba(239, 154, 154, 0.35); }
.lt-btn-outline:disabled, .lt-btn-primary:disabled { opacity: 0.4; cursor: default; }

.lt-btn-primary {
  padding: 6px 14px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.lt-btn-primary:hover:not(:disabled) { filter: brightness(1.08); }

.lt-btn-icon {
  padding: 6px;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.lt-btn-icon:hover:not(:disabled) { background: rgba(var(--v-theme-on-surface), 0.08); }
.lt-btn-icon:disabled { opacity: 0.35; cursor: default; }

/* ── Body ── */
.lt-body { display: flex; flex: 1; overflow: hidden; }

.lt-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  transition: background 0.12s, outline-color 0.12s;
}
.lt-content--dragover {
  outline: 2px dashed rgb(var(--v-theme-primary));
  outline-offset: -2px;
  background: rgba(var(--v-theme-primary), 0.06);
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
/* Item rows */
.lt-list { flex: 1; }

.lt-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: background 0.1s, outline-color 0.1s;
  min-height: 44px;
  margin-bottom: 3px;
  border-radius: 4px;
  box-sizing: border-box;
  outline: 2px solid transparent;
  outline-offset: -1px;
}
.lt-item:hover { background: rgba(var(--v-theme-on-surface), 0.04); }
.lt-item--selected {
  background: rgba(var(--v-theme-primary), 0.16) !important;
  outline-color: rgb(var(--v-theme-primary));
}
.lt-item--done .lt-item-name { text-decoration: line-through; opacity: 0.4; }

.lt-drag-handle {
  cursor: grab;
  opacity: 0.35;
  margin: 0 8px 0 4px;
  flex-shrink: 0;
}
.lt-drag-handle:active { cursor: grabbing; }
.lt-item:hover .lt-drag-handle { opacity: 0.7; }

.lt-status-btn {
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0;
  margin: 0 8px 0 10px;
  flex-shrink: 0;
}
.lt-status-off { color: rgba(var(--v-theme-on-surface), 0.3); }

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
.lt-item-icon-badge:first-child {
  margin-left: 10px;
}

.lt-item-info { flex: 1; overflow: hidden; padding: 5px 4px 5px 0; }
.lt-item-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgb(var(--v-theme-on-surface));
}
.lt-item-name--categoria { text-align: center; font-weight: 700; }

/* Linhas de categoria têm cor de fundo sólida escolhida pelo usuário —
   texto/ícones fixos na cor do tema (on-surface) podem ficar ilegíveis
   contra ela (ex: fundo escuro padrão + tema claro = texto escuro sobre
   escuro). --lt-cat-fg é calculada por categoriaContrastColor() (preto ou
   branco, conforme a luminância da cor escolhida) e sobrepõe as cores fixas
   só nessas linhas. */
.lt-item--categoria .lt-item-name,
.lt-item--categoria .lt-drag-handle {
  color: var(--lt-cat-fg);
}
.lt-item--categoria .lt-row-btn,
.lt-item--categoria .lt-row-btn--del {
  color: var(--lt-cat-fg);
  opacity: 0.75;
}
.lt-item--categoria .lt-row-btn:hover:not(:disabled) {
  color: var(--lt-cat-fg);
  opacity: 1;
  background: rgba(128, 128, 128, 0.25);
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
.lt-row-btn--play { color: rgb(var(--v-theme-primary)); }

/* MusicMenuTable dentro do item da liturgia — mesmo estilo do álbum */
.lt-item-music-menu { display: flex; align-items: center; }
.lt-item-music-menu :deep(.v-btn) { color: rgba(var(--v-theme-on-surface), 0.6) !important; }
.lt-item-music-menu :deep(.v-btn:hover) { color: rgb(var(--v-theme-on-surface)) !important; }

/* ── Notes panel ── */
.lt-notes-resizer {
  width: 5px;
  flex-shrink: 0;
  cursor: col-resize;
  background: transparent;
  position: relative;
}
.lt-notes-resizer:hover,
.lt-notes-resizer:active {
  background: rgba(var(--v-theme-primary), 0.4);
}

.lt-notes {
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
.lt-fb--color { position: relative; overflow: hidden; }
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

.lt-timer-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  font-size: 12.5px;
  font-weight: 600;
  flex-shrink: 0;
  color: rgb(var(--v-theme-on-primary));
  background: rgb(var(--v-theme-primary));
}
.lt-timer-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lt-timer-time { font-variant-numeric: tabular-nums; opacity: 0.9; }
.lt-timer-time--over { color: #ffee58; }
.lt-timer-bar .lt-btn-icon { color: inherit; }
.lt-timer-bar .lt-btn-icon:hover:not(:disabled) { background: rgba(255, 255, 255, 0.2); }

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
  position: relative;
  overflow: hidden;
  transition: border-color 0.15s, transform 0.1s;
}
.lt-color-swatch:hover { border-color: rgba(var(--v-theme-primary), 0.8); transform: scale(1.05); }

/* Input real (não display:none) sobreposto ao swatch visível — só assim o
   seletor de cor nativo do Chromium tem uma posição/tamanho válidos pra se
   ancorar ali, em vez de abrir deslocado no canto da tela. */
.lt-color-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
}

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

.lt-checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  margin-bottom: 10px;
}
.lt-checkbox-row input {
  accent-color: rgb(var(--v-theme-primary));
  cursor: pointer;
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

/* ── Type picker (passo 1) ── */
.lt-type-list { display: flex; flex-direction: column; gap: 6px; }
.lt-type-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.lt-type-row:hover { background: rgba(var(--v-theme-on-surface), 0.05); border-color: rgba(var(--v-theme-primary), 0.4); }
.lt-type-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.lt-type-info { flex: 1; min-width: 0; }
.lt-type-title { font-size: 13.5px; font-weight: 600; color: rgb(var(--v-theme-on-surface)); }
.lt-type-desc { font-size: 11.5px; color: rgba(var(--v-theme-on-surface), 0.55); }
.lt-type-chevron { opacity: 0.4; flex-shrink: 0; }

/* ── Versículo / Mídia ── */
.lt-verse-preview {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  font-size: 12.5px;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.8);
  max-height: 120px;
  overflow-y: auto;
}

.lt-file-row { display: flex; gap: 8px; align-items: center; }
.lt-file-row .lt-input { flex: 1; }
.lt-file-row .lt-btn-outline { flex-shrink: 0; }

/* ── Confirmar Limpar Tudo ── */
.lt-confirm-card {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  border-radius: 8px;
  overflow: hidden;
}
.lt-confirm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #0891b2;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
}
.lt-confirm-body { padding: 18px 18px 8px; }
.lt-confirm-warning { display: flex; align-items: center; gap: 12px; }
.lt-confirm-title {
  font-weight: 700;
  font-size: 14px;
  line-height: 1.4;
  color: #b91c1c;
}
.v-theme--dark .lt-confirm-title { color: #f87171; }
.lt-confirm-sub {
  font-size: 12.5px;
  color: rgba(var(--v-theme-on-surface), 0.55);
  margin: 8px 0 4px 52px;
}

.lt-confirm-actions {
  display: flex;
  flex-direction: column;
  margin-top: 12px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.lt-confirm-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 4px;
  border: none;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: none;
  cursor: pointer;
  font-size: 13.5px;
  text-align: left;
  color: rgb(var(--v-theme-primary));
  transition: background 0.12s;
}
.lt-confirm-link:last-child { border-bottom: none; }
.lt-confirm-link:hover { background: rgba(var(--v-theme-on-surface), 0.05); }
.lt-confirm-link--danger { color: #e53935; }

/* ── Copiar para outros dias ── */
.lt-copy-hint {
  font-size: 12.5px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 10px;
}
.lt-copy-days {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 2px;
  max-height: 220px;
  overflow-y: auto;
}
.lt-copy-day-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
}
.lt-copy-overwrite {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  color: rgba(var(--v-theme-on-surface), 0.7);
  cursor: pointer;
}
.lt-copy-day-row input,
.lt-copy-overwrite input {
  accent-color: rgb(var(--v-theme-primary));
  cursor: pointer;
}

/* Salvar/Carregar liturgias nomeadas */
.lt-saved-empty {
  padding: 24px 16px;
  text-align: center;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.lt-saved-list {
  max-height: 320px;
  overflow-y: auto;
}
.lt-saved-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.lt-saved-row:last-child { border-bottom: none; }
.lt-saved-info { flex: 1; overflow: hidden; }
.lt-saved-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgb(var(--v-theme-on-surface));
}
.lt-saved-meta {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.lt-saved-confirm-label {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  white-space: nowrap;
}
</style>
