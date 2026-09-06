export default {
  db(path) {
    const url = import.meta.env.VITE_URL_DATABASE;
    return url + path;
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
