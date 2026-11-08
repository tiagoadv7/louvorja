// Nome do programa conforme o idioma em que ele está rodando:
// português → "Louvor JA", espanhol → "Loor JA".
// Usado no título da janela (App.vue), no topo (layout/SystemBar.vue),
// na boas-vindas (WelcomeDialog.vue) e no "Sobre" (AboutDialog.vue).
const NAMES = {
  pt: { name: "Louvor JA", word: "LOUVOR" },
  es: { name: "Loor JA", word: "LOOR" },
};

export function appName(locale) {
  return (NAMES[locale] || NAMES.pt).name;
}

// Primeira parte do logotipo (a segunda é sempre "JA", em dourado)
export function appWord(locale) {
  return (NAMES[locale] || NAMES.pt).word;
}
