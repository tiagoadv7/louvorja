import { createApp, nextTick } from "vue";
import App from "./App.vue";
import router from "./router";
import vuetify from "./plugins/vuetify";
import store from "./store";
import { loadFonts } from "./plugins/webfontloader";
import { createI18nInstance } from "./i18n";
import shortkey from "vue3-shortkey";
import VueFullscreen from "vue-fullscreen";
import "./assets/styles/main.css";
import "./assets/styles/fonts.css";
import "./assets/styles/layout.scss";

loadFonts();

const app = createApp(App);

//Modules
import ModuleManager from "@/helpers/ModuleManager";

//Helpers
import Modules from "@/helpers/Modules";
import Dev from "@/helpers/Dev";
import String from "@/helpers/String";
import UserData from "@/helpers/UserData";
import AppData from "@/helpers/AppData";
import DateTime from "@/helpers/DateTime";
import Theme from "@/helpers/Theme";
import Path from "@/helpers/Path";
import Media from "@/helpers/Media";
import VideoPlayer from "@/helpers/VideoPlayer";
import SoundMaster from "@/helpers/SoundMaster";
import SlideEditorPlayer from "@/helpers/SlideEditorPlayer";
import Alert from "@/helpers/Alert";
import Popup from "@/helpers/Popup";
import WebLink from "@/helpers/WebLink";
import Database from "@/helpers/Database";
import Electron from "@/helpers/Electron";

app.mixin({
  beforeCreate() {
    this.$userdata = UserData;
    this.$appdata = AppData;
    this.$modules = Modules;
    this.$dev = Dev;
    this.$string = String;
    this.$datetime = DateTime;
    this.$theme = Theme;
    this.$path = Path;
    this.$media = Media;
    this.$videoPlayer = VideoPlayer;
    this.$soundMaster = SoundMaster;
    this.$slideEditor = SlideEditorPlayer;
    this.$alert = Alert;
    this.$popup = Popup;
    this.$webLink = WebLink;
    this.$database = Database;
    this.$electron = Electron;
  },
});


app.use(router);
app.use(vuetify);
app.use(store);
app.use(shortkey, { prevent: ["input", "textarea"] });
app.use(VueFullscreen);

// Marca "is_popup" JÁ AQUI (antes de ModuleManager.init() logo abaixo) pra
// qualquer janela que não seja a principal (saída, retorno, PIP — identificadas
// pelo hash com que electron/main.js carrega cada uma via loadURL). Sem isso,
// is_popup só virava true no mounted() de cada view (Popup.vue/ReturnScreen.vue/
// VideoPip.vue), bem depois — e o registro inicial dos módulos que
// ModuleManager.init() faz (AppData.set com show:false padrão, ver
// ModuleManager.js#installModule) rodava antes disso e vazava por IPC
// (AppData.js#set só bloqueia o reenvio quando is_popup já é true), sobrescrevendo
// o estado real de QUALQUER outra janela já aberta — ex.: abrir/atualizar a Tela
// de Retorno enquanto a saída principal já projetava uma música fazia a
// projeção "encerrar" sozinha, sem o usuário ter fechado nada.
const POPUP_HASHES = ['#/popup', '#/return-screen', '#/video-pip'];
if (POPUP_HASHES.some((h) => window.location.hash.startsWith(h))) {
  AppData.set('is_popup', true);
}

createI18nInstance().then(async (i18n) => {
  app.use(i18n);
  // Carrega os dados persistidos ANTES do ModuleManager instalar os módulos —
  // ModuleManager.init() usa $userdata.setIfNull() pra preencher o customization
  // de cada módulo com o valor padrão só quando ainda não foi definido. Sem
  // isso aqui, numa janela nova (saída, retorno, PIP) o $appdata dela começa
  // vazio e setIfNull acharia que não há valor definido e GRAVARIA o padrão
  // por cima da personalização real (ex.: cor) de outras janelas já abertas.
  // (o retransmite em si já é bloqueado agora pelo "is_popup" marcado mais
  // acima, antes deste bloco — ver comentário logo ali — mas carregar
  // primeiro evita depender só disso.)
  UserData.load();
  await ModuleManager.init(i18n);
  app.mount("#app");
  await nextTick();
  window.electron?.appLoaded?.();
}).catch((err) => {
  console.error('[App] Erro na inicialização:', err);
  // Garante que a loading window feche mesmo em caso de erro,
  // para não travar o app com a janela de carregamento presa na frente
  window.electron?.appLoaded?.();
});
