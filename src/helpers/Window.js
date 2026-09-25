const isElectron = () =>
  typeof window !== "undefined" &&
  typeof window.electron !== "undefined" &&
  navigator.userAgent.includes("Electron");

export default {
  open(url, target, features, displayId) {
    // No Electron, janelas de saída são abertas via IPC
    if (isElectron() && url.includes("/popup")) {
      const params = new URLSearchParams(url.includes("?") ? url.split("?")[1] : "");
      const moduleId = params.get("module") || params.get("module_id") || null;
      window.electron.openOutput(moduleId, displayId);
      return { closed: false, _electron: true };
    }

    if (url.startsWith("/")) {
      url = (import.meta.env.BASE_URL ?? "/") + url.slice(1);
    }
    return window.open(url, target, features);
  },

  // Controles da janela principal (só Electron)
  minimize() {
    if (isElectron()) window.electron.windowMinimize();
  },
  maximize() {
    if (isElectron()) window.electron.windowMaximize();
  },
  close() {
    if (isElectron()) window.electron.windowClose();
  },

  // Janela de apresentação / saída
  openOutput(moduleId, displayId) {
    if (isElectron()) return window.electron.openOutput(moduleId, displayId);
    return null;
  },
  closeOutput() {
    if (isElectron()) window.electron.closeOutput();
  },
  isOutputOpen() {
    if (isElectron()) return window.electron.isOutputOpen();
    return Promise.resolve(false);
  },

  // Abrir URL externa (Electron usa shell.openExternal)
  openExternal(url) {
    if (isElectron()) {
      window.electron.openExternal(url);
    } else {
      window.open(url, "_blank");
    }
  },
};
