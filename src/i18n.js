import { createI18n } from "vue-i18n";

const loadLocaleMessages = async () => {
  const locales = ["pt", "es"];
  const messages = {};

  for (const locale of locales) {
    const mod = await import(`./lang/${locale}.json`);
    messages[locale] = mod.default || mod;
  }

  return messages;
};

export const createI18nInstance = async () => {
  const messages = await loadLocaleMessages();

  return createI18n({
    legacy: false,
    globalInjection: true,
    locale: "pt",
    fallbackLocale: "pt",
    messages,
  });
};

// export default i18n;
export default createI18nInstance;
