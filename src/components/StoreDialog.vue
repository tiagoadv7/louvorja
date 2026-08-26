<template>
  <v-dialog v-model="dialog" max-width="680" scrollable>
    <template v-slot:activator="{ props }">
      <slot :props="props" />
    </template>

    <v-card>
      <v-card-title class="d-flex align-center gap-2 py-3">
        <v-icon>mdi-store-outline</v-icon>
        Loja / Cache Local
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="dialog = false" />
      </v-card-title>

      <v-divider />

      <v-card-text class="pa-4">
        <!-- Status local -->
        <v-card variant="tonal" color="primary" class="mb-4">
          <v-card-text class="d-flex align-center">
            <v-icon class="mr-3" size="32">mdi-database-outline</v-icon>
            <div>
              <div class="text-body-1 font-weight-medium">Banco de dados local</div>
              <div class="text-caption">
                {{ localFiles.length }} arquivo(s) • {{ formatTotalSize() }}
              </div>
            </div>
            <v-spacer />
            <v-switch
              v-model="localEnabled"
              color="primary"
              label="Modo offline"
              density="compact"
              hide-details
              class="mr-2"
            />
            <v-btn
              variant="text"
              color="error"
              size="small"
              :disabled="localFiles.length === 0 || clearing"
              :loading="clearing"
              @click="clearAll"
            >
              Limpar
            </v-btn>
          </v-card-text>
        </v-card>

        <div class="text-caption text-medium-emphasis mb-4">
          Com o <b>Modo offline</b> ativado, os arquivos baixados são usados no lugar da API. Novas consultas são salvas automaticamente no disco.
        </div>

        <!-- Pacotes -->
        <div class="text-subtitle-2 mb-2">Pacotes disponíveis</div>
        <v-list lines="two" class="mb-4" rounded="lg" border>
          <v-list-item
            v-for="pkg in packages"
            :key="pkg.id"
            :prepend-icon="pkg.icon"
            :title="pkg.name"
            :subtitle="pkg.description"
          >
            <template v-slot:append>
              <div class="d-flex align-center gap-1">
                <v-progress-circular
                  v-if="downloading[pkg.id]"
                  indeterminate
                  size="22"
                  width="2"
                />
                <template v-else>
                  <v-icon
                    v-if="isPackageDownloaded(pkg)"
                    color="success"
                    size="20"
                  >mdi-check-circle</v-icon>
                  <v-btn
                    :color="isPackageDownloaded(pkg) ? 'success' : 'primary'"
                    :variant="isPackageDownloaded(pkg) ? 'text' : 'tonal'"
                    size="small"
                    :prepend-icon="isPackageDownloaded(pkg) ? 'mdi-refresh' : 'mdi-download'"
                    @click="downloadPackage(pkg)"
                  >
                    {{ isPackageDownloaded(pkg) ? 'Atualizar' : 'Baixar' }}
                  </v-btn>
                </template>
              </div>
            </template>
          </v-list-item>
        </v-list>

        <!-- Importação banco de dados SQLite -->
        <v-divider class="my-4" />
        <div class="text-subtitle-2 mb-2">Importar banco de dados</div>

        <v-card variant="outlined" class="mb-4">
          <v-card-text class="pb-2">
            <div class="text-caption text-medium-emphasis mb-3">
              Selecione o arquivo <b>database.db</b> da instalação anterior para importar
              coletâneas, músicas, letras e capas. Os arquivos de mídia já existentes em
              <code>config/</code> serão reconhecidos automaticamente.
            </div>

            <v-text-field
              v-model="sqliteDbPath"
              label="Banco de dados (.db, .sqlite)"
              density="compact"
              variant="outlined"
              hide-details
              class="mb-2"
              readonly
            >
              <template v-slot:append-inner>
                <v-btn
                  icon="mdi-folder-open-outline"
                  variant="text"
                  size="small"
                  @click="browseDelphiDb"
                />
              </template>
            </v-text-field>

            <div v-if="sqliteDbPath" class="text-caption text-medium-emphasis mb-3">
              Capas detectadas em: <b>{{ sqliteCapasPath }}</b>
            </div>

            <!-- Botões de ação -->
            <div class="d-flex gap-2 mb-2">
              <v-btn
                color="primary"
                variant="tonal"
                size="small"
                prepend-icon="mdi-import"
                :disabled="!sqliteDbPath || importing"
                :loading="importing"
                @click="importSqlite"
              >
                Importar banco
              </v-btn>
              <v-spacer />
              <v-btn
                v-if="sqliteImportInfo"
                color="error"
                variant="text"
                size="small"
                prepend-icon="mdi-delete-outline"
                :disabled="importing"
                @click="clearSqlite"
              >
                Limpar
              </v-btn>
            </div>

            <!-- Progresso -->
            <div v-if="importing">
              <v-progress-linear
                :model-value="sqliteProgress.percent"
                color="primary"
                rounded
                height="6"
                class="mb-1"
              />
              <div class="text-caption text-medium-emphasis">{{ sqliteProgress.message }}</div>
            </div>

            <!-- Info da última importação -->
            <v-alert
              v-if="sqliteImportInfo && !importing"
              type="success"
              variant="tonal"
              density="compact"
              class="mt-2"
            >
              <div class="text-caption">
                Importado em {{ formatDate(sqliteImportInfo.date) }} —
                {{ sqliteImportInfo.categories }} coletâneas,
                {{ sqliteImportInfo.albums || 0 }} álbuns,
                {{ sqliteImportInfo.musics }} músicas
              </div>
            </v-alert>
          </v-card-text>
        </v-card>

        <!-- Pasta do banco de dados local -->
        <v-divider class="my-4" />
        <div class="text-subtitle-2 mb-2">Pasta do banco de dados local</div>
        <v-card variant="outlined" class="mb-4">
          <v-card-text class="pb-2">
            <div class="text-caption text-medium-emphasis mb-3">
              Aponte para a pasta que contém os arquivos JSON do banco local do LouvorJA (ex: pasta do LouvorJA no Desktop). Deixe vazio para usar o padrão interno do app.
            </div>

            <v-text-field
              v-model="dbLocalFolder"
              label="Pasta do banco de dados"
              density="compact"
              variant="outlined"
              class="mb-2"
              :hint="dbLocalFolderSaved ? 'Pasta configurada. Os arquivos JSON serão lidos desta pasta.' : 'Usando pasta padrão interna do app.'"
              persistent-hint
              readonly
            >
              <template v-slot:append-inner>
                <v-btn
                  icon="mdi-folder-open-outline"
                  variant="text"
                  size="small"
                  @click="browseDbFolder"
                />
              </template>
            </v-text-field>

            <div class="d-flex gap-2 mt-1">
              <v-btn
                color="primary"
                variant="tonal"
                size="small"
                prepend-icon="mdi-content-save-outline"
                :disabled="!dbLocalFolder || dbLocalFolder === dbLocalFolderSaved"
                @click="saveDbFolder"
              >
                Salvar pasta
              </v-btn>
              <v-btn
                v-if="dbLocalFolderSaved"
                color="error"
                variant="text"
                size="small"
                prepend-icon="mdi-close"
                @click="clearDbFolder"
              >
                Usar padrão
              </v-btn>
            </div>

            <v-alert
              v-if="dbLocalFolderSaved"
              type="success"
              variant="tonal"
              density="compact"
              class="mt-3"
            >
              <div class="text-caption text-truncate">{{ dbLocalFolderSaved }}</div>
            </v-alert>
          </v-card-text>
        </v-card>

        <!-- Arquivos de mídia locais -->
        <v-divider class="my-4" />
        <div class="text-subtitle-2 mb-2">Arquivos de mídia</div>
        <v-card variant="outlined" class="mb-4">
          <v-card-text class="pb-2">
            <div class="text-caption text-medium-emphasis mb-3">
              Aponte para a pasta com os arquivos de áudio do LouvorJA. O app buscará os arquivos automaticamente durante a reprodução.
            </div>

            <v-text-field
              v-model="mediaBasePath"
              label="Pasta de arquivos locais"
              density="compact"
              variant="outlined"
              class="mb-2"
              :hint="mediaScanCount !== null ? `${mediaScanCount} arquivo(s) de áudio encontrado(s)` : ''"
              persistent-hint
              readonly
            >
              <template v-slot:append-inner>
                <v-btn
                  icon="mdi-folder-open-outline"
                  variant="text"
                  size="small"
                  @click="browseMediaFolder"
                />
              </template>
            </v-text-field>

            <div class="d-flex gap-2 mt-1">
              <v-btn
                color="primary"
                variant="tonal"
                size="small"
                prepend-icon="mdi-content-save-outline"
                :disabled="!mediaBasePath || mediaBasePath === mediaSavedPath"
                @click="saveMediaFolder"
              >
                Salvar pasta
              </v-btn>
              <v-btn
                v-if="mediaSavedPath"
                color="error"
                variant="text"
                size="small"
                prepend-icon="mdi-close"
                @click="clearMediaFolder"
              >
                Remover
              </v-btn>
              <v-spacer />
              <v-btn
                variant="tonal"
                size="small"
                prepend-icon="mdi-cloud-download-outline"
                @click="openDrive"
              >
                Drive online
              </v-btn>
            </div>

            <v-alert
              v-if="mediaSavedPath"
              type="success"
              variant="tonal"
              density="compact"
              class="mt-3"
            >
              <div class="text-caption">Pasta configurada. O app já busca os arquivos localmente durante a reprodução.</div>
            </v-alert>
          </v-card-text>
        </v-card>

        <!-- Pasta de imagens locais -->
        <v-divider class="my-4" />
        <div class="text-subtitle-2 mb-2">Pasta de imagens (fundos de slide)</div>
        <v-card variant="outlined" class="mb-4">
          <v-card-text class="pb-2">
            <div class="text-caption text-medium-emphasis mb-3">
              Aponte para a pasta com as imagens de fundo dos slides (ex: <b>Louvor JA\config\imagens</b>). O app buscará automaticamente ao exibir letras.
            </div>

            <v-text-field
              v-model="imagesBasePath"
              label="Pasta de imagens"
              density="compact"
              variant="outlined"
              class="mb-2"
              :hint="imagesBaseSaved ? 'Pasta configurada. Imagens serão carregadas localmente.' : 'Nenhuma pasta configurada.'"
              persistent-hint
              readonly
            >
              <template v-slot:append-inner>
                <v-btn
                  icon="mdi-folder-open-outline"
                  variant="text"
                  size="small"
                  @click="browseImagesFolder"
                />
              </template>
            </v-text-field>

            <div class="d-flex gap-2 mt-1">
              <v-btn
                color="primary"
                variant="tonal"
                size="small"
                prepend-icon="mdi-content-save-outline"
                :disabled="!imagesBasePath || imagesBasePath === imagesBaseSaved"
                @click="saveImagesFolder"
              >
                Salvar pasta
              </v-btn>
              <v-btn
                v-if="imagesBaseSaved"
                color="error"
                variant="text"
                size="small"
                prepend-icon="mdi-close"
                @click="clearImagesFolder"
              >
                Remover
              </v-btn>
            </div>

            <v-alert
              v-if="imagesBaseSaved"
              type="success"
              variant="tonal"
              density="compact"
              class="mt-3"
            >
              <div class="text-caption text-truncate">{{ imagesBaseSaved }}</div>
            </v-alert>
          </v-card-text>
        </v-card>

        <!-- Arquivos em cache -->
        <div class="d-flex align-center mb-2">
          <div class="text-subtitle-2">Arquivos em cache ({{ localFiles.length }})</div>
          <v-spacer />
          <v-btn
            v-if="localFiles.length > 0"
            variant="text"
            size="x-small"
            @click="loadLocalFiles"
          >
            Atualizar lista
          </v-btn>
        </div>

        <v-list
          v-if="localFiles.length > 0"
          density="compact"
          rounded="lg"
          border
          style="max-height: 200px; overflow-y: auto;"
        >
          <v-list-item
            v-for="file in localFiles"
            :key="file.name"
            :title="file.name"
            :subtitle="formatSize(file.size)"
            density="compact"
          >
            <template v-slot:append>
              <v-btn
                icon="mdi-delete-outline"
                variant="text"
                size="small"
                color="error"
                @click="deleteFile(file.name)"
              />
            </template>
          </v-list-item>
        </v-list>
        <v-alert v-else type="info" variant="tonal" density="compact">
          Nenhum arquivo em cache local.
        </v-alert>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import $database from "@/helpers/Database";
import $storage from "@/helpers/Storage";

const PACKAGES = [
  {
    id: 'albums',
    name: 'Músicas e Coletâneas',
    description: 'Catálogo de músicas, álbuns e coletâneas do LouvorJA',
    icon: 'mdi-music-circle-outline',
    files: ['pt_categories', 'pt_musics'],
  },
  {
    id: 'bible_pt',
    name: 'Bíblia Português',
    description: 'Livros e versões da Bíblia em português',
    icon: 'mdi-book-open-variant',
    files: ['pt_bible_book', 'pt_bible_version'],
  },
  {
    id: 'bible_es',
    name: 'Biblia Español',
    description: 'Libros y versiones de la Biblia en español',
    icon: 'mdi-book-open-variant',
    files: ['es_bible_book', 'es_bible_version'],
  },
  {
    id: 'hymnal',
    name: 'Hinário',
    description: 'Índice e letras do hinário moderno',
    icon: 'mdi-music-note',
    files: ['pt_hymnal'],
  },
  {
    id: 'hymnal_1996',
    name: 'Hinário 1996',
    description: 'Índice e letras do hinário de 1996',
    icon: 'mdi-music-note-outline',
    files: ['pt_hymnal_1996'],
  },
];

export default {
  name: 'StoreDialog',
  data: () => ({
    dialog: false,
    localFiles: [],
    downloading: {},
    clearing: false,
    packages: PACKAGES,
    // Importação SQLite
    sqliteDbPath: '',
    importing: false,
    // Pasta do banco de dados local
    dbLocalFolder: '',
    dbLocalFolderSaved: '',
    // Pasta de imagens
    imagesBasePath: '',
    imagesBaseSaved: '',
    // Mídia local
    mediaBasePath: '',
    mediaSavedPath: '',
    mediaScanCount: null,
    sqliteImportInfo: null,
    sqliteProgress: { percent: 0, message: '' },
    sqliteProgressHandler: null,
  }),
  computed: {
    localEnabled: {
      get() {
        return $storage.get('db_local_enabled', false);
      },
      set(val) {
        $storage.set('db_local_enabled', val);
      },
    },

    // Detecta automaticamente a pasta de capas ao lado do banco selecionado
    sqliteCapasPath() {
      if (!this.sqliteDbPath) return '';
      const sep = this.sqliteDbPath.includes('\\') ? '\\' : '/';
      const dir = this.sqliteDbPath.split(sep).slice(0, -1).join(sep);
      return dir + sep + 'capas';
    },
  },
  watch: {
    dialog(open) {
      if (open) {
        this.loadLocalFiles();
        this.loadSqliteInfo();
        this.loadDbFolder();
        this.loadImagesFolder();
        this.loadMediaFolder();
      } else {
        this.unsubscribeProgress();
      }
    },
  },
  methods: {
    async loadLocalFiles() {
      this.localFiles = await this.$electron.dbLocalList();
    },

    isPackageDownloaded(pkg) {
      return pkg.files.every(f => this.localFiles.some(lf => lf.name === f));
    },

    async downloadPackage(pkg) {
      this.downloading = { ...this.downloading, [pkg.id]: true };
      try {
        const failed = [];
        for (const file of pkg.files) {
          const ok = await $database.download(file);
          if (!ok) failed.push(file);
        }
        await this.loadLocalFiles();
        if (failed.length) {
          this.$alert?.error?.({ text: `Falha ao baixar: ${failed.join(', ')}. Verifique sua conexão.` });
        }
      } catch (e) {
        this.$alert?.error?.({ text: String(e) });
      } finally {
        this.downloading = { ...this.downloading, [pkg.id]: false };
      }
    },

    async deleteFile(filename) {
      await this.$electron.dbLocalDelete(filename);
      await this.loadLocalFiles();
    },

    async clearAll() {
      this.clearing = true;
      try {
        await this.$electron.dbLocalClear();
        await this.loadLocalFiles();
      } finally {
        this.clearing = false;
      }
    },

    formatSize(bytes) {
      if (!bytes) return '0 B';
      const kb = bytes / 1024;
      if (kb < 1024) return `${kb.toFixed(1)} KB`;
      return `${(kb / 1024).toFixed(1)} MB`;
    },

    formatTotalSize() {
      const total = this.localFiles.reduce((s, f) => s + (f.size || 0), 0);
      return this.formatSize(total);
    },

    formatDate(iso) {
      if (!iso) return '';
      return new Date(iso).toLocaleString();
    },

    async loadSqliteInfo() {
      this.sqliteImportInfo = await this.$electron.sqliteGetImportInfo();
    },

    async browseDelphiDb() {
      const file = await this.$electron.selectFile({
        title: 'Selecionar banco de dados',
        filters: [{ name: 'SQLite', extensions: ['db', 'sqlite', 'sqlite3'] }, { name: 'Todos', extensions: ['*'] }],
      });
      if (file) this.sqliteDbPath = file;
    },

    subscribeProgress() {
      this.sqliteProgressHandler = this.$electron.on('sqlite:progress', (data) => {
        this.sqliteProgress = data;
      });
    },

    unsubscribeProgress() {
      if (this.sqliteProgressHandler) {
        this.$electron.off('sqlite:progress', this.sqliteProgressHandler);
        this.sqliteProgressHandler = null;
      }
    },

    async importSqlite() {
      this.importing = true;
      this.sqliteProgress = { percent: 0, message: 'Iniciando...' };
      this.subscribeProgress();
      try {
        const result = await this.$electron.sqliteImport({
          dbPath:    this.sqliteDbPath,
          capasPath: this.sqliteCapasPath || null,
        });
        if (result.success) {
          await this.loadSqliteInfo();
          await this.loadLocalFiles();
          // Ativa o modo offline automaticamente após a importação
          if (!this.localEnabled) this.localEnabled = true;
        } else {
          this.$alert?.error?.({ text: result.error || 'Erro ao importar.' });
        }
      } catch (e) {
        this.$alert?.error?.({ text: String(e) });
      } finally {
        this.importing = false;
        this.unsubscribeProgress();
      }
    },

    async clearSqlite() {
      await this.$electron.sqliteClear();
      this.sqliteImportInfo = null;
    },

    async loadDbFolder() {
      const saved = await this.$electron.dbGetLocalFolder();
      this.dbLocalFolderSaved = saved || '';
      this.dbLocalFolder = saved || '';
    },

    async browseDbFolder() {
      const folder = await this.$electron.selectFolder({ title: 'Selecionar pasta do banco de dados local' });
      if (!folder) return;
      this.dbLocalFolder = folder;
    },

    async saveDbFolder() {
      await this.$electron.dbSetLocalFolder(this.dbLocalFolder);
      this.dbLocalFolderSaved = this.dbLocalFolder;
    },

    async clearDbFolder() {
      await this.$electron.dbSetLocalFolder(null);
      this.dbLocalFolderSaved = '';
      this.dbLocalFolder = '';
    },

    async loadImagesFolder() {
      const saved = await this.$electron.mediaGetImagesFolder();
      this.imagesBaseSaved = saved || '';
      this.imagesBasePath = saved || '';
    },

    async browseImagesFolder() {
      const folder = await this.$electron.selectFolder({ title: 'Selecionar pasta de imagens de fundo' });
      if (!folder) return;
      this.imagesBasePath = folder;
    },

    async saveImagesFolder() {
      await this.$electron.mediaSetImagesFolder(this.imagesBasePath);
      this.imagesBaseSaved = this.imagesBasePath;
    },

    async clearImagesFolder() {
      await this.$electron.mediaSetImagesFolder(null);
      this.imagesBaseSaved = '';
      this.imagesBasePath = '';
    },

    async loadMediaFolder() {
      const saved = await this.$electron.mediaGetBaseFolder();
      this.mediaSavedPath = saved || '';
      this.mediaBasePath = saved || '';
      if (saved) {
        const { count } = await this.$electron.mediaScanFolder(saved);
        this.mediaScanCount = count;
      } else {
        this.mediaScanCount = null;
      }
    },

    async browseMediaFolder() {
      const folder = await this.$electron.selectFolder({ title: 'Selecionar pasta de arquivos de mídia' });
      if (!folder) return;
      this.mediaBasePath = folder;
      const { count } = await this.$electron.mediaScanFolder(folder);
      this.mediaScanCount = count;
    },

    async saveMediaFolder() {
      await this.$electron.mediaSetBaseFolder(this.mediaBasePath);
      this.mediaSavedPath = this.mediaBasePath;
    },

    async clearMediaFolder() {
      await this.$electron.mediaSetBaseFolder(null);
      this.mediaSavedPath = '';
      this.mediaBasePath = '';
      this.mediaScanCount = null;
    },

    openDrive() {
      this.$electron.openExternal('https://louvorja.com.br/drive');
    },
  },
};
</script>
