export default {
  db(path) {
    const url = import.meta.env.VITE_URL_DATABASE;
    return url + path;
  },
  // Origem da API sem o path de json_db (ex.: "https://api.louvorja.com.br")
  // — usada pelas rotas REST que não são arquivos estáticos do json_db (ex.:
  // catálogo de vídeos online, ver Database.js#get e modules/video_player).
  apiOrigin() {
    const url = import.meta.env.VITE_URL_DATABASE || '';
    return url.replace(/\/json_db\/?$/, '');
  },
  file(filePath) {
    if (!filePath) return '';
    if (filePath.startsWith('file://') || filePath.startsWith('app-local://') || filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    const base = (import.meta.env.VITE_URL_FILES || '').replace(/\/$/, '');
    return base + (filePath.startsWith('/') ? '' : '/') + filePath;
  },
};
