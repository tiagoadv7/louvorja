// Projeção em camadas e multiviewer do retorno (mesma ideia da "projeção
// independente" do Piano-Louvor-JA/app).
//
// • Projeção principal — "projection_layers" ({ [módulo]: "overlay" | "share" }):
//   um módulo (Relógio, Bíblia...) entra JUNTO com o que já está projetado,
//   sem trocar o popup_module: "overlay" cobre a tela toda por cima (ao
//   desligar, a música que continuou por baixo reaparece na hora) e "share"
//   divide a tela — o que está projetado fica à esquerda e a camada à direita.
//   Quem desenha é views/Popup.vue.
//
// • Retorno — "return_multiview" ([módulos]): módulos mostrados JUNTOS no
//   retorno, em mosaico (letra + relógio + Bíblia...). Quem desenha é
//   views/ReturnScreen.vue.
import $appdata from "@/helpers/AppData";

const LAYERS = "projection_layers";
const MULTIVIEW = "return_multiview";

function plainLayers() {
  return { ...($appdata.get(LAYERS) || {}) };
}

export default {
  // ── Camadas da projeção principal ──────────────────────────────────────
  getLayers() {
    return plainLayers();
  },
  layerMode(module) {
    return plainLayers()[module] || null;
  },
  setLayer(module, mode) {
    const layers = plainLayers();
    if (mode) layers[module] = mode;
    else delete layers[module];
    $appdata.set(LAYERS, layers);
  },
  clearLayer(module) {
    this.setLayer(module, null);
  },
  clearAllLayers() {
    $appdata.set(LAYERS, {});
  },

  // ── Multiviewer do retorno ─────────────────────────────────────────────
  getMultiview() {
    return [...($appdata.get(MULTIVIEW) || [])];
  },
  inMultiview(module) {
    return this.getMultiview().includes(module);
  },
  toggleMultiview(module) {
    const list = this.getMultiview();
    $appdata.set(MULTIVIEW, list.includes(module) ? list.filter((m) => m !== module) : [...list, module]);
  },
  removeFromMultiview(module) {
    $appdata.set(MULTIVIEW, this.getMultiview().filter((m) => m !== module));
  },
};
