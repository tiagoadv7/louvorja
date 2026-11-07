<template>
  <!-- Boas-vindas logo após o load: escolha do idioma em que o programa vai
       rodar (já aplicado na hora) e o nome do distrito e da igreja. Aparece na
       primeira abertura; depois, pelo menu da bandeira (evento "open-welcome"). -->
  <v-dialog v-model="dialog" max-width="560" persistent content-class="wl-dialog">
    <v-card class="lja-glass wl-card" theme="dark" rounded="xl" elevation="16">
      <div class="wl-glow" />

      <div class="wl-head">
        <div class="wl-logo">LOUVOR<span>JA</span></div>
        <div class="wl-welcome">
          <span :class="{ on: lang === 'pt' }">Bem-vindo</span>
          <span class="wl-dot">•</span>
          <span :class="{ on: lang === 'es' }">Bienvenido</span>
        </div>
        <div class="wl-sub">{{ tx.chooseLang }}</div>
      </div>

      <div class="wl-langs">
        <button
          v-for="(l, key) in langs"
          :key="key"
          type="button"
          class="wl-lang"
          :class="{ 'wl-lang--on': lang === key }"
          @click="setLang(key)"
        >
          <country-flag :country="l.flag" size="big" class="wl-flag" />
          <span class="wl-lang-name">{{ l.name }}</span>
          <v-icon v-if="lang === key" size="20" class="wl-check">mdi-check-circle</v-icon>
        </button>
      </div>

      <div class="wl-fields">
        <label class="wl-field">
          <span>{{ tx.district }}</span>
          <div class="wl-input">
            <v-icon size="18">mdi-map-marker-radius-outline</v-icon>
            <input v-model.trim="district" :placeholder="tx.districtPh" maxlength="80" />
          </div>
        </label>
        <label class="wl-field">
          <span>{{ tx.church }}</span>
          <div class="wl-input">
            <v-icon size="18">mdi-church-outline</v-icon>
            <input v-model.trim="church" :placeholder="tx.churchPh" maxlength="80" @keyup.enter="finish" />
          </div>
        </label>
      </div>

      <div class="wl-actions">
        <button type="button" class="wl-start" @click="finish">
          {{ tx.start }}
          <v-icon size="18">mdi-arrow-right</v-icon>
        </button>
      </div>
    </v-card>
  </v-dialog>
</template>

<script>
import CountryFlag from "vue-country-flag-next";

const TEXTS = {
  pt: {
    chooseLang: "Escolha o idioma em que o LouvorJA vai rodar",
    district: "Distrito",
    districtPh: "Nome do distrito",
    church: "Igreja",
    churchPh: "Nome da igreja",
    start: "Começar",
  },
  es: {
    chooseLang: "Elija el idioma en que LouvorJA funcionará",
    district: "Distrito",
    districtPh: "Nombre del distrito",
    church: "Iglesia",
    churchPh: "Nombre de la iglesia",
    start: "Comenzar",
  },
};

export default {
  name: "WelcomeDialog",
  components: { CountryFlag },

  data: () => ({
    dialog: false,
    lang: "pt",
    district: "",
    church: "",
  }),

  computed: {
    langs() {
      return this.$appdata.get("languages") || { pt: { name: "Português", flag: "br" }, es: { name: "Español", flag: "es" } };
    },
    tx() {
      return TEXTS[this.lang] || TEXTS.pt;
    },
  },

  methods: {
    // Abre se a boas-vindas ainda não foi concluída (ou force=true pelo menu).
    // Resolve quando o operador fecha — App.vue espera isso antes de mostrar
    // os outros avisos do início (novidades, verificação de arquivos).
    open(force = false) {
      if (!force && this.$userdata.get("welcome_done")) return Promise.resolve(false);
      const saved = this.$userdata.get("church") || {};
      this.district = saved.district || "";
      this.church = saved.name || "";
      const current = this.$i18n?.locale?.value || this.$i18n?.locale || "pt";
      this.lang = current === "es" ? "es" : "pt";
      this.dialog = true;
      return new Promise((resolve) => { this._resolve = resolve; });
    },
    // O idioma vale na hora: o programa já passa a rodar nele
    setLang(key) {
      this.lang = key;
      this.$i18n.locale = key;
      this.$userdata.set("language", key);
    },
    finish() {
      this.$userdata.set("church", { district: this.district, name: this.church });
      this.$userdata.set("welcome_done", true);
      this.dialog = false;
      this._resolve?.(true);
      this._resolve = null;
    },
  },
};
</script>

<style scoped>
.wl-card {
  position: relative;
  overflow: hidden;
  padding: 30px 30px 26px;
}
/* Mesmo brilho girando do load inicial (public/loading.html) */
.wl-glow {
  position: absolute;
  top: -120px;
  left: 50%;
  width: 360px;
  height: 360px;
  margin-left: -180px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(248, 200, 0, 0.32) 0%, rgba(0, 151, 215, 0.18) 45%, transparent 70%);
  filter: blur(6px);
  animation: wl-pulse 4s ease-in-out infinite;
  pointer-events: none;
}
@keyframes wl-pulse {
  0%, 100% { opacity: 0.7; transform: scale(0.95); }
  50% { opacity: 1; transform: scale(1.05); }
}
.wl-head {
  position: relative;
  text-align: center;
  margin-bottom: 22px;
}
.wl-logo {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: 2px;
  color: #eef2f8;
}
.wl-logo span { color: #f8c800; }
.wl-welcome {
  margin-top: 8px;
  font-size: 20px;
  font-weight: 600;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: rgba(238, 244, 255, 0.45);
}
.wl-welcome .on { color: #fff; }
.wl-welcome span { transition: color 0.25s; }
.wl-dot { color: #0097d7; }
.wl-sub {
  margin-top: 6px;
  font-size: 13px;
  color: #91a9c6;
}
.wl-langs {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 22px;
}
.wl-lang {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 10px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #eef4ff;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, transform 0.2s;
}
.wl-lang:hover { transform: translateY(-2px); border-color: rgba(0, 151, 215, 0.5); }
.wl-lang--on {
  border-color: #0097d7;
  background: rgba(0, 151, 215, 0.16);
  box-shadow: 0 6px 20px rgba(0, 151, 215, 0.25);
}
.wl-flag { margin: 0 !important; }
.wl-lang-name { font-size: 15px; font-weight: 600; }
.wl-check { position: absolute; top: 8px; right: 8px; color: #f8c800; }
.wl-fields {
  position: relative;
  display: grid;
  gap: 12px;
}
.wl-field > span {
  display: block;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #91a9c6;
  margin-bottom: 6px;
}
.wl-input {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.18);
  color: #91a9c6;
}
.wl-input:focus-within { border-color: #0097d7; }
.wl-input input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: #fff;
  font-size: 14px;
}
.wl-actions {
  position: relative;
  display: flex;
  justify-content: flex-end;
  margin-top: 22px;
}
.wl-start {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 22px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(90deg, #0097d7, #0054d8);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(0, 84, 216, 0.35);
  transition: transform 0.15s, box-shadow 0.15s;
}
.wl-start:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(0, 84, 216, 0.45); }
</style>
