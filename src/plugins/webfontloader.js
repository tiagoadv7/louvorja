/**
 * plugins/webfontloader.js
 *
 * webfontloader documentation: https://github.com/typekit/webfontloader
 */

export async function loadFonts () {
  if (!navigator.onLine) return;
  try {
    const webFontLoader = await import(/* webpackChunkName: "webfontloader" */'webfontloader')
    webFontLoader.load({
      google: {
        families: ['Roboto:100,300,400,500,700,900&display=swap'],
      },
    })
  } catch (_) {
    // sem conexão — usa roboto-fontface bundled
  }
}
