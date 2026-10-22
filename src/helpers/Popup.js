import $appdata from "@/helpers/AppData";
import $window from "@/helpers/Window";
import $electron from "@/helpers/Electron";
import $alert from "@/helpers/Alert";

let popup = null;

export default {
  async open(params) {
    if (typeof params != "object") {
      params = { module: params };
    }

    // Confirma antes de abrir a projeção do ZERO (não quando já tem algo
    // projetando e só está trocando de módulo/conteúdo -- ver isOutputOpen()
    // abaixo) se não existir nenhuma segunda tela conectada. Sem isso, a
    // projeção abria sem aviso nenhum em cima da própria tela do operador
    // (a janela de saída cobre a tela toda). A dialog "Tela de Projeção"
    // (MonitorArrangementDialog.vue#lock) já nem deixa marcar a principal
    // como saída nesse caso -- este aviso aqui é o reforço pra quando a
    // projeção abre de outro jeito (clicar numa música etc.), sem passar por
    // aquela escolha explícita.
    if ($electron.isElectron() && !(await $electron.isOutputOpen())) {
      const screens = await $electron.getScreens();
      const hasExternal = screens.some((s) => !s.primary);
      if (!hasExternal) {
        const confirmed = await new Promise((resolve) => {
          $alert.yesno(
            {
              text: "Nenhuma segunda tela foi encontrada — a projeção vai abrir na mesma tela do computador. Deseja projetar assim mesmo?",
              translate: false,
            },
            (btn) => resolve(btn === "yes")
          );
        });
        if (!confirmed) return;
      }
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
