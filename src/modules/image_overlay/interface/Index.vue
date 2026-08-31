<template>
  <!-- Sem UI própria — a tela de edição do overlay vive na aba "Overlay de
       Imagem" de video_player/interface/Index.vue (módulo "Mídia"), pra ficar
       na mesma janela do Vídeo em vez de um bloco separado na grade de
       Utilitários (ver manifest.json#category:null, que tira o bloco próprio
       deste módulo da grade). O módulo continua registrado normalmente por
       trás — mesmo id, mesmo userdata, mesma isActive/show/minimized — só
       este arquivo (o único mounted incondicionalmente por layout/Modules.vue
       pra todo módulo registrado) fica vazio de propósito, pra não abrir uma
       segunda janela flutuante duplicada quando "Mídia" é aberto. -->
</template>

<script>
export default {
  name: "ImageOverlayModule",
};
</script>
