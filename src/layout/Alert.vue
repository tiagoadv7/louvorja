<template>
  <v-dialog v-model="alert.show" max-width="420" persistent>
    <v-card class="al-card" rounded="lg">
      <div class="al-body">
        <div class="al-icon" :class="`al-icon--${iconMeta.tone}`">
          <v-icon size="22">{{ iconMeta.icon }}</v-icon>
        </div>
        <div class="al-content">
          <div v-if="alert.title" class="al-title">
            <span v-if="alert.translate" v-html="$t(alert.title)" />
            <span v-else v-html="alert.title" />
          </div>
          <div v-if="alert.text" class="al-text">
            <span v-if="alert.translate" v-html="$t(alert.text)" />
            <span v-else v-html="alert.text" />
          </div>
          <div v-if="alert.error" class="al-error" v-html="alert.error" />
          <v-text-field
            v-if="alert.input"
            v-model="inputVal"
            density="compact"
            variant="outlined"
            hide-details
            autofocus
            class="al-input"
            @keydown.enter="confirmInput"
          />
        </div>
      </div>

      <div class="al-actions">
        <button
          v-for="(btn, index) in alert.buttons"
          :key="index"
          :class="['al-btn', btn.color === 'primary' ? 'al-btn--primary' : 'al-btn--plain']"
          :style="btn.color !== 'primary' && btn.color ? { color: `rgb(var(--v-theme-${btn.color}))` } : null"
          @click="clickBtn(btn.value)"
        >
          {{ $t(btn.text) }}
        </button>
      </div>
    </v-card>
  </v-dialog>
</template>

<script>
const ICON_BY_COLOR = {
  warning: { icon: "mdi-alert-circle-outline", tone: "warning" },
  error:   { icon: "mdi-alert-octagon-outline", tone: "error" },
  success: { icon: "mdi-check-circle-outline",  tone: "success" },
  info:    { icon: "mdi-information-outline",   tone: "info" },
};

export default {
  name: "AlertLayout",
  data: () => ({
    inputVal: "",
  }),
  computed: {
    alert: function () {
      return this.$appdata.get("alert");
    },
    // Botão que o Enter do campo de texto deve acionar — o primeiro que não
    // seja de cancelamento/fechamento (prompt() sempre usa value:"confirm").
    primaryButtonValue() {
      const btn = (this.alert.buttons || []).find(
        (b) => !["cancel", "no", "close"].includes(b.value)
      );
      return btn?.value ?? null;
    },
    // Ícone/cor do badge de acordo com alert.color — sem isso o card inteiro
    // ficava pintado da cor (ex.: amarelo warning tomando o card todo), o que
    // parecia datado. Agora só o badge circular carrega a cor, o resto do
    // card fica neutro (mesmo visual dos diálogos de confirmação do módulo
    // Liturgia: header/ícone marcando o tom, corpo limpo).
    iconMeta() {
      return ICON_BY_COLOR[this.alert.color] || { icon: "mdi-information-outline", tone: "neutral" };
    },
  },
  watch: {
    "alert.show"(open) {
      // Preenche o campo com o valor default toda vez que um novo prompt abre.
      if (open) this.inputVal = this.alert.input_default || "";
    },
  },
  methods: {
    clickBtn(value) {
      // Em modo prompt, o botão que não é de cancelar devolve o texto digitado
      // em vez do próprio `value` estático do botão.
      const resolved =
        this.alert.input && value !== "cancel" ? this.inputVal : value;
      this.$appdata.set("alert.value", resolved);
      this.$appdata.set("alert.show", false);
    },
    confirmInput() {
      if (this.primaryButtonValue) this.clickBtn(this.primaryButtonValue);
    },
  },
};
</script>

<style scoped>
.al-card {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
}

.al-body {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 22px 22px 18px;
}

.al-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.al-icon--warning { background: rgba(251, 140, 0, 0.15); color: #fb8c00; }
.al-icon--error   { background: rgba(229, 57, 53, 0.15); color: #e53935; }
.al-icon--success { background: rgba(67, 160, 71, 0.15); color: #43a047; }
.al-icon--info    { background: rgba(2, 136, 209, 0.15); color: #0288d1; }
.al-icon--neutral { background: rgba(var(--v-theme-on-surface), 0.08); color: rgba(var(--v-theme-on-surface), 0.6); }

.al-content { min-width: 0; flex: 1; }

.al-title {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.35;
  margin-bottom: 4px;
}

.al-text {
  font-size: 13px;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.72);
}

.al-error {
  margin-top: 6px;
  font-size: 12px;
  color: #e53935;
}

.al-input {
  margin-top: 10px;
}

.al-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px 18px;
}

.al-btn {
  border: none;
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, opacity 0.12s;
}

.al-btn--plain {
  background: none;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.al-btn--plain:hover { background: rgba(var(--v-theme-on-surface), 0.06); }

.al-btn--primary {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.al-btn--primary:hover { opacity: 0.88; }
</style>
