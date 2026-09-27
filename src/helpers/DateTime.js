export default {
  shortTime(time) {
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    if (isNaN(time)) {
      const [h, m, s] = time.split(":").map(Number);
      hours = h;
      minutes = m;
      seconds = s;
    } else {
      hours = Math.floor(time / 3600);
      minutes = Math.floor((time % 3600) / 60);
      seconds = time % 60;
    }

    minutes += hours * 60;
    return `${minutes}:${String(Math.floor(seconds)).padStart(2, "0")}`;
  },

  toNumber(time) {
    if (time == null) return 0;
    // Se já for número, considera que está em segundos
    if (typeof time === 'number') return isFinite(time) ? time : 0;
    const parts = String(time).split(":").map(Number);
    if (parts.length === 2) {
      // "MM:SS" — formato do banco local e padrão da API
      return (parts[0] || 0) * 60 + (parts[1] || 0);
    }
    // "HH:MM:SS"
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const s = parts[2] || 0;
    return h * 3600 + m * 60 + s;
  },
};
