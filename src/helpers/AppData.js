import store from "@/store";

export default {
  set(param, value) {
    store.commit("setData", [param, value]);

    // Sincroniza com a janela de saída via postMessage (somente no navegador)
    const popup = this.get("popup");
    if (
      popup &&
      !popup._electron &&
      param != "popup" &&
      param != "is_popup" &&
      param != "is_fullscreen"
    ) {
      if (popup.closed) {
        this.set("popup", null);
      } else {
        try {
          popup.postMessage({ param, value }, window.location.origin);
        } catch (e) {
          console.log(e);
        }
      }
    }

    // No Electron, envia via IPC para a janela de saída.
    // Bloqueado na própria janela de saída (is_popup) para evitar loop de IPC.
    if (
      typeof window !== "undefined" &&
      window.electron &&
      param != "popup" &&
      param != "is_popup" &&
      !this.get("is_popup")
    ) {
      try {
        // value pode ser um proxy reativo do Vuex — o Electron não consegue
        // clonar proxies via IPC ("An object could not be cloned"), mesmo
        // quando o mesmo valor passa por JSON.stringify sem erro. Um
        // round-trip por JSON garante um valor plano antes de enviar; sem
        // isso, o erro interrompe installModule() e todo módulo instalado
        // depois dele fica sem tradução/menu na janela de saída.
        const plain = value === undefined ? value : JSON.parse(JSON.stringify(value));
        window.electron.sendStateUpdate({ param, value: plain });
      } catch (e) {
        console.warn("[AppData] falha ao sincronizar com a janela de saída:", param, e);
      }
    }
  },

  // Grava vários campos de uma vez e propaga como UM ÚNICO evento/mensagem
  // IPC (em vez de N separados) — usado quando dois ou mais campos precisam
  // chegar juntos na janela de saída (ex.: show+minimized do $modules.minimize()).
  // Com set() chamado em sequência, cada campo vira uma mensagem IPC própria;
  // entre a primeira e a segunda, a janela de saída podia computar um estado
  // combinado (ex. show||minimized) momentaneamente errado e reagir a ele
  // (vídeo saindo da projeção só por minimizar). Tudo aqui é aplicado antes
  // de qualquer flush de reatividade do lado receptor.
  setMultiple(entries) {
    entries.forEach(([param, value]) => store.commit("setData", [param, value]));

    const popup = this.get("popup");
    if (popup && !popup._electron) {
      const filtered = entries.filter(([param]) => param != "popup" && param != "is_popup" && param != "is_fullscreen");
      if (filtered.length) {
        if (popup.closed) {
          this.set("popup", null);
        } else {
          try {
            popup.postMessage({ batch: filtered.map(([param, value]) => ({ param, value })) }, window.location.origin);
          } catch (e) {
            console.log(e);
          }
        }
      }
    }

    if (
      typeof window !== "undefined" &&
      window.electron &&
      !this.get("is_popup")
    ) {
      const filtered = entries.filter(([param]) => param != "popup" && param != "is_popup");
      if (filtered.length) {
        try {
          const plainEntries = filtered.map(([param, value]) => ({
            param,
            value: value === undefined ? value : JSON.parse(JSON.stringify(value)),
          }));
          window.electron.sendStateUpdateBatch(plainEntries);
        } catch (e) {
          console.warn("[AppData] falha ao sincronizar lote com a janela de saída:", e);
        }
      }
    }
  },

  get(param, ifnull = null) {
    if (param && !store.getters.exists(param)) {
      return ifnull;
    }

    return store.getters.getData(param);
  },

  getFlatten() {
    let data = Object.assign({}, this.get());
    delete data.popup;
    delete data.is_popup;
    data = JSON.parse(JSON.stringify(data));
    return this.flatten(data);
  },

  addElement(param, value) {
    store.commit("addElementArray", [param, value]);
  },

  removeElement(param, value) {
    store.commit("removeElementArray", [param, value]);
  },

  toogle(param) {
    this.set(param, !this.get(param));
  },

  exists(param) {
    return store.getters.exists(param);
  },

  flatten(data, parent = "", result = {}) {
    for (let key in data) {
      const prop = data[key];
      const newKey = parent ? `${parent}.${key}` : key;
      if (typeof prop === "object" && !Array.isArray(prop) && prop !== null) {
        this.flatten(prop, newKey, result);
      } else {
        result[newKey] = prop;
      }
    }
    return result;
  },
};
