<template>
  <v-tooltip v-if="is_desktop" location="bottom">
    <template v-slot:activator="{ props }">
      <v-btn v-bind="props" icon="mdi-information-outline" @click="open" />
    </template>
    Sobre o Louvor JA
  </v-tooltip>

  <!-- Mesma "janela de módulo" (Window.vue) usada pela aba Coletâneas —
       cabeçalho com ícone/título/fechar e corpo rolável, em vez do antigo
       popup pequeno, pra ficar visualmente consistente com o resto do app. -->
  <Window v-model="dialog" title="Sobre" icon="mdi-information-outline" closable>
    <div class="about-hero">
      <v-avatar size="80" color="primary" variant="tonal" class="about-logo">
        <v-img :src="logoUrl" />
      </v-avatar>
      <div class="about-hero-text">
        <div class="about-product">Louvor <b>JA</b></div>
        <div class="about-tagline">Sistema de apresentação para cultos e eventos religiosos</div>
        <div class="about-credits">Desenvolvido com <v-icon size="13" color="red">mdi-heart</v-icon> para a comunidade Adventista.</div>
      </div>

      <div class="about-info">
        <div class="about-info-row">
          <span class="about-info-label">Versão</span>
          <span class="about-info-value">{{ currentVersion || '...' }}</span>
        </div>
        <div class="about-info-row">
          <span class="about-info-label">Build</span>
          <span class="about-info-value">{{ buildInfo }}</span>
        </div>
        <div class="about-info-row">
          <span class="about-info-label">Plataforma</span>
          <span class="about-info-value">{{ platformLabel }}</span>
        </div>
      </div>
    </div>

    <v-divider class="my-4" />

    <div class="about-actions">
      <a class="about-link" @click="openExternal('https://louvorja.com.br/')">
        <v-icon size="16">mdi-web</v-icon>
        Website
      </a>
      <a class="about-link" @click="openExternal('https://app.louvorja.com.br')">
        <v-icon size="16">mdi-cast-variant</v-icon>
        LouvorJA On-line
      </a>
      <a class="about-link" @click="openExternal('mailto:contato@louvorja.com.br')">
        <v-icon size="16">mdi-email-outline</v-icon>
        Email
      </a>
      <a class="about-link" @click="openExternal('https://www.facebook.com/louvorja')">
        <v-icon size="16" color="blue">mdi-facebook</v-icon>
        Facebook
      </a>
      <a class="about-link" @click="openExternal('https://www.instagram.com/louvorja.app')">
        <v-icon size="16" color="purple">mdi-instagram</v-icon>
        Instagram
      </a>
      <a class="about-link" @click="openExternal('https://www.louvorja.com.br/whatsapp')">
        <v-icon size="16" color="green">mdi-whatsapp</v-icon>
        Whatsapp
      </a>
      <a class="about-link" @click="openExternal('https://louvorja.com.br/telegram')">
        <v-icon size="16" color="blue" class="mdi-rotate-315">mdi-send</v-icon>
        Telegram
      </a>
      <a class="about-link" @click="checkForUpdates">
        <v-icon size="16" color="primary">mdi-cloud-refresh-outline</v-icon>
        Verificar atualizações
      </a>
      <a class="about-link" @click="openExternal('https://github.com/tiagoadv7/louvorja/issues')">
        <v-icon size="16" color="orange">mdi-bug-outline</v-icon>
        Enviar Feedback
      </a>
    </div>

    <v-divider class="my-5" />

    <h2 class="about-section-title">Contribuidores</h2>

    <template v-for="cat in contributors" :key="cat.name">
      <h3 v-if="cat.contributors.length > 0" class="about-category-title">{{ cat.name }}</h3>
      <v-row>
        <ContributorCard
          v-for="contrib in cat.contributors"
          :key="contrib.name"
          :contributor="contrib"
        />
      </v-row>
    </template>

    <div v-if="legacyVersion" class="about-legacy">
      Louvor JA é a modernização do LouvorJA original (Delphi).
      <span class="about-link about-link--inline" @click="openExternal('https://github.com/louvorja/desktop/releases')">
        Versão legada: v{{ legacyVersion }}
      </span>
    </div>
  </Window>
</template>

<script>
import Window from "@/components/Window.vue";
import ContributorCard from "@/components/ContributorCard.vue";
import { CONTRIBUTORS } from "@/config/Contributors";

export default {
  name: 'AboutDialog',
  components: {
    Window,
    ContributorCard,
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
    openExternal(url) {
      this.$electron.openExternal(url);
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
  gap: 20px;
  flex-wrap: wrap;
}

.about-logo {
  flex-shrink: 0;
}

.about-hero-text {
  min-width: 0;
  flex: 1 1 260px;
}

.about-product {
  font-size: 28px;
  font-weight: 300;
  margin: 0;
  letter-spacing: -0.01em;
}
.about-product b {
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}

.about-tagline {
  font-size: 0.9rem;
  color: rgba(var(--v-theme-on-surface), 0.65);
  margin-top: 4px;
}

.about-credits {
  font-size: 0.78rem;
  font-style: italic;
  color: rgba(var(--v-theme-on-surface), 0.55);
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.about-info {
  flex: 0 0 auto;
  min-width: 280px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  padding: 4px 16px;
}

.about-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  font-size: 0.85rem;
}
.about-info-row:last-child {
  border-bottom: none;
}
.about-info-label {
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.about-info-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.about-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.about-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.8rem;
  font-weight: 600;
  padding: 6px 12px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.about-link:hover {
  background: rgba(var(--v-theme-on-surface), 0.1);
  border-color: rgb(var(--v-theme-primary));
}
.about-link--inline {
  display: inline-flex;
  margin-left: 4px;
  padding: 2px 8px;
}

.about-section-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0 0 10px;
}

.about-category-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin: 20px 0 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}

.about-legacy {
  border-top: 1px dashed rgba(var(--v-theme-on-surface), 0.15);
  margin-top: 16px;
  padding-top: 12px;
  font-size: 0.78rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
</style>
