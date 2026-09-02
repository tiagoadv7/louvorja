<template>
  <v-tooltip v-if="is_desktop" location="bottom">
    <template v-slot:activator="{ props }">
      <v-btn v-bind="props" icon="mdi-information-outline" @click="open" />
    </template>
    Sobre o Louvor JA
  </v-tooltip>

  <v-dialog v-model="dialog" max-width="480">
    <v-card rounded="lg" elevation="12" style="overflow:hidden">

      <!-- Cabeçalho -->
      <div class="about-header">
        <v-avatar size="56" color="primary" variant="tonal" class="flex-shrink-0">
          <v-img :src="logoUrl" />
        </v-avatar>
        <div class="flex-grow-1 min-w-0">
          <div class="text-h6 font-weight-bold">Louvor JA</div>
          <div class="text-caption text-medium-emphasis">Software de projeção de letras de músicas</div>
        </div>
        <v-btn icon="mdi-close" size="small" variant="text" density="comfortable" @click="dialog = false" />
      </div>
      <v-divider />

      <v-card-text class="about-body py-4">
        <div class="d-flex align-center justify-space-between mb-4">
          <v-chip color="primary" variant="tonal" class="font-weight-bold">
            v{{ currentVersion || '...' }}
          </v-chip>
          <v-btn size="small" variant="text" prepend-icon="mdi-cloud-refresh-outline" @click="checkForUpdates">
            Verificar atualizações
          </v-btn>
        </div>

        <!-- Contato / Site / Redes sociais -->
        <div class="about-section-title">Contato / Site / Redes Sociais</div>
        <div class="about-link" @click="openExternal('https://louvorja.com.br/')">
          <v-icon size="18">mdi-web</v-icon>
          <span>louvorja.com.br</span>
        </div>
        <div class="about-link" @click="openExternal('https://www.instagram.com/louvorja.app')">
          <v-icon size="18">mdi-instagram</v-icon>
          <span>@louvorja.app</span>
        </div>
        <div class="about-link" @click="openExternal('mailto:contato@louvorja.com.br')">
          <v-icon size="18">mdi-email-outline</v-icon>
          <span>contato@louvorja.com.br</span>
        </div>

        <!-- Desenvolvedor da coletânea -->
        <div class="about-section-title mt-4">Desenvolvedor da Coletânea</div>
        <div class="text-body-2 font-weight-medium">Mayco W. G. Rolbuche</div>
        <div class="about-link" @click="openExternal('mailto:mayco.rolbuche@yahoo.com.br')">
          <v-icon size="18">mdi-email-outline</v-icon>
          <span>mayco.rolbuche@yahoo.com.br</span>
        </div>
        <div class="about-link" @click="openExternal('https://www.facebook.com/maycorolbuche')">
          <v-icon size="18">mdi-facebook</v-icon>
          <span>facebook.com/maycorolbuche</span>
        </div>

        <!-- Colaboradores -->
        <v-expansion-panels class="mt-4" variant="accordion">
          <v-expansion-panel>
            <v-expansion-panel-title class="about-section-title pa-0">
              Colaboradores ({{ contributors.length }})
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div v-for="c in contributors" :key="c.name" class="mb-2">
                <div class="text-body-2 font-weight-medium">{{ c.name }}</div>
                <div v-if="c.email" class="about-link about-link--small" @click="openExternal('mailto:' + c.email)">
                  <v-icon size="15">mdi-email-outline</v-icon>
                  <span>{{ c.email }}</span>
                </div>
                <div v-if="c.link" class="about-link about-link--small" @click="openExternal(c.link)">
                  <v-icon size="15">mdi-link-variant</v-icon>
                  <span>{{ c.link.replace(/^https?:\/\//, '') }}</span>
                </div>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

        <!-- Créditos ao LouvorJA original (Delphi) -->
        <div class="about-legacy mt-4">
          <div class="text-caption text-medium-emphasis">
            Louvor JA é a modernização do LouvorJA original (Delphi).
            <span
              v-if="legacyVersion"
              class="about-link about-link--inline"
              @click="openExternal('https://github.com/louvorja/desktop/releases')"
            >Versão legada: v{{ legacyVersion }}</span>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
// Colaboradores portados do "Sobre" original (Delphi, gpSobre em fmMenu.dfm —
// https://github.com/louvorja/desktop) — mesmo conteúdo já público na versão
// instalada por todos os usuários, só recriado aqui na tela nova em Vue.
const CONTRIBUTORS = [
  { name: 'Ido Rodrigues',                 email: 'idorodrigues@hotmail.com',          link: 'https://www.facebook.com/ido.rodrigues' },
  { name: 'Augusto Resende',               email: 'augusto.resende@outlook.com',       link: 'https://www.facebook.com/AugustoResendePublico' },
  { name: 'Neemias Lima',                  email: 'neemiasml@gmail.com',               link: 'https://www.facebook.com/neemias.iasdc' },
  { name: 'Gabriel Dutra Apolinário',      email: 'gabrieldutragv@hotmail.com',        link: 'https://www.facebook.com/G2brielD2tra1' },
  { name: 'Blog Daniel Gonçalves',         email: null,                                link: 'http://daniellocutor.com.br' },
  { name: 'Eleandro Borel',                email: null,                                link: 'https://www.facebook.com/lele.kmi' },
  { name: 'Caíque Marcel',                 email: 'caiquemarceldbv@gmail.com',         link: null },
  { name: 'Tiago Lima',                    email: 'tiagolimadbvs7@gmail.com',          link: 'https://www.facebook.com/tiago.nevesdelima' },
  { name: 'Carlos Eduardo',                email: 'carlos.lol.lol.lol@gmail.com',      link: 'https://www.facebook.com/carlos.lol.lol.lol' },
  { name: 'Natanael Rodrigues',            email: 'natosro@hotmail.com',               link: 'https://facebook.com/natanael.srodrigues' },
  { name: 'Alexandre Oliveira Melo',       email: 'flanguista51bis@hotmail.com',       link: 'https://www.facebook.com/alexandre.oliveiradossantos.54' },
  { name: 'Rogerio Figueira',              email: 'roger.figueira31@gmail.com',        link: 'https://www.facebook.com/roger.figueira.14' },
  { name: 'Edvaldo Cordeiro',              email: 'edvaldocostacordeiro@hotmail.com',  link: 'https://www.facebook.com/edvaldocostacordeiro' },
  { name: 'Elcio Silva',                   email: 'elciosilva.dbv@gmail.com',          link: 'https://www.facebook.com/elcio.silva.1422' },
  { name: 'Victor Hugo Ventura Rodrigues', email: 'victor_hugo_ventura@hotmail.com',   link: 'https://www.facebook.com/victor.hugo.ventura' },
];

export default {
  name: 'AboutDialog',
  data: () => ({
    dialog: false,
    currentVersion: '',
    legacyVersion: '',
    logoUrl: `${import.meta.env.BASE_URL}ico/favicon.svg`,
    contributors: CONTRIBUTORS,
    _aboutHandler: null,
  }),
  computed: {
    is_desktop() {
      return this.$appdata.get('is_desktop');
    },
  },
  mounted() {
    if (!this.$electron.isElectron()) return;

    this.$electron.getVersion?.().then(v => { this.currentVersion = v || ''; }).catch(() => {});

    // Aberto pelo menu nativo (Ajuda > Sobre o LouvorJA, ver electron/menu.js)
    this._aboutHandler = this.$electron.on('menu:about', () => this.open());

    // Busca a versão atual do LouvorJA original (Delphi) só como referência —
    // falha em silêncio (rede offline, rate-limit do GitHub) já que é só
    // informativo, sem afetar o resto do "Sobre".
    fetch('https://api.github.com/repos/louvorja/desktop/releases/latest')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.tag_name) this.legacyVersion = String(data.tag_name).replace(/^v/, '');
      })
      .catch(() => {});
  },
  beforeUnmount() {
    if (this._aboutHandler) this.$electron.off('menu:about', this._aboutHandler);
  },
  methods: {
    open() {
      this.dialog = true;
    },
    openExternal(url) {
      this.$electron.openExternal(url);
    },
    // Reaproveita o mesmo evento de janela que o Menu lateral já dispara
    // (ver App.vue, listener 'check-updates') — evita duplicar a lógica de
    // checagem/diálogo já implementada em UpdateDialog.vue.
    checkForUpdates() {
      window.dispatchEvent(new CustomEvent('check-updates'));
    },
  },
};
</script>

<style scoped>
.about-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
}
.about-body {
  max-height: 60vh;
  overflow-y: auto;
}
.about-section-title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  opacity: 0.65;
  margin-bottom: 6px;
}
.about-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  cursor: pointer;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-primary));
  width: fit-content;
}
.about-link:hover {
  text-decoration: underline;
}
.about-link--small {
  font-size: 0.78rem;
  opacity: 0.85;
}
.about-link--inline {
  display: inline-flex;
  margin-left: 4px;
}
.about-legacy {
  border-top: 1px dashed rgba(var(--v-theme-on-surface), 0.15);
  padding-top: 10px;
}
</style>
