<template>
  <AppLoading />
  <v-btn
    v-show="false"
    @shortkey="handleKeydown()"
    v-shortkey="['ctrl', 'alt', 'd']"
  />
  <v-app id="app-container">
    <router-view />
  </v-app>

  <!-- Verificador de arquivos locais -->
  <FileCheckDialog ref="fileCheck" />

  <!-- Auto-updater -->
  <UpdateDialog ref="updater" />

  <!-- Novidades da versão instalada (uma vez por versão, após atualizar) -->
  <ReleaseNotesDialog ref="releaseNotes" />

  <!-- Aviso de novo conteúdo publicado -->
  <DbUpdateDialog ref="dbUpdater" @sync-requested="onDbUpdateSyncRequested" />

  <!-- Snackbar do auto-import SQLite -->
  <v-snackbar
    v-model="autoImportSnack"
    :timeout="autoImportDone ? 4000 : -1"
    location="bottom right"
    color="primary"
    rounded="lg"
    elevation="4"
    min-width="280"
  >
    <div class="d-flex align-center">
      <v-progress-circular
        v-if="!autoImportDone"
        size="18"
        width="2"
        indeterminate
        color="white"
        class="mr-2"
      />
      <v-icon v-else color="white" size="18" class="mr-2">mdi-check-circle</v-icon>
      <span class="text-body-2">{{ autoImportMessage }}</span>
    </div>
  </v-snackbar>
</template>

<script>
import AppLoading    from "@/layout/Loading.vue";
import FileCheckDialog from "@/components/FileCheckDialog.vue";
import UpdateDialog    from "@/components/UpdateDialog.vue";
import DbUpdateDialog  from "@/components/DbUpdateDialog.vue";
import ReleaseNotesDialog from "@/components/ReleaseNotesDialog.vue";

export default {
  name: "App",
  components: { AppLoading, FileCheckDialog, UpdateDialog, DbUpdateDialog, ReleaseNotesDialog },

  data: () => ({
    autoImportSnack:     false,
    autoImportDone:      false,
    autoImportMessage:   '',
    _autoImportRunning:  false,
    _handlers:              [],
    _syncFilesHandler:      null,
    _checkUpdatesHandler:   null,
    _beforeUnloadHandler:   null,
  }),

  mounted() {
    if (!this.$electron.isElectron()) return;
    // Janelas de projeção não precisam de verificação de arquivos nem notificações
    const _hash = window.location.hash;
    if (_hash.includes('/popup') || _hash.includes('/return-screen') || _hash.includes('/video-pip')) return;

    // Restaura o "Fundo Personalizado" com o mesmo estado (ativo ou inativo)
    // que ele tinha quando o app foi fechado — a ativação é persistida no
    // electron-store por modules/core/slide_bg/interface/Index.vue#syncToLocalStorage.
    // Sem essa chave (recurso nunca ativado, ou desativado por último), o slide
    // volta a usar a imagem padrão do álbum.
    this.$electron.storeGet('slide_global_bg_persisted', null)
      .then(persisted => {
        try {
          if (persisted) localStorage.setItem('slide_global_bg', JSON.stringify(persisted));
          else localStorage.removeItem('slide_global_bg');
          window.dispatchEvent(new CustomEvent('slide-bg-changed'));
          // Empurra também por IPC para a janela de saída/retorno — elas não
          // compartilham este localStorage (cada janela tem o seu, ver
          // SystemBar.vue) e, se a projeção anterior for restaurada neste
          // mesmo boot (ver 'restore-output-state' abaixo), a janela de saída
          // pode terminar de carregar e pedir seu resync ('output-ready')
          // ANTES deste storeGet resolver — sem este envio explícito, ela
          // ficava com o fundo/tamanho de texto padrão (em vez do
          // personalizado) até a próxima alteração manual no painel.
          if (window.electron) {
            window.electron.sendStateUpdate({ param: 'slide_global_bg', value: persisted ?? null });
          }
        } catch (_) {}
      })
      .catch(() => {});

    // Segurança: se offline mode estava ativo mas não há nenhum arquivo local
    // (build nova ou localStorage persistido de sessão de desenvolvimento),
    // desativa automaticamente para que os álbuns sejam carregados pela API.
    // Storage.js persiste em DOIS lugares: localStorage + electron-store.
    this.$electron.dbLocalList().then(files => {
      if (!files || files.length === 0) {
        // Limpa localStorage
        try { localStorage.removeItem('db_local_enabled'); } catch (_) {}
        // Limpa electron-store
        this.$electron.storeRemove('db_local_enabled').catch(() => {});
        console.log('[App] Modo offline desativado: sem arquivos locais.');
      }
    }).catch(() => {});

    // 1. Ouve auto-import disparado pelo processo principal (database.db local)
    const onAutoImport = this.$electron.on('sqlite:auto-import', async ({ dbPath }) => {
      await this.startAutoImport(dbPath);
      // Após o import, aguarda render e abre o verificador
      await this.$nextTick();
      setTimeout(() => this.openFileCheck(), 1500);
    });
    if (onAutoImport) this._handlers.push(['sqlite:auto-import', onAutoImport]);

    // 2. Ouve progresso do import
    const onProgress = this.$electron.on('sqlite:progress', ({ percent }) => {
      if (!this.autoImportSnack) return;
      this.autoImportMessage = `Carregando banco local... ${percent}%`;
      if (percent >= 100) {
        this.autoImportDone    = true;
        this.autoImportMessage = 'Banco local carregado com sucesso!';
      }
    });
    if (onProgress) this._handlers.push(['sqlite:progress', onProgress]);

    // 3. Abre verificador de arquivos após o app carregar — só automaticamente na
    //    primeira vez (flag persistida via Store). Nas próximas aberturas do app,
    //    só roda de novo se houver nova versão do banco de dados (ver onDbUpdateSyncRequested) ou
    //    manualmente via "Sincronizar arquivos" no menu (fileCheck.open(true)).
    //    Delay maior para garantir que o router e os refs estão prontos.
    this.$electron.storeGet('startup_file_check_done', false)
      .then(done => { if (!done) this.scheduleStartupFileCheck(); })
      .catch(() => this.scheduleStartupFileCheck());

    // 4. Verifica atualização do banco SQLite via API (após 6s para não competir com o
    //    auto-import). Diferente de antes, não baixa mais silenciosamente — só abre o
    //    diálogo de confirmação quando encontra versão nova (ver DbUpdateDialog.vue).
    setTimeout(() => this.$refs.dbUpdater?.check(), 6000);

    // 4b. Mostra "novidades desta versão" uma vez por atualização — compara a
    // versão instalada com a última que o operador já viu/dispensou (mesmo
    // mecanismo do fork mais avançado deste app, louvorja/violin-app,
    // ReleaseNotesDialog.vue). O check do updater (UpdateDialog, item 6 do
    // menu) só roda 15s depois do boot em build empacotada (ver electron/
    // updater.js#init), então não compete com este modal.
    this.$electron.getVersion().then(async (version) => {
      if (!version) return;
      const skipped = await this.$electron.storeGet('skip_release_notes_version', null).catch(() => null);
      if (skipped === version) return;
      await this.$nextTick();
      setTimeout(() => this.$refs.releaseNotes?.open(version), 1500);
    }).catch(() => {});

    // 5. Ouve evento global para abrir o verificador de arquivos (disparado pelo Menu)
    this._syncFilesHandler = () => this.$refs.fileCheck?.open(true);
    window.addEventListener('sync-files', this._syncFilesHandler);

    // 5b. Ouve evento global de verificar atualizações (disparado pelo Menu lateral)
    this._checkUpdatesHandler = () => this.$refs.updater?.checkNow();
    window.addEventListener('check-updates', this._checkUpdatesHandler);

    // 6. Ouve "Verificar atualizações" do menu nativo
    const onCheckUpdates = this.$electron.on('menu:check-updates', () => {
      this.$refs.updater?.checkNow();
    });
    if (onCheckUpdates) this._handlers.push(['menu:check-updates', onCheckUpdates]);

    // 7. Ponte com o servidor de Controle Remoto (electron/remote_server.js) —
    // navegação/busca/abrir música vindas de outro dispositivo na mesma rede.
    const onRemoteRequest = this.$electron.on('remote:request', (req) => this.handleRemoteRequest(req));
    if (onRemoteRequest) this._handlers.push(['remote:request', onRemoteRequest]);

    // 8. Restaura a projeção que estava aberta quando o app foi fechado da
    // última vez — o processo main já recriou a janela de saída sozinho (ver
    // ipcMain.once('app:loaded') em electron/main.js); aqui só espelhamos o
    // mesmo estado que $popup.open() deixaria (ver helpers/Popup.js), pra UI
    // do operador (ex. botão "is_selected" em buttons/Screen.vue) refletir
    // que já existe um módulo projetado, sem reabrir a janela de novo.
    const onRestoreOutput = this.$electron.on('restore-output-state', (moduleId) => {
      if (!moduleId) return;
      this.$appdata.set('popup', { closed: false, _electron: true });
      this.$appdata.set('popup_module', moduleId);
    });
    if (onRestoreOutput) this._handlers.push(['restore-output-state', onRestoreOutput]);

    // 9. Limpa a seleção (checkbox) de itens da Liturgia ao encerrar o sistema —
    // mesma limpeza feita ao fechar a janela da Liturgia pelo botão (ver
    // clearAllSelections() em modules/liturgia/interface/Index.vue), mas essa
    // roda mesmo se a janela da Liturgia não estiver aberta/montada no
    // momento (ex.: usuário fechou o app com a Liturgia minimizada) — atua
    // direto no $userdata, sem depender da instância do componente.
    this._beforeUnloadHandler = () => this.clearLiturgiaSelections();
    window.addEventListener('beforeunload', this._beforeUnloadHandler);
  },

  beforeUnmount() {
    this._handlers.forEach(([ch, h]) => this.$electron.off(ch, h));
    window.removeEventListener('sync-files', this._syncFilesHandler);
    window.removeEventListener('check-updates', this._checkUpdatesHandler);
    window.removeEventListener('beforeunload', this._beforeUnloadHandler);
  },

  methods: {
    handleKeydown() {
      console.log("click ");
      this.$dev.toogle();
    },

    // Mesma lógica de modules/liturgia/interface/Index.vue#clearAllSelections,
    // duplicada aqui (sem depender da instância do componente, que pode nem
    // estar montada nesse momento — ver comentário no mounted() acima).
    clearLiturgiaSelections() {
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

    // Abre o verificador de arquivos no startup (dev e prod).
    // O dialog internamente decide se exibe ou fecha automaticamente.
    async openFileCheck() {
      if (this._autoImportRunning) return;
      try {
        await this.$nextTick();
        this.$refs.fileCheck?.open();
      } catch (_) {}
    },

    // Roda a verificação automática de arquivos uma única vez e marca a flag,
    // para que não rode de novo sozinha nas próximas aberturas do app.
    scheduleStartupFileCheck() {
      setTimeout(async () => {
        await this.openFileCheck();
        this.$electron.storeSet('startup_file_check_done', true).catch(() => {});
      }, 4000);
    },

    // Chamado pelo DbUpdateDialog (evento 'sync-requested') depois que o
    // usuário confirma que quer sincronizar a nova versão do banco de dados. Não existe mais
    // um "database.db" único pra baixar (ver electron/ipc.js#sqlite:check-db-update) —
    // delega direto pro fluxo de arquivo-por-arquivo já existente, forçando
    // a tela mesmo que nada esteja faltando (o operador pediu explicitamente).
    async onDbUpdateSyncRequested() {
      await this.$nextTick();
      this.$refs.fileCheck?.open(true);
    },

    // Atende requisições do servidor de Controle Remoto (electron/remote_server.js),
    // reaproveitando a mesma lógica já usada pelos atalhos de teclado/busca locais.
    async handleRemoteRequest({ reqId, type, params } = {}) {
      const payload = { reqId, ok: false };
      try {
        if (type === 'keyboard') {
          // Controla o que estiver de fato projetado no momento — slide de
          // música (media), vídeo/imagem local (video_player) ou vídeo do
          // YouTube aberto pela Liturgia (web_link) — em vez de sempre supor
          // que é uma música. video_player/web_link não têm "slides", então
          // ArrowLeft/Right/Up/Down viram avanço/retrocesso (seekBy) ao invés
          // de navegação de linha/primeira-última.
          const activeModule = this.$appdata.get('popup_module') || 'media';
          const key = params?.key;
          if (activeModule === 'video_player') {
            const actions = {
              ArrowUp:    () => this.$videoPlayer.seekBy(30),
              ArrowDown:  () => this.$videoPlayer.seekBy(-30),
              ArrowLeft:  () => this.$videoPlayer.seekBy(-10),
              ArrowRight: () => this.$videoPlayer.seekBy(10),
              Escape:     () => this.$videoPlayer.stop(),
              Space:      () => this.$videoPlayer.togglePlay(),
            };
            (actions[key] || (() => {}))();
          } else if (activeModule === 'web_link') {
            const actions = {
              ArrowUp:    () => this.$webLink.seekBy(30),
              ArrowDown:  () => this.$webLink.seekBy(-30),
              ArrowLeft:  () => this.$webLink.seekBy(-10),
              ArrowRight: () => this.$webLink.seekBy(10),
              Escape:     () => this.$webLink.stop(),
              Space:      () => this.$webLink.togglePlay(),
            };
            (actions[key] || (() => {}))();
          } else {
            const actions = {
              ArrowUp:    () => this.$media.prevSlide(),
              ArrowDown:  () => this.$media.nextSlide(),
              ArrowLeft:  () => this.$media.firstSlide(),
              ArrowRight: () => this.$media.lastSlide(),
              Escape:     () => this.$media.close(),
              Space:      () => this.$media.pause(!this.$appdata.get('modules.media.config.is_paused')),
            };
            (actions[key] || (() => {}))();
          }
          payload.ok = true;
        } else if (type === 'search-songs') {
          const q = this.$string.clean((params?.q || '').trim());
          const locale = this.$i18n?.locale?.value || this.$i18n?.locale || 'pt';
          const raw = (await this.$database.get(`${locale}_musics`)) || [];
          payload.results = q
            ? raw
                .filter((item) => this.$string.clean(item.name).includes(q))
                .slice(0, 20)
                // Inclui os álbuns (mesmo campo já usado em QuickSearch.vue) — sem
                // isso o controle remoto não tinha como distinguir músicas de
                // mesmo nome pertencentes a álbuns diferentes.
                .map((item) => ({
                  id: item.id_music,
                  name: item.name,
                  albums: (item.albums || []).map((a) => a.name),
                }))
            : [];
          payload.ok = true;
        } else if (type === 'get-liturgia') {
          const day = this.$userdata.get('modules.liturgia.currentDay', 'segunda');
          const items = this.$userdata.get(`modules.liturgia.days.${day}.items`) || [];
          payload.day = day;
          payload.items = items.map((i) => ({
            id: i.id,
            type: i.type,
            name: i.name,
            color: i.color || '',
            id_music: i.type === 'musica' ? (i.id_music || null) : null,
            // Só um indicador (tem áudio/vídeo/link anexado?) — nunca o caminho
            // real do arquivo (i.url): o remoto não precisa dele, e abrir por
            // "id" (ver 'open-liturgia-item' abaixo) evita expor caminhos locais
            // do computador do operador na rede.
            has_media: ['midia', 'arquivo', 'link'].includes(i.type) && !!i.url,
          }));
          payload.ok = true;
        } else if (type === 'open-liturgia-item') {
          // Abre o áudio/vídeo/link anexado a um item específico da liturgia —
          // mesma lógica de playItem() em src/modules/liturgia/interface/Index.vue,
          // reaproveitada aqui porque o remoto só tem o "id" do item (nunca o
          // caminho do arquivo, ver comentário acima) e precisa resolver o item
          // de novo a partir dos dados reais da liturgia antes de tocar.
          const day = params?.day || this.$userdata.get('modules.liturgia.currentDay', 'segunda');
          const items = this.$userdata.get(`modules.liturgia.days.${day}.items`) || [];
          const item = items.find((i) => String(i.id) === String(params?.id));
          if (!item) {
            payload.code = 'ITEM_NOT_FOUND';
          } else if (item.type === 'musica' && item.id_music) {
            await this.$media.open({ id_music: item.id_music, mode: 'audio' });
            payload.ok = true;
          } else if (item.type === 'midia' && item.url) {
            this.$videoPlayer.open(item.url, item.name, { addToPlaylist: false });
            payload.ok = true;
          } else if (item.type === 'arquivo' && item.url) {
            this.$soundMaster.play(item.url, item.name);
            payload.ok = true;
          } else if (item.type === 'link' && item.url) {
            this.$webLink.open(item.url, item.name, { addToPlaylist: false });
            payload.ok = true;
          } else {
            payload.code = 'NOT_PLAYABLE';
          }
        } else if (type === 'media-control') {
          // Controle dedicado de vídeo/áudio, independente do que estiver
          // "ativo" no momento (popup_module) — sem isso, video_player e
          // soundmaster (que podem tocar ao mesmo tempo, são módulos
          // independentes) não tinham como ser fechados/pausados
          // separadamente pelo controle remoto.
          const target = params?.target;
          const action = params?.action;
          if (target === 'video' && (action === 'toggle' || action === 'stop')) {
            if (action === 'toggle') this.$videoPlayer.togglePlay();
            else this.$videoPlayer.stop();
            payload.ok = true;
          } else if (target === 'audio' && (action === 'toggle' || action === 'stop')) {
            if (action === 'toggle') this.$soundMaster.togglePlay();
            else this.$soundMaster.stop();
            payload.ok = true;
          } else {
            payload.code = 'INVALID_PARAMS';
          }
        } else if (type === 'open-liturgia') {
          // Abre a janela do módulo Liturgia no app (não é sobre projeção) —
          // permite que o operador abra o painel da liturgia no computador
          // sem precisar sair de perto do celular.
          this.$modules.open('liturgia');
          payload.ok = true;
        } else if (type === 'open-song') {
          const mode = params?.tag == 1 ? 'audio' : params?.tag == 2 ? 'instrumental' : 'no_audio';
          await this.$media.open({ id_music: params?.id, mode });
          payload.ok = true;
        } else if (type === 'close-media') {
          // Idem: age sobre o módulo realmente projetado no momento.
          // force=true no media.close(): sem o diálogo "tem certeza?" padrão —
          // esse diálogo aparece na tela do computador, não no celular, então o
          // botão de fechar do controle remoto ficaria travado esperando um
          // clique que ninguém vai dar ali. video_player/web_link não têm esse
          // diálogo (stop() já fecha direto).
          const activeModule = this.$appdata.get('popup_module') || 'media';
          if (activeModule === 'video_player') this.$videoPlayer.stop();
          else if (activeModule === 'web_link') this.$webLink.stop();
          else this.$media.close(true);
          payload.ok = true;
        } else if (type === 'get-volume') {
          // target="video": volume do vídeo especificamente, sempre — usado
          // pelo card dedicado "Vídeo" do remoto, que não deve depender do
          // que estiver "ativo" no momento (a música/YouTube podem estar
          // projetando por cima, o vídeo continua tendo seu próprio volume).
          // Sem target: comportamento antigo (volume de quem estiver "ativo"),
          // usado pelo card genérico de Volume (música/slide ou YouTube).
          if (params?.target === 'video') {
            payload.module = 'video_player';
            payload.volume = this.$appdata.get('modules.video_player.config.volume', 100);
          } else {
            const activeModule = this.$appdata.get('popup_module') || 'media';
            payload.module = activeModule;
            payload.volume = activeModule === 'video_player' ? this.$appdata.get('modules.video_player.config.volume', 100)
                            : activeModule === 'web_link'     ? this.$appdata.get('modules.web_link.config.volume', 100)
                            : this.$appdata.get('modules.media.config.volume', 100);
          }
          payload.ok = true;
        } else if (type === 'set-volume') {
          const val = Math.round(Number(params?.value));
          if (Number.isFinite(val)) {
            const v = Math.max(0, Math.min(100, val));
            if (params?.target === 'video') {
              this.$videoPlayer.setVolume(v);
            } else {
              const activeModule = this.$appdata.get('popup_module') || 'media';
              if (activeModule === 'video_player') this.$videoPlayer.setVolume(v);
              else if (activeModule === 'web_link') this.$webLink.setVolume(v);
              else this.$media.setVolume(v);
            }
          }
          payload.ok = true;
        // Controle dedicado do SoundMaster (pads/volume/atenuador) — NUNCA
        // depende de "popup_module" como os ramos acima: SoundMaster não
        // projeta nada (é só áudio), então nunca é o módulo "ativo" na
        // projeção, e precisa do próprio canal de comando (ver
        // helpers/SoundMaster.js) pra funcionar independente do que estiver
        // sendo exibido (inclusive nada, ou um PowerPoint fora do LouvorJA —
        // esse controle é só IPC interno entre a janela do celular e a janela
        // já aberta do LouvorJA, nunca toca em foco/janela do sistema).
        } else if (type === 'soundmaster-state') {
          payload.pads = this.$soundMaster.getPads();
          payload.nowPlaying = this.$soundMaster.nowPlaying();
          payload.ok = true;
        } else if (type === 'soundmaster-control') {
          const action = params?.action;
          if (action === 'toggle') this.$soundMaster.togglePlay();
          else if (action === 'stop') this.$soundMaster.stop();
          else if (action === 'play_pad' && params?.padId != null) this.$soundMaster.playPad(params.padId);
          else if (action === 'talkover_toggle') this.$soundMaster.toggleTalkover();
          else if (action === 'volume' && Number.isFinite(Number(params?.value))) this.$soundMaster.setVolume(Number(params.value));
          else if (action === 'ducking_level' && Number.isFinite(Number(params?.value))) this.$soundMaster.setDuckingLevel(Number(params.value));
          else { payload.code = 'INVALID_PARAMS'; this.$electron.sendRemoteResponse(payload); return; }
          payload.ok = true;
        } else {
          payload.code = 'UNKNOWN_TYPE';
        }
      } catch (_) {
        payload.code = 'ERROR';
      }
      this.$electron.sendRemoteResponse(payload);
    },
  },
};
</script>

<style>
#app-container > .v-application__wrap {
  height: 100vh;
}
</style>
