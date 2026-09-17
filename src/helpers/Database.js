import $alert from "@/helpers/Alert";
import $path from "@/helpers/Path";
import $dev from "@/helpers/Dev";
import $storage from "@/helpers/Storage";
import $electron from "@/helpers/Electron";

// Chaves "<lang>_collections_online" (ex.: "pt_collections_online") não são
// arquivos estáticos do json_db — são a rota REST do catálogo de vídeos
// online (canais/playlists/vídeos), servida direto pela API. Tudo mais (cache
// de sessão, fallback local via $electron.dbLocal*) continua igual pra
// qualquer chave, então só a URL precisa de tratamento especial aqui.
function resolveUrl(file) {
  const m = /^([a-z]{2})_collections_online$/.exec(file);
  if (m) return `${$path.apiOrigin()}/${m[1]}/collections/online`;
  return $path.db(`/${file}`);
}

export default {
  // Returns true when running in Electron with local DB enabled
  isLocalEnabled() {
    return $electron.isElectron() && $storage.get("db_local_enabled", false);
  },

  async get(file) {
    try {
      const offlineEnabled = $storage.get("db_local_enabled", false) === true;

      // 1. Modo offline ativo → usa SQLite direto ou JSON em disco.
      //    O IPC db:local-get já prioriza SQLite quando aberto, depois JSON.
      //    Somente entra aqui quando o usuário habilitou o modo offline.
      if (offlineEnabled) {
        const local = await $electron.dbLocalGet(file);
        if (local) {
          $dev.write("Lendo BD local (offline)", file);
          $storage.set(`db:${file}`, local, "session");
          return local;
        }
        // Offline ativo mas arquivo não encontrado localmente
        $dev.write("Modo offline — arquivo não encontrado localmente", file);
        return null;
      }

      // 2. Session memory cache (evita fetch repetido na mesma sessão)
      const cache_name = `db:${file}`;
      const cache = $storage.get(cache_name, null, "session");
      if (cache) {
        $dev.write("Lendo BD do cache", file);
        return cache;
      }

      // 3. API remota (modo padrão / online)
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const url = `${resolveUrl(file)}?${date}`;
      $dev.write("Abrindo BD", url);
      const response = await fetch(url, {
        headers: { "Api-Token": import.meta.env.VITE_API_TOKEN },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      $dev.write("Salvando BD em cache", file);
      $storage.set(cache_name, data, "session");

      // Auto-save ao disco para uso offline futuro (transparente, sem bloquear)
      $electron.dbLocalSave(file, data).catch(() => {});

      return data;
    } catch (error) {
      // Fallback: se API falhar, tenta local mesmo sem modo offline ativo
      if ($electron.isElectron()) {
        try {
          const local = await $electron.dbLocalGet(file);
          if (local) {
            $dev.write("Fallback BD local (API falhou)", file);
            $storage.set(`db:${file}`, local, "session");
            return local;
          }
        } catch (_) {}
      }
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
