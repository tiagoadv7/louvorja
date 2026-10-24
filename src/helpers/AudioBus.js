import $electron from "@/helpers/Electron";

// Sinal cross-module para "só um áudio por vez": quem começa a tocar avisa os
// outros donos de áudio (media, soundmaster, video_player) para darem fade-out
// e pararem.
//
// media/soundmaster vivem na janela principal; video_player vive na janela de
// saída (outro processo/renderer do Electron) — window.dispatchEvent sozinho
// não cruza essa fronteira, por isso o pedido também viaja por IPC
// ('audio-focus-request', bidirecional, ver electron/main.js). O evento local
// continua sendo disparado para o caso comum (media ↔ soundmaster, mesma janela).
const EVENT = 'request-audio-focus';

export default {
  requestFocus(ownerId) {
    const detail = { owner: ownerId };
    window.dispatchEvent(new CustomEvent(EVENT, { detail }));
    $electron.sendAudioFocusRequest(detail);
  },

  // Chama onOtherOwnerPlaying quando outro dono pede foco (nesta janela ou em
  // outra). Retorna uma referência para remover depois com unlisten.
  listen(ownerId, onOtherOwnerPlaying) {
    const localHandler = (e) => {
      if (e.detail?.owner !== ownerId) onOtherOwnerPlaying(e);
    };
    window.addEventListener(EVENT, localHandler);

    const ipcHandler = $electron.isElectron()
      ? $electron.on('audio-focus-request', (detail) => {
          if (detail?.owner !== ownerId) onOtherOwnerPlaying({ detail });
        })
      : null;

    return { localHandler, ipcHandler };
  },

  unlisten(ref) {
    if (!ref) return;
    if (ref.localHandler) window.removeEventListener(EVENT, ref.localHandler);
    if (ref.ipcHandler) $electron.off('audio-focus-request', ref.ipcHandler);
  },
};
