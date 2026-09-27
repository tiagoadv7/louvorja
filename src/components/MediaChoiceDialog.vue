<template>
  <v-dialog v-model="show" max-width="440" content-class="mcd-dialog">
    <v-card class="mcd-card">
      <div class="mcd-header">
        <v-icon size="18" class="mcd-header-icon">mdi-cloud-download-outline</v-icon>
        <span>{{ $t('modules.media.alerts.choose_play_title') }}</span>
        <button class="mcd-close" @click="choose('close')">
          <v-icon size="16">mdi-close</v-icon>
        </button>
      </div>

      <div class="mcd-body">
        <div class="mcd-sub">{{ $t('modules.media.alerts.choose_play_detail') }}</div>

        <div class="mcd-option-list">
          <div class="mcd-option" @click="choose('online')">
            <div class="mcd-option-icon mcd-option-icon--blue">
              <v-icon size="20">mdi-play-circle-outline</v-icon>
            </div>
            <div class="mcd-option-info">
              <div class="mcd-option-title">{{ $t('modules.media.alerts.btn_play_online') }}</div>
              <div class="mcd-option-desc">{{ $t('modules.media.alerts.desc_play_online') }}</div>
            </div>
            <v-icon size="18" class="mcd-chevron">mdi-chevron-right</v-icon>
          </div>

          <div class="mcd-option" @click="choose('download_song')">
            <div class="mcd-option-icon mcd-option-icon--green">
              <v-icon size="20">mdi-download</v-icon>
            </div>
            <div class="mcd-option-info">
              <div class="mcd-option-title">{{ $t('modules.media.alerts.btn_download_song') }}</div>
              <div class="mcd-option-desc">{{ $t('modules.media.alerts.desc_download_song') }}</div>
            </div>
            <v-icon size="18" class="mcd-chevron">mdi-chevron-right</v-icon>
          </div>

          <div class="mcd-option" @click="choose('download_album')">
            <div class="mcd-option-icon mcd-option-icon--orange">
              <v-icon size="20">mdi-folder-download-outline</v-icon>
            </div>
            <div class="mcd-option-info">
              <div class="mcd-option-title">{{ $t('modules.media.alerts.btn_download') }}</div>
              <div class="mcd-option-desc">{{ $t('modules.media.alerts.desc_download_album') }}</div>
            </div>
            <v-icon size="18" class="mcd-chevron">mdi-chevron-right</v-icon>
          </div>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'MediaChoiceDialog',

  data: () => ({
    show: false,
    _onChoice: null,
    _handler: null,
  }),

  mounted() {
    this._handler = (e) => {
      this._onChoice = e.detail?.onChoice || null;
      this.show = true;
    };
    window.addEventListener('media-play-choice', this._handler);
  },
  beforeUnmount() {
    window.removeEventListener('media-play-choice', this._handler);
  },

  methods: {
    choose(value) {
      this.show = false;
      const cb = this._onChoice;
      this._onChoice = null;
      if (cb) cb(value === 'close' ? 'cancel' : value);
    },
  },
};
</script>

<style scoped>
.mcd-card {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  border-radius: 10px;
  overflow: hidden;
}

.mcd-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-weight: 600;
  font-size: 14px;
}
.mcd-header-icon { flex-shrink: 0; }
.mcd-close {
  margin-left: auto;
  border: none;
  background: none;
  color: rgb(var(--v-theme-on-primary));
  cursor: pointer;
  display: flex;
  align-items: center;
  opacity: 0.85;
}
.mcd-close:hover { opacity: 1; }

.mcd-body { padding: 16px; }
.mcd-sub {
  font-size: 12.5px;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.65);
  margin-bottom: 14px;
}

.mcd-option-list { display: flex; flex-direction: column; gap: 6px; }
.mcd-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.mcd-option:hover { background: rgba(var(--v-theme-on-surface), 0.05); border-color: rgba(var(--v-theme-primary), 0.4); }

.mcd-option-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.mcd-option-icon--blue   { background: rgba(66, 165, 245, 0.13);  color: #42a5f5; }
.mcd-option-icon--green  { background: rgba(67, 160, 71, 0.13);   color: #43a047; }
.mcd-option-icon--orange { background: rgba(251, 140, 0, 0.13);   color: #fb8c00; }

.mcd-option-info { flex: 1; min-width: 0; }
.mcd-option-title { font-size: 13.5px; font-weight: 600; color: rgb(var(--v-theme-on-surface)); }
.mcd-option-desc  { font-size: 11.5px; color: rgba(var(--v-theme-on-surface), 0.55); }
.mcd-chevron { opacity: 0.4; flex-shrink: 0; }
</style>
