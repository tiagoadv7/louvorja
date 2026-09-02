<template>
  <div class="sm-root">

    <!-- ── Barra de ações (antes no system_buttons da própria janela do
         SoundMaster — ver módulo image_overlay/interface/Index.vue, stub,
         mesmo motivo: sem janela própria, os controles ficam no corpo da
         aba) ──────────────────────────────────────────────────────────── -->
    <div class="sm-actions-row">
      <v-btn variant="text" size="small" icon="mdi-content-save-outline" @click="savePlaylist" title="Salvar playlist" />
      <v-btn variant="text" size="small" icon="mdi-folder-open-outline" @click="loadPlaylist" title="Carregar playlist" />
    </div>

    <!-- ── Pads grid ───────────────────────────────────────────────────── -->
    <div class="sm-pads">
      <div
        v-for="pad in mainPads" :key="pad.id"
        class="sm-pad"
        :class="{
          'sm-pad--active':   activeMainId === pad.id,
          'sm-pad--dragover': dragOverId === pad.id,
        }"
        @click="onMainPadClick(pad)"
        @dragover.prevent="dragOverId = pad.id"
        @dragleave="dragOverId = null"
        @drop.prevent="onDrop($event, pad, 'main'); dragOverId = null"
      >
        <span class="sm-pad-num">{{ pad.id === 10 ? '0' : pad.id }}</span>

        <!-- Active: wave bars -->
        <div v-if="activeMainId === pad.id" class="sm-bars sm-bars--lg">
          <span v-for="i in 5" :key="i" class="sm-bar" />
        </div>
        <!-- Idle: upload icon -->
        <v-icon v-else size="32" :color="pad.fileUrl ? 'primary' : undefined" style="opacity: 0.45">
          {{ pad.fileUrl ? 'mdi-music-note' : 'mdi-tray-arrow-up' }}
        </v-icon>

        <span class="sm-pad-name" :class="{ 'sm-pad-name--empty': !pad.fileUrl }">
          {{ pad.name || 'Arraste ou clique' }}
        </span>

        <!-- Hover actions -->
        <div v-if="pad.fileUrl" class="sm-pad-actions">
          <v-btn
            :icon="pad.isLooping ? 'mdi-repeat' : 'mdi-repeat-off'"
            :color="pad.isLooping ? 'primary' : undefined"
            size="x-small" variant="text"
            @click.stop="pad.isLooping = !pad.isLooping; applyLoop(pad)"
          />
          <v-btn
            icon="mdi-delete-outline" size="x-small" variant="text" color="error"
            @click.stop="clearPad(pad, 'main')"
          />
        </div>
      </div>
    </div>

    <!-- ── Now Playing bar ───────────────────────────────────────────── -->
    <div class="sm-console">

      <!-- Left: track info -->
      <div class="sm-console-track">
        <div class="sm-track-art">
          <div v-if="isPlaying" class="sm-bars sm-bars--sm">
            <span v-for="i in 3" :key="i" class="sm-bar" />
          </div>
          <v-icon v-else size="18" style="opacity:0.28">mdi-music-note</v-icon>
        </div>
        <div class="sm-track-info">
          <div class="sm-track-name">{{ activeTrackName || '—' }}</div>
          <div class="sm-track-time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</div>
        </div>
      </div>

      <!-- Center: controls + progress bar -->
      <div class="sm-console-center">
        <div class="sm-controls">
          <button class="sm-ctrl-btn sm-ctrl-stop" @click="stopAll" title="Parar (S)">
            <v-icon size="16">mdi-stop</v-icon>
          </button>
          <button class="sm-ctrl-btn sm-ctrl-play" @click="togglePlay" :title="isPlaying ? 'Pausar (Espaço)' : 'Play (Espaço)'">
            <v-icon size="20">{{ isPlaying ? 'mdi-pause' : 'mdi-play' }}</v-icon>
          </button>
        </div>
        <div class="sm-progress-bar" @click="seekTo">
          <div class="sm-progress-fill" :style="{ width: (progress * 100) + '%' }" />
          <div class="sm-progress-thumb" :style="{ left: (progress * 100) + '%' }" />
        </div>
      </div>

      <!-- Right: talkover + volume -->
      <div class="sm-console-right">
        <v-tooltip location="top" :text="isTalkover ? 'Atenuar ativo (T)' : 'Atenuar (T)'">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              size="small" density="compact"
              :color="isTalkover ? 'warning' : undefined"
              :variant="isTalkover ? 'tonal' : 'text'"
              icon="mdi-microphone"
              @click="toggleTalkover"
            />
          </template>
        </v-tooltip>
        <v-icon size="16" class="ml-2 mr-1" style="opacity:0.4">mdi-volume-high</v-icon>
        <div class="sm-vol-track" @click="setMasterVol">
          <div class="sm-vol-fill" :style="{ width: (masterVolume * 100) + '%' }" />
          <div class="sm-vol-thumb" :style="{ left: (masterVolume * 100) + '%' }" />
        </div>
        <span class="sm-vol-pct">{{ Math.round(masterVolume * 100) }}%</span>
      </div>
    </div>

  </div>
</template>

<script>
// Corpo do antigo modules/soundmaster/interface/Index.vue (agora um stub —
// ver aquele arquivo), embutido como aba do módulo "Mídia" (video_player).
// Continua sendo o módulo independente "soundmaster" por baixo — mesmo
// module_id/userdata/appdata/$soundMaster/$audioBus de sempre; só a tela de
// edição foi movida pra cá, pra ficar na mesma janela do Vídeo/Overlay.
import manifest from "../../soundmaster/manifest.json";
import $audioBus from "@/helpers/AudioBus";

function makePads(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1, name: '', filePath: null, fileUrl: null,
    volume: 1.0, isLooping: false,
  }));
}

function toFileUrl(fp) {
  if (!fp) return null;
  const p = fp.replace(/\\/g, '/');
  return p.startsWith('/') ? `file://${p}` : `file:///${p}`;
}

function fmt(s) {
  if (!s || isNaN(s)) return '00:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${String(m).padStart(2, '0')}:${sec}`;
}

export default {
  name: 'SoundMasterPanel',
  // "active" = aba SoundMaster selecionada no momento (ver video_player/
  // interface/Index.vue#activeTab) — os atalhos de teclado (F1-F10, 0-9,
  // Espaço, T, S/Escape) só devem reagir com a aba realmente visível, senão
  // apertar "1" na aba Vídeo tocaria um pad escondido sem o operador ver.
  props: {
    active: { type: Boolean, default: false },
  },

  data: () => ({
    mainPads:      makePads(10),
    masterVolume:  1.0,
    isMuted:       false,
    isTalkover:    false,
    fadeInMs:      1200,
    fadeOutMs:     2500,
    duckingLevel:  0.15,
    activeMainId:  null,
    // Reprodução externa (ex.: áudio da Liturgia) — usa a mesma engine/config
    // do pad principal (crossfade, fadeIn/Out, ducking, volume master), mas
    // não fica em mainPads, então não ocupa/aparece como pad na grade.
    externalPad:   null,
    currentTime:   0,
    duration:      0,
    progress:      0,
    isPlaying:     false,
    dragOverId:    null,
    _mainAudio:    null,
    _fades:        {},
    _ticker:       null,
    _keyHandler:   null,
    _focusHandler: null,
    _lastPlayTs:   null,
    _lastFooterCmdTs: null,
  }),

  computed: {
    module_id() { return manifest.id; },
    module()    { return this.$modules.get(this.module_id); },
    userdata() {
      return new Proxy({}, {
        get: (_, k) => this.$userdata.get(`modules.${this.module_id}.${k}`, null),
        set: (_, k, v) => { this.$userdata.set(`modules.${this.module_id}.${k}`, v); return true; },
      });
    },
    // Pad "principal" tocando agora — pode ser um pad real (grade) ou o
    // externalPad (arquivo tocado por fora, ex.: Liturgia), que usa o mesmo
    // slot de reprodução (_mainAudio/activeMainId) sem estar em mainPads.
    activePad() {
      if (this.externalPad && this.activeMainId === this.externalPad.id) return this.externalPad;
      return this.mainPads.find(p => p.id === this.activeMainId) || null;
    },
    activeTrackName() {
      return this.activePad?.name || '';
    },
    // Comando externo (ex.: $soundMaster.play() chamado pela Liturgia) para tocar
    // um arquivo direto num pad. Vive em $appdata (não no estado local dos pads)
    // porque outros módulos não têm acesso à instância deste componente.
    pendingPlay() {
      return this.$appdata.get('modules.soundmaster.pending_play');
    },
    // Comando externo (ex.: barra do rodapé) para play/pause ou stop sem
    // acesso direto à instância deste componente — mesmo padrão do pendingPlay.
    footerCommand() {
      return this.$appdata.get('modules.soundmaster.footer_command');
    },
  },

  watch: {
    // immediate: cobre tanto o caso em que o módulo já estava aberto quando o
    // pedido chegou quanto o caso em que $modules.open() acabou de montar o
    // componente agora (o comando já estava em appdata antes do watch existir).
    pendingPlay: {
      immediate: true,
      handler(cmd) {
        if (!cmd?.path || cmd.ts === this._lastPlayTs) return;
        this._lastPlayTs = cmd.ts;
        this.playExternalFile(cmd.path, cmd.name);
        // Limpa o comando já consumido — sem isso, ele fica parado em $appdata
        // e, como este componente só é montado quando a janela "Mídia" abre
        // pela primeira vez na sessão (v-dialog lazy), reabrir a janela mais
        // tarde (ex.: só pra ver o Vídeo) remontava o painel do zero, perdia
        // o _lastPlayTs local e o watch "immediate" tocava o mesmo áudio de
        // novo sozinho, mesmo sem nenhum pedido novo da Liturgia.
        this.$appdata.set('modules.soundmaster.pending_play', null);
      },
    },
    footerCommand(cmd) {
      if (!cmd?.action || cmd.ts === this._lastFooterCmdTs) return;
      this._lastFooterCmdTs = cmd.ts;
      if (cmd.action === 'toggle') this.togglePlay();
      else if (cmd.action === 'stop') this.stopAll();
      else if (cmd.action === 'seek_by' && this._mainAudio) {
        this._mainAudio.currentTime = Math.max(0, Math.min(this.duration, this._mainAudio.currentTime + (cmd.delta || 0)));
      } else if (cmd.action === 'seek_to' && this._mainAudio) {
        this._mainAudio.currentTime = Math.max(0, Math.min(this.duration, cmd.time || 0));
      } else if (cmd.action === 'volume') {
        this.masterVolume = Math.max(0, Math.min(1, (cmd.value ?? 100) / 100));
        this.userdata.master_volume = this.masterVolume;
        this.applyVolumes();
      }
    },
    // Espelha o essencial do "now playing" em $appdata — os pads/estado de
    // reprodução vivem só no componente, então sem isso a barra do rodapé
    // (outro componente) não teria como saber o que está tocando.
    activeTrackName(name) {
      this.$appdata.set('modules.soundmaster.now_playing.name', name);
    },
    isPlaying(v) {
      this.$appdata.set('modules.soundmaster.now_playing.playing', v);
    },
    masterVolume(v) {
      this.$appdata.set('modules.soundmaster.now_playing.volume', v * 100);
    },
  },

  mounted() {
    this.fadeInMs     = this.userdata.fade_in_ms    ?? 1200;
    this.fadeOutMs    = this.userdata.fade_out_ms   ?? 2500;
    this.duckingLevel = this.userdata.ducking_level ?? 0.15;
    this.masterVolume = this.userdata.master_volume ?? 1.0;

    this._keyHandler = (e) => {
      if (!this.active) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
      const k = e.key;

      // 1–9, 0 → main pads (0 = pad 10)
      if (/^[0-9]$/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const idx = k === '0' ? 9 : parseInt(k) - 1;
        this.onMainPadClick(this.mainPads[idx]);
        return;
      }
      // Space → play/pause
      if (k === ' ') { e.preventDefault(); this.togglePlay(); return; }
      // T → atenuar (talkover)
      if (k.toLowerCase() === 't') { this.toggleTalkover(); return; }
      // S ou Escape → stop
      if (k.toLowerCase() === 's' || k === 'Escape') { this.stopAll(); return; }
    };
    window.addEventListener('keydown', this._keyHandler);

    // Outro dono de áudio (video_player, media) começou a tocar: encerra (com
    // fade) a faixa principal, sem esperar o próximo clique.
    this._focusHandler = $audioBus.listen('soundmaster', () => {
      this.stopMain(true);
    });
  },

  beforeUnmount() {
    this.stopAllImmediate();
    clearInterval(this._ticker);
    if (this._keyHandler) window.removeEventListener('keydown', this._keyHandler);
    $audioBus.unlisten(this._focusHandler);
  },

  methods: {
    t(text) {
      const key = `modules.${this.module_id}.${text}`;
      const r = this.$t(key);
      if (r !== key) return r;
      const locale = this.$i18n?.locale?.value ?? 'pt';
      const tr = this.$appdata.get(`modules.${this.module_id}.manifest`)?.translations?.[locale];
      return tr?.[text] ?? text;
    },
    // Mesmo fade suave do botão "Parar" (stopAll), mas aguardando o fade
    // terminar antes de devolver — usado tanto por close() (fecha de vez)
    // quanto por onMinimize() de video_player/interface/Index.vue (minimizar
    // agora também encerra a reprodução, em vez de deixar tocando escondido).
    async stopSmooth() {
      const hasAudio = !!this._mainAudio;
      if (hasAudio && this.fadeOutMs > 0) {
        this.stopAll();
        await new Promise(r => setTimeout(r, this.fadeOutMs + 60));
      }
    },
    // Chamado pelo close() de video_player/interface/Index.vue (via ref) ao
    // fechar a janela "Mídia" — faz o fade suave do áudio antes de encerrar o
    // módulo soundmaster de verdade, em vez de cortar tudo abruptamente.
    async close() {
      await this.stopSmooth();
      this.$modules.close(this.module_id);
    },
    formatTime(s)  { return fmt(s); },

    effVol(padVol, isMain) {
      if (this.isMuted) return 0;
      let v = padVol * this.masterVolume;
      if (isMain && this.isTalkover) v *= this.duckingLevel;
      return Math.max(0, Math.min(1, v));
    },

    fade(key, audio, from, to, ms, done) {
      clearInterval(this._fades[key]);
      if (ms <= 0) { audio.volume = to; done?.(); return; }
      const steps = Math.max(1, Math.round(ms / 40)), d = (to - from) / steps;
      let n = 0;
      this._fades[key] = setInterval(() => {
        n++;
        audio.volume = Math.max(0, Math.min(1, from + d * n));
        if (n >= steps) { clearInterval(this._fades[key]); audio.volume = to; done?.(); }
      }, 40);
    },

    tick() {
      const a = this._mainAudio;
      if (!a) return;
      this.currentTime = a.currentTime;
      this.duration    = a.duration || 0;
      this.progress    = this.duration > 0 ? a.currentTime / a.duration : 0;
      // Espelha em $appdata (escala 0-100, igual ao módulo Media) para a
      // barra do rodapé mostrar tempo/progresso sem acesso à instância.
      this.$appdata.set('modules.soundmaster.now_playing.current_time', this.currentTime);
      this.$appdata.set('modules.soundmaster.now_playing.duration', this.duration);
      this.$appdata.set('modules.soundmaster.now_playing.progress', this.progress * 100);
    },

    seekTo(e) {
      if (!this._mainAudio || !this.duration) return;
      const r = e.currentTarget.getBoundingClientRect();
      this._mainAudio.currentTime = ((e.clientX - r.left) / r.width) * this.duration;
    },

    setMasterVol(e) {
      const r = e.currentTarget.getBoundingClientRect();
      this.masterVolume = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      this.userdata.master_volume = this.masterVolume;
      this.applyVolumes();
    },

    applyVolumes() {
      if (this._mainAudio && this.activePad) {
        this._mainAudio.volume = this.effVol(this.activePad.volume, true);
      }
    },

    toggleMute() {
      this.isMuted = !this.isMuted;
      this.applyVolumes();
    },

    toggleTalkover() {
      this.isTalkover = !this.isTalkover;
      this._applySmooth(700);
    },

    _applySmooth(fadeMs) {
      if (this._mainAudio) {
        this.fade('main', this._mainAudio, this._mainAudio.volume, this.effVol(this.activePad?.volume ?? 1, true), fadeMs);
      }
    },

    togglePlay() {
      if (!this._mainAudio) return;
      const audio = this._mainAudio;
      const pad   = this.activePad;
      const fadeDuration = Math.min(600, this.fadeInMs);

      if (audio.paused) {
        // Resume com fade in — avisa media/video_player para pararem, senão
        // a música do álbum toca junto com o que já estiver ativo lá.
        $audioBus.requestFocus('soundmaster');
        const targetVol = this.effVol(pad?.volume ?? 1, true);
        audio.volume = 0;
        audio.play().then(() => {
          this.isPlaying = true;
          this.fade('main', audio, 0, targetVol, fadeDuration);
          clearInterval(this._ticker);
          this._ticker = setInterval(() => this.tick(), 200);
        }).catch(() => { this.isPlaying = false; });
      } else {
        // Pause com fade out
        const savedVol = audio.volume;
        this.fade('main', audio, savedVol, 0, fadeDuration, () => {
          audio.pause();
          audio.volume = savedVol;
          this.isPlaying = false;
          clearInterval(this._ticker);
        });
      }
    },

    stopAll() {
      // Botão Stop: encerra com fade suave
      this.stopMain(true);
    },

    stopAllImmediate() {
      // Usado apenas no beforeUnmount (componente já está sendo destruído)
      this.stopMain(false);
    },

    async pickFile() {
      return this.$electron.selectFile({
        title: 'Selecionar áudio',
        filters: [{ name: 'Áudio', extensions: ['mp3','wav','ogg','flac','m4a','aac'] }],
      });
    },

    // Chamado via $soundMaster.play() por outros módulos (ex.: Liturgia).
    // Toca com a mesma engine/config do pad principal (crossfade, fades,
    // ducking, volume master), mas SEM ocupar/aparecer como pad na grade —
    // usa um "pad virtual" (externalPad) fora de mainPads, com id negativo
    // pra nunca colidir com os ids reais (1-10).
    playExternalFile(fp, name) {
      this.externalPad = {
        id: -1,
        filePath: fp,
        fileUrl: toFileUrl(fp),
        name: name || fp.split(/[\\/]/).pop().replace(/\.[^.]+$/, ''),
        volume: 1.0,
        isLooping: false,
      };
      this.playMain(this.externalPad);
    },

    assignFile(pad, fp, name) {
      pad.filePath = fp;
      pad.fileUrl  = toFileUrl(fp);
      pad.name     = name || fp.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
    },

    clearPad(pad, type) {
      if (type === 'main' && this.activeMainId === pad.id) this.stopMain(false);
      pad.filePath = null; pad.fileUrl = null; pad.name = '';
    },

    onDrop(e, pad) {
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const fp = this.$electron.getPathForFile(file);
      if (fp) this.assignFile(pad, fp, file.name);
    },

    async onMainPadClick(pad) {
      if (!pad.fileUrl) {
        const fp = await this.pickFile();
        if (fp) this.assignFile(pad, fp, null);
        return;
      }
      if (this.activeMainId === pad.id) { this.stopMain(); return; }
      this.playMain(pad);
    },

    playMain(pad) {
      // Avisa media/video_player para pararem — usado tanto pelo clique direto
      // num pad quanto por playExternalFile() (ex: item de áudio da Liturgia).
      // Sem isso, uma música/vídeo já em execução em outro módulo continuava
      // tocando junto com o pad da coletânea.
      $audioBus.requestFocus('soundmaster');

      // Crossfade: fade out o audio anterior enquanto o novo entra
      const outAudio = this._mainAudio;
      const outId    = this.activeMainId;
      if (outAudio) {
        const outKey = `main_out_${outId}`;
        clearInterval(this._fades['main']); // cancela fade anterior no slot 'main'
        if (this.fadeOutMs > 0 && !outAudio.paused) {
          // Fade out independente (não bloqueia o novo)
          this.fade(outKey, outAudio, outAudio.volume, 0, Math.min(this.fadeOutMs, 1200), () => {
            outAudio.pause(); outAudio.src = '';
          });
        } else {
          outAudio.pause(); outAudio.src = '';
        }
      }

      const audio = new Audio(pad.fileUrl);
      audio.loop   = pad.isLooping;
      audio.volume = 0;
      this._mainAudio   = audio;
      this.activeMainId = pad.id;
      this.isPlaying    = true;

      audio.addEventListener('ended', () => {
        if (this._mainAudio !== audio) return; // já foi substituído por crossfade
        if (!pad.isLooping) {
          this.activeMainId = null; this._mainAudio = null;
          this.isPlaying = false; this.progress = 0; this.currentTime = 0;
          if (this.externalPad === pad) this.externalPad = null;
        }
      });

      audio.play().then(() => {
        this.fade('main', audio, 0, this.effVol(pad.volume, true), this.fadeInMs);
        clearInterval(this._ticker);
        this._ticker = setInterval(() => this.tick(), 200);
      }).catch(() => {
        if (this._mainAudio === audio) {
          this.activeMainId = null; this._mainAudio = null; this.isPlaying = false;
          if (this.externalPad === pad) this.externalPad = null;
        }
      });
    },

    stopMain(fade = true) {
      const audio = this._mainAudio;
      if (!audio) return;
      const done = () => {
        audio.pause(); audio.src = '';
        if (this._mainAudio === audio) {
          this._mainAudio = null; this.activeMainId = null; this.isPlaying = false;
          this.progress = 0; this.currentTime = 0;
          this.externalPad = null;
          clearInterval(this._ticker);
        }
        this.applyVolumes();
      };
      if (fade && this.fadeOutMs > 0) this.fade('main', audio, audio.volume, 0, this.fadeOutMs, done);
      else { clearInterval(this._fades['main']); done(); }
    },

    applyLoop(pad) {
      if (this._mainAudio && this.activeMainId === pad.id) this._mainAudio.loop = pad.isLooping;
    },

    async savePlaylist() {
      this.userdata.fade_in_ms    = this.fadeInMs;
      this.userdata.fade_out_ms   = this.fadeOutMs;
      this.userdata.ducking_level = this.duckingLevel;
      const data = JSON.stringify({
        version: '1.0',
        settings: { fadeInMs: this.fadeInMs, fadeOutMs: this.fadeOutMs, duckingLevel: this.duckingLevel, masterVolume: this.masterVolume },
        mainPads: this.mainPads.map(p => ({ id: p.id, name: p.name, filePath: p.filePath, volume: p.volume, isLooping: p.isLooping })),
      }, null, 2);
      const fp = await this.$electron.saveDialog({ title: 'Salvar playlist', defaultPath: 'playlist.smp', filters: [{ name: 'SoundMaster', extensions: ['smp'] }] });
      if (fp) await this.$electron.writeFile(fp, data);
    },

    async loadPlaylist() {
      const fp = await this.$electron.selectFile({ title: 'Carregar playlist', filters: [{ name: 'SoundMaster', extensions: ['smp','json'] }] });
      if (!fp) return;
      try {
        const data = JSON.parse(await this.$electron.readFile(fp, 'utf-8'));
        if (data.settings) Object.assign(this, {
          fadeInMs:     data.settings.fadeInMs     ?? this.fadeInMs,
          fadeOutMs:    data.settings.fadeOutMs    ?? this.fadeOutMs,
          duckingLevel: data.settings.duckingLevel ?? this.duckingLevel,
          masterVolume: data.settings.masterVolume ?? this.masterVolume,
        });
        (data.mainPads || []).forEach(s => {
          const p = this.mainPads.find(x => x.id === s.id);
          if (!p) return;
          Object.assign(p, { name: s.name || '', filePath: s.filePath || null, fileUrl: s.filePath ? toFileUrl(s.filePath) : null, volume: s.volume ?? 1, isLooping: s.isLooping ?? false });
        });
      } catch (e) { this.$alert?.error?.({ text: 'Erro ao carregar: ' + String(e) }); }
    },
  },
};
</script>

<style scoped>
/* ─── Root ────────────────────────────────────────────────────────── */
.sm-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgb(var(--v-theme-surface));
  overflow: hidden;
  color: rgb(var(--v-theme-on-surface));
}

/* ─── Barra de ações (save/load/settings) ────────────────────────────── */
.sm-actions-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  padding: 4px 10px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

/* ─── Pads grid ───────────────────────────────────────────────────── */
.sm-pads {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  padding: 14px;
  flex: 1;
  overflow-y: auto;
}
.sm-pad {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
  padding: 10px 8px 32px;
  gap: 8px;
  overflow: hidden;
  min-height: 100px;
}
.sm-pad:hover        { background: rgba(var(--v-theme-on-surface), 0.08); border-color: rgba(var(--v-theme-on-surface), 0.18); transform: translateY(-1px); }
.sm-pad--active      { background: rgba(99, 102, 241, 0.12) !important; border-color: #6366f1 !important; }
.sm-pad--dragover    { border-color: #6366f1 !important; background: rgba(99, 102, 241, 0.08) !important; }

.sm-pad-num {
  position: absolute;
  top: 8px; left: 10px;
  font-size: 11px; font-weight: 700;
  color: rgba(var(--v-theme-on-surface), 0.30);
  line-height: 1;
}
.sm-pad-name {
  font-size: 11px; font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.60);
  text-align: center;
  word-break: break-word;
  line-height: 1.3;
  padding: 0 4px;
}
.sm-pad-name--empty { font-size: 10px; color: rgba(var(--v-theme-on-surface), 0.25); }

.sm-pad-actions {
  position: absolute;
  bottom: 4px; left: 0; right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.sm-pad:hover .sm-pad-actions { opacity: 1; }

/* ─── Wave bars ───────────────────────────────────────────────────── */
.sm-bars { display: flex; align-items: flex-end; gap: 3px; }
.sm-bars--sm { height: 18px; }
.sm-bars--lg { height: 28px; gap: 4px; }
.sm-bar {
  display: inline-block;
  width: 3px;
  border-radius: 2px;
  background: #6366f1;
  animation: wave 0.8s ease-in-out infinite;
}
.sm-bars--lg .sm-bar { width: 4px; }
.sm-bar:nth-child(1) { animation-delay: 0s;    animation-duration: 0.7s; }
.sm-bar:nth-child(2) { animation-delay: 0.15s; animation-duration: 0.9s; }
.sm-bar:nth-child(3) { animation-delay: 0.3s;  animation-duration: 0.75s; }
.sm-bar:nth-child(4) { animation-delay: 0.1s;  animation-duration: 0.85s; }
.sm-bar:nth-child(5) { animation-delay: 0.2s;  animation-duration: 0.65s; }
@keyframes wave { 0%, 100% { height: 4px; } 50% { height: 100%; } }

/* ─── Console bar ─────────────────────────────────────────────────── */
.sm-console {
  display: flex;
  align-items: center;
  padding: 8px 14px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  gap: 14px;
  flex-shrink: 0;
  border-radius: 12px;
  margin: 0 10px 10px;
}

/* Track info */
.sm-console-track {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 180px;
  min-width: 0;
}
.sm-track-art {
  width: 32px; height: 32px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.07);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.sm-track-info { min-width: 0; }
.sm-track-name {
  font-size: 12px; font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 130px;
}
.sm-track-time {
  font-size: 10px; font-family: monospace;
  color: rgba(var(--v-theme-on-surface), 0.45);
  margin-top: 1px;
}

.sm-console-center { flex: 1; display: flex; align-items: center; gap: 12px; }

.sm-controls { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.sm-ctrl-btn {
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%; border: none; cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  color: rgb(var(--v-theme-on-surface));
}
.sm-ctrl-btn:active { transform: scale(0.92); }
.sm-ctrl-stop {
  width: 30px; height: 30px;
  background: rgba(var(--v-theme-on-surface), 0.10);
}
.sm-ctrl-stop:hover { background: rgba(var(--v-theme-on-surface), 0.18); }
.sm-ctrl-play {
  width: 40px; height: 40px;
  background: #6366f1;
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.35);
  color: #ffffff !important;
}
.sm-ctrl-play:hover { background: #4f46e5; }

.sm-progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 2px;
  cursor: pointer;
  position: relative;
}
.sm-progress-fill {
  height: 100%;
  background: #6366f1;
  border-radius: 2px;
  transition: width 0.1s linear;
}
.sm-progress-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 10px; height: 10px;
  background: #6366f1;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgb(var(--v-theme-surface));
}

.sm-console-right {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.sm-vol-track {
  width: 80px; height: 4px;
  background: rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 2px;
  cursor: pointer;
  position: relative;
}
.sm-vol-fill {
  height: 100%;
  background: #6366f1;
  border-radius: 2px;
}
.sm-vol-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 10px; height: 10px;
  background: #6366f1;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgb(var(--v-theme-surface));
}
.sm-vol-pct {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.48);
  min-width: 32px;
  text-align: right;
  font-family: monospace;
}
</style>
