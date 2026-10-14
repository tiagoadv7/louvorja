import $appdata from "@/helpers/AppData";
import $window from "@/helpers/Window";

let popup = null;

export default {
  async open(params) {
    if (typeof params != "object") {
      params = { module: params };
    }

    // Define o módulo antes de abrir para que a URL já carregue o módulo correto
    $appdata.set("popup_module", params.module);

    popup = $appdata.get("popup");
    if (popup && !popup.closed && !popup._electron) {
      if (typeof popup.focus === 'function') popup.focus();
    } else {
      const url = params.module ? `/popup?module=${params.module}` : "/popup";
      popup = $window.open(url, "PopupWindow", "width=800,height=600", params.displayId);
    }
    $appdata.set("popup", popup);
  },
  async exit() {
    $appdata.set("popup_module", "");
  },
  // Encerra o CONTEÚDO projetado, mas mantém a janela de saída aberta (em
  // branco/transparente) — evita fechar e ter que recriar a janela toda vez
  // que o operador liga/desliga a projeção de um módulo, o que causava um
  // flash/atraso visível no monitor físico. É o que o clique no ícone
  // principal do botão de tela usa pra "desligar".
  async close() {
    await this.exit();
  },
  // Fecha de fato a janela de saída — usado pelo item "Fechar" do menu do
  // botão de tela e por qualquer fluxo que precise realmente encerrar a
  // janela (ex.: trocar de monitor, ESC na própria projeção).
  async shutdown() {
    if (popup && popup._electron) {
      // No Electron, o stub não tem close() real — fecha via IPC
      $window.closeOutput();
    } else if (popup && !popup.closed) {
      popup.close();
    }
    await this.exit();
    $appdata.set("popup", null);
    popup = null;
  },
};
