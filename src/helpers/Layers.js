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
  addToMultiview(module) {
    const list = this.getMultiview();
    if (!list.includes(module)) $appdata.set(MULTIVIEW, [...list, module]);
  },

  // ── Retorno: Sobrepor / Dividir / Desligado (mesmas opções da principal) ──
  // Sobrepor = "return_popup_module" (tela inteira no retorno, por cima do
  // que ele espelharia); Dividir = entra no mosaico do multiviewer.
  returnMode(module) {
    if ($appdata.get("return_popup_module") === module) return "overlay";
    if (this.inMultiview(module)) return "share";
    return null;
  },
  setReturnMode(module, mode) {
    if (mode === "overlay") {
      this.removeFromMultiview(module);
      $appdata.set("return_popup_module", module);
      return;
    }
    if ($appdata.get("return_popup_module") === module) $appdata.set("return_popup_module", "");
    if (mode === "share") this.addToMultiview(module);
    else this.removeFromMultiview(module);
  },

  // ── Mosaico (mesmo desenho na principal e no retorno) ─────────────────
  // Posição em % do quadro i de n: 2 = lado a lado; 3 = o primeiro à
  // esquerda inteiro + 2 empilhados à direita; 4 ou mais = grade.
  tileRect(i, n) {
    if (i < 0 || n < 2) return null;
    if (n === 2) return { x: i * 50, y: 0, w: 50, h: 100 };
    if (n === 3) return i === 0 ? { x: 0, y: 0, w: 50, h: 100 } : { x: 50, y: (i - 1) * 50, w: 50, h: 50 };
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    return { x: (i % cols) * (100 / cols), y: Math.floor(i / cols) * (100 / rows), w: 100 / cols, h: 100 / rows };
  },
  tileStyle(i, n, gapPx = 3) {
    const r = this.tileRect(i, n);
    if (!r) return null;
    return {
      position: "absolute",
      left: `calc(${r.x}% + ${gapPx}px)`,
      top: `calc(${r.y}% + ${gapPx}px)`,
      width: `calc(${r.w}% - ${gapPx * 2}px)`,
      height: `calc(${r.h}% - ${gapPx * 2}px)`,
      right: "auto",
      bottom: "auto",
    };
  },
};
