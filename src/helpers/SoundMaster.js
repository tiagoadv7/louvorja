import $appdata from "@/helpers/AppData";
import $modules from "@/helpers/Modules";

// Lógica compartilhada para outros módulos (ex. Liturgia) mandarem tocar um
// arquivo de áudio local direto no SoundMaster, sem duplicar a lógica de
// pads/crossfade dele. O SoundMaster mantém os pads como estado local do
// componente (não em $appdata), então o pedido viaja como um "comando
// pendente" em appdata — o componente observa essa chave com watch
// {immediate:true}, o que cobre tanto o caso em que ele já está montado
// quanto o caso em que $modules.open() acabou de montá-lo agora.
export default {
  // Abre o SoundMaster (se necessário) e manda tocar o arquivo no primeiro
  // pad livre (ou reaproveita o pad que já tiver esse mesmo arquivo).
  play(fp, name) {
    if (!fp) return;
    $modules.open("soundmaster");
    $appdata.set("modules.soundmaster.pending_play", {
      path: fp,
      name: name || fp.split(/[\\/]/).pop(),
      ts: Date.now() + Math.random(),
    });
  },
};
