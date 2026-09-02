<template>
  <v-tooltip v-if="is_desktop" location="bottom">
    <template v-slot:activator="{ props }">
      <v-btn v-bind="props" icon="mdi-information-outline" @click="open" />
    </template>
    Sobre o Louvor JA
  </v-tooltip>

  <!-- Mesma "janela de módulo" (Window.vue) usada pela aba Coletâneas —
       cabeçalho com ícone/título/fechar e corpo rolável, em vez do antigo
       popup pequeno, pra ficar visualmente consistente com o resto do app.
       Conteúdo segue de perto o "Sobre" original em Delphi (cabeçalho
       simples, linhas de link com ícone, duas colunas separadas por um
       traço vertical) — de propósito diferente do layout em cards do
       violin-app. -->
  <Window
    v-model="dialog"
    title="Sobre"
    icon="mdi-information-outline"
    closable
    width="1000"
    @close="dialog = false"
    @minimize="dialog = false"
  >
    <div class="about-hero">
      <v-img :src="logoUrl" class="about-logo" />
      <div class="about-product">Louvor JA</div>
    </div>
    <div class="about-meta">
      <div>Versão: <b>{{ currentVersion || '...' }}</b><span v-if="is_desktop"> ({{ buildInfo }}<span v-if="platformLabel"> · {{ platformLabel }}</span>)</span></div>
      <div class="about-meta-note">Este programa não pode ser vendido!</div>
    </div>

    <v-divider class="my-4" />

    <div class="about-columns">
      <!-- Coluna esquerda: links + destaques (Desenvolvedor/Patrocinadores) -->
      <div class="about-col-left">
        <div class="about-section-title">Contato / Sites / Redes Sociais:</div>
        <a class="about-mini-link about-mini-link--lg" @click="openExternal('mailto:contato@louvorja.com.br')">
          <v-icon size="15">mdi-email-outline</v-icon> contato@louvorja.com.br
        </a>
        <a class="about-mini-link about-mini-link--lg" @click="openExternal('https://www.facebook.com/louvorja')">
          <v-icon size="15" color="blue">mdi-facebook</v-icon> facebook.com/louvorja
        </a>
        <a class="about-mini-link about-mini-link--lg" @click="openExternal('https://www.instagram.com/louvorja.app')">
          <v-icon size="15" color="purple">mdi-instagram</v-icon> instagram.com/louvorja.app
        </a>
        <a class="about-mini-link about-mini-link--lg" @click="openExternal('https://louvorja.com.br/')">
          <v-icon size="15">mdi-web</v-icon> louvorja.com.br
        </a>
        <a class="about-mini-link about-mini-link--lg" @click="openExternal('https://www.louvorja.com.br/whatsapp')">
          <v-icon size="15" color="green">mdi-whatsapp</v-icon> Whatsapp
        </a>
        <a class="about-mini-link about-mini-link--lg" @click="openExternal('https://louvorja.com.br/telegram')">
          <v-icon size="15" color="blue" class="mdi-rotate-315">mdi-send</v-icon> Telegram
        </a>

        <div class="about-section-title mt-4">LouvorJA On-line</div>
        <a class="about-mini-link about-mini-link--lg" @click="openExternal('https://app.louvorja.com.br')">
          <v-icon size="15">mdi-web</v-icon> app.louvorja.com.br
        </a>
        <a class="about-mini-link about-mini-link--lg" @click="checkForUpdates">
          <v-icon size="15" color="primary">mdi-cloud-refresh-outline</v-icon> Verificar atualizações
        </a>
        <a class="about-mini-link about-mini-link--lg" @click="openExternal('https://github.com/tiagoadv7/louvorja/issues')">
          <v-icon size="15" color="orange">mdi-bug-outline</v-icon> Enviar Feedback
        </a>

        <template v-if="mainDev">
          <div class="about-section-title about-block-sep">Desenvolvedor da Coletânea:</div>
          <div class="about-collab">
            <div class="about-collab-name">{{ mainDev.name }}</div>
            <a
              v-for="(l, i) in contributorLinks(mainDev)"
              :key="i"
              class="about-mini-link"
              @click="openExternal(l.url)"
            >
              <v-icon size="13" :color="l.color">{{ l.icon }}</v-icon> {{ l.label }}
            </a>
          </div>
        </template>

        <template v-if="sponsors.length > 0">
          <div class="about-section-title about-block-sep">Patrocinadores:</div>
          <div v-for="s in sponsors" :key="s.name" class="about-collab">
            <div class="about-collab-name">
              {{ s.name }}<span v-if="s.description" class="about-collab-role"> - {{ s.description }}</span>
            </div>
            <a
              v-for="(l, i) in contributorLinks(s)"
              :key="i"
              class="about-mini-link"
              @click="openExternal(l.url)"
            >
              <v-icon size="13" :color="l.color">{{ l.icon }}</v-icon> {{ l.label }}
            </a>
          </div>
        </template>
      </div>

      <div class="about-col-divider" />

      <!-- Coluna direita: um único "Colaboradores" com todas as demais
           categorias, mesmo formato de lista simples do Sobre original. -->
      <div class="about-col-right">
        <h2 class="about-section-title about-section-title--h2">Colaboradores:</h2>
        <template v-for="cat in otherCategories" :key="cat.name">
          <h3 v-if="cat.contributors.length > 0" class="about-category-title">{{ cat.name }}:</h3>
          <div v-for="person in cat.contributors" :key="person.name" class="about-collab">
            <div class="about-collab-name">
              {{ person.name }}<span v-if="roleText(person.description)" class="about-collab-role"> - {{ roleText(person.description) }}</span>
            </div>
            <a
              v-for="(l, i) in contributorLinks(person)"
              :key="i"
              class="about-mini-link"
              @click="openExternal(l.url)"
            >
              <v-icon size="13" :color="l.color">{{ l.icon }}</v-icon> {{ l.label }}
            </a>
          </div>
        </template>
      </div>
    </div>

    <div v-if="legacyVersion" class="about-legacy">
      Louvor JA é a modernização do LouvorJA original (Delphi).
      <span class="about-link--inline" @click="openExternal('https://github.com/louvorja/desktop/releases')">
        Versão legada: v{{ legacyVersion }}
      </span>
    </div>
  </Window>
</template>

<script>
import Window from "@/components/Window.vue";
import { CONTRIBUTORS } from "@/config/Contributors";
import { contributorLinks } from "@/helpers/ContributorLinks";

// Categorias mostradas como destaque na coluna da esquerda (compactas) —
// as demais vão pra lista de "Colaboradores" na coluna direita, igual ao
// Sobre original em Delphi (duas colunas só, sem coluna extra).
const LEFT_CATEGORIES = ["Desenvolvedor da Coletânea", "Patrocinadores"];

export default {
  name: 'AboutDialog',
  components: {
    Window,
  },
  data: () => ({
    dialog: false,
    currentVersion: '',
    electronVersion: '',
    osPlatform: '',
    legacyVersion: '',
    logoUrl: `${import.meta.env.BASE_URL}ico/favicon.svg`,
    contributors: CONTRIBUTORS,
    _aboutHandler: null,
  }),
  computed: {
    is_desktop() {
      return this.$appdata.get('is_desktop');
    },
    buildInfo() {
      if (!this.is_desktop) return 'Web';
      const parts = ['Desktop'];
      if (this.electronVersion) parts.push(`Electron ${this.electronVersion}`);
      return parts.join(' · ');
    },
    platformLabel() {
      const map = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
      return map[this.osPlatform] || (this.is_desktop ? 'Desktop' : 'Navegador');
    },
    mainDev() {
      return this.contributors.find(c => c.name === 'Desenvolvedor da Coletânea')?.contributors[0] || null;
    },
    sponsors() {
      return this.contributors.find(c => c.name === 'Patrocinadores')?.contributors || [];
    },
    otherCategories() {
      return this.contributors.filter(c => !LEFT_CATEGORIES.includes(c.name));
    },
  },
  mounted() {
    if (!this.$electron.isElectron()) return;

    this.$electron.getVersion?.().then(v => { this.currentVersion = v || ''; }).catch(() => {});
    this.$electron.getOS?.().then(v => { this.osPlatform = v || ''; }).catch(() => {});
    Promise.resolve(this.$electron.getElectronVersion?.()).then(v => { this.electronVersion = v || ''; }).catch(() => {});

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
    // Sem isso os links abriam numa janela do Electron dentro do próprio
    // app (não há setWindowOpenHandler nas BrowserWindow do main.js), em
    // vez do navegador padrão do sistema — daí sempre passar por aqui em
    // vez de usar href/target="_blank" direto no template.
    openExternal(url) {
      this.$electron.openExternal(url);
    },
    contributorLinks,
    // "description" tanto pode ser um texto simples (Patrocinadores/Assets)
    // quanto uma lista de papéis (Desenvolvedores, ex.: ["Web", "Electron"])
    // — ver src/config/Contributors.js.
    roleText(description) {
      if (!description) return '';
      return Array.isArray(description) ? description.join(', ') : description;
    },
    // Reaproveita o mesmo evento de janela que o Menu lateral já dispara
    // (ver App.vue, listener 'check-updates') — evita duplicar a lógica de
    // checagem/diálogo já implementada em UpdateDialog.vue.
    checkForUpdates() {
      this.dialog = false;
      window.dispatchEvent(new CustomEvent('check-updates'));
    },
  },
};
</script>

<style scoped>
.about-hero {
  display: flex;
  align-items: center;
  gap: 12px;
}

.about-logo {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
}

.about-product {
  font-size: 26px;
  font-weight: 400;
  color: rgba(var(--v-theme-on-surface), 0.87);
}

.about-meta {
  margin-top: 12px;
  font-size: 0.82rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  line-height: 1.8;
}
.about-meta-note {
  font-style: italic;
  color: rgba(var(--v-theme-on-surface), 0.5);
}

/* Duas colunas, no espírito do "Sobre" original: links/destaques à
   esquerda (coluna estreita e fixa), lista de colaboradores à direita,
   separadas por um traço vertical fino. */
.about-columns {
  display: flex;
  align-items: stretch;
  gap: 24px;
}

.about-col-left {
  flex: 1 1 0;
  min-width: 0;
}

.about-col-divider {
  flex: 0 0 1px;
  align-self: stretch;
  background: rgba(var(--v-theme-on-surface), 0.12);
}

.about-col-right {
  flex: 1 1 0;
  min-width: 0;
}

.about-link--inline {
  display: inline-flex;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
}
.about-link--inline:hover {
  text-decoration: underline;
}

.about-collab {
  margin-bottom: 26px;
}
.about-collab-name {
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.3;
}
.about-collab-role {
  font-size: 0.78rem;
  font-weight: 400;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.about-mini-link {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 4px 0 0 6px;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
  font-size: 0.75rem;
  line-height: 1.4;
  cursor: pointer;
  /* Quebra a linha em vez de truncar com "…" — o texto completo do link
     (e-mail, URL) fica visível, mesmo comprido. */
  overflow-wrap: anywhere;
}
.about-mini-link :deep(.v-icon) {
  flex-shrink: 0;
  margin-top: 1px;
}
.about-mini-link:hover {
  opacity: 0.7;
}
/* Links de topo (contato/site) — sem o recuo/indent dos links por pessoa. */
.about-mini-link--lg {
  margin-left: 0;
  font-size: 0.83rem;
  margin-top: 4px;
}

.about-section-title {
  font-size: 0.84rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.75);
  margin: 0 0 10px;
}
.about-section-title.mt-4 {
  margin-top: 16px;
}
/* Traço pontilhado antes de cada bloco novo (Desenvolvedor/Patrocinadores),
   igual ao "Sobre" original em Delphi. */
.about-block-sep {
  border-top: 1px dashed rgba(var(--v-theme-on-surface), 0.15);
  margin-top: 18px;
  padding-top: 14px;
}
.about-category-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin: 26px 0 14px;
}

.about-section-title--h2 {
  font-size: 1.1rem;
  margin-bottom: 16px;
}

.about-legacy {
  border-top: 1px dashed rgba(var(--v-theme-on-surface), 0.15);
  margin-top: 20px;
  padding-top: 12px;
  font-size: 0.78rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
</style>
