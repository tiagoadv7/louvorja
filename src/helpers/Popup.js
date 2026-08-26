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
  async close() {
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
