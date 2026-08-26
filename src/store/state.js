// Detecta Electron na inicialização do store (antes de qualquer render)
const _isElectron = typeof navigator !== 'undefined' && /Electron\//.test(navigator.userAgent);

export default {
  is_dev: false,
  is_dark: false,
  is_popup: false,
  is_mobile: false,
  is_desktop: _isElectron,
  is_online: !_isElectron,
  popup: null,
  popup_module: null,
  import_modules: false,
  loading: false,
  modules: {},
  module_group: {
    musics: {
      title: "module_group.musics.title",
      icon: "mdi-music",
      modules: ["musics", "hymnal", "hymnal_1996"],
    },
    bible: {
      title: "module_group.bible.title",
      icon: "mdi-book-cross",
      modules: [],
    },
    utilities: {
      title: "module_group.utilities.title",
      icon: "mdi-toolbox-outline",
      modules: [],
    },
  },
  menu: {
    show: false,
    modules: [],
  },
  tray_area: {
    modules: [],
  },
  languages: {
    pt: { name: "Português", flag: "br" },
    es: { name: "Español", flag: "es" },
  },
  alert: {
    show: false,
    title: "",
    text: "",
    error: "",
    color: "",
    buttons: [],
    value: "",
    translate: false,
  },
  user_data: {
    theme: "",
    language: "",
    layout: "apps",
    remote: {
      is_connected: false,
      url: "",
      token: "",
    },
    modules: {
      musics: {
        search: {
          name: true,
          lyric: false,
          album: false,
          track: false,
        },
        filter: {
          instrumental_music: false,
        },
      },
      media: {
        lazy_load: true,
        fade_audio: true,
      },
    },
  },
};
