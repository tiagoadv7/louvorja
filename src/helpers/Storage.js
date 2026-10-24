// No Electron, persiste no arquivo via IPC (electron-store).
// No navegador, usa localStorage/sessionStorage como antes.

const isElectron = () =>
  typeof window !== "undefined" &&
  typeof window.electron !== "undefined" &&
  navigator.userAgent.includes("Electron");

export default {
  set(item, data, type = "local") {
    const value = typeof data === "object" ? JSON.stringify(data) : data;

    if (isElectron() && type === "local") {
      // JSON round-trip remove wrappers reativos do Vue (Ref, Proxy)
      // antes de enviar ao IPC (que usa structuredClone)
      let plain;
      try {
        plain = JSON.parse(JSON.stringify(data));
      } catch {
        plain = data;
      }
      window.electron.storeSet(item, plain).catch(() => {});
    }

    // Mantém o localStorage como cache/fallback
    this.storage(type).setItem(item, value);
  },

  get(item, ifnull = null, type = "local") {
    let data = this.storage(type).getItem(item);

    if (!data) {
      return ifnull;
    }

    // Always try JSON.parse for proper type coercion (handles "true"/"false"/numbers)
    try {
      return JSON.parse(data);
    } catch (e) {
      return data;
    }
  },

  remove(item, type = "local") {
    if (isElectron() && type === "local") {
      window.electron.storeRemove(item).catch(() => {});
    }
    this.storage(type).removeItem(item);
  },

  removeAll(item, type = "local") {
    for (let i = this.storage(type).length - 1; i >= 0; i--) {
      const key = this.storage(type).key(i);
      if (key.split(":")[0] == item) {
        this.remove(key, type);
      }
    }
  },

  storage(type = "local") {
    if (type == "session") {
      return sessionStorage;
    } else {
      return localStorage;
    }
  },

  // Carrega dados do electron-store para o localStorage na inicialização
  async syncFromElectron(keys = []) {
    if (!isElectron()) return;
    for (const key of keys) {
      try {
        const value = await window.electron.storeGet(key);
        if (value !== null && value !== undefined) {
          const serialized = typeof value === "object" ? JSON.stringify(value) : String(value);
          localStorage.setItem(key, serialized);
        }
      } catch (e) {
        // Ignora erros de sincronização
      }
    }
  },
};
