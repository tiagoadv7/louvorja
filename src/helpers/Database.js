import $alert from "@/helpers/Alert";
import $path from "@/helpers/Path";
import $dev from "@/helpers/Dev";
import $storage from "@/helpers/Storage";
import $electron from "@/helpers/Electron";

export default {
  // Returns true when running in Electron with local DB enabled
  isLocalEnabled() {
    return $electron.isElectron() && $storage.get("db_local_enabled", false);
  },

  async get(file) {
    try {
      const offlineEnabled = $storage.get("db_local_enabled", false) === true;

      // 1. Modo offline: lê do disco/localStorage local
      if (offlineEnabled) {
        const local = await $electron.dbLocalGet(file);
        if (local) {
          $dev.write("Lendo BD local (offline)", file);
          return local;
        }
      }

      // 2. Session memory cache
      const cache_name = `db:${file}`;
      const cache = $storage.get(cache_name, null, "session");
      if (cache) {
        $dev.write("Lendo BD do cache", file);
        return cache;
      }

      // 3. Remote API
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const url = `${$path.db(`/${file}`)}?${date}`;
      $dev.write("Abrindo BD", url);
      const response = await fetch(url, {
        headers: { "Api-Token": import.meta.env.VITE_API_TOKEN },
      });

      if (!response.ok) throw new Error();
      const data = await response.json();

      // Save to session cache
      $dev.write("Salvando BD em cache", file);
      $storage.set(cache_name, data, "session");

      // Auto-save ao disco para uso offline futuro
      if ($electron.isElectron()) {
        $electron.dbLocalSave(file, data).catch(() => {});
      } else if (offlineEnabled) {
        $electron.dbLocalSave(file, data).catch(() => {});
      }

      return data;
    } catch (error) {
      $alert.error({ text: "messages.file_database_not_found", error });
      return null;
    }
  },

  // Force-download a file from API to local disk (used by StoreDialog)
  async download(file) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const url = `${$path.db(`/${file}`)}?${date}`;
    return $electron.dbLocalDownload(file, url, import.meta.env.VITE_API_TOKEN);
  },
};
