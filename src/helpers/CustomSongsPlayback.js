/**
 * CustomSongsPlayback.js — ponte mínima entre slide_editor (apresentação de
 * música própria) e quem estiver tocando uma fila de várias músicas em
 * sequência (ver custom_collections "Reproduzir tudo").
 *
 * $media (catálogo oficial) já tem seu próprio "_autoCloseCallback" — este
 * helper é o equivalente pro lado das músicas próprias, já que slide_editor
 * não é um singleton (é um componente Vue comum) e CustomSongs.js é
 * propositalmente livre de estado de reprodução (só CRUD em disco).
 *
 * autoAdvance: setado por quem estiver tocando uma fila; slide_editor chama
 *   ao terminar o áudio da música atual (ver @ended no template).
 * stopCurrent: setado pelo próprio slide_editor (mounted); quem for trocar
 *   pra uma música oficial no meio da fila chama isso pra silenciar o áudio
 *   da música própria em andamento antes de trocar.
 * stopAndClose: setado pelo próprio slide_editor (mounted); quem terminar
 *   uma fila (custom_collections "Reproduzir tudo") chama isso quando a
 *   ÚLTIMA música da fila é própria, pra encerrar a apresentação de vez
 *   (pausa o áudio e fecha o editor/a projeção) — equivalente ao
 *   $media.endSong() do lado oficial, que sem isso não tinha correspondente
 *   e deixava a tela de saída presa no último slide.
 */
export default {
  autoAdvance: null,
  stopCurrent: null,
  stopAndClose: null,
};
