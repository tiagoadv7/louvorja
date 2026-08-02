<template>
  <ModuleContainer ref="moduleContainer" :manifest="manifest">
    <v-card flat>
      <!-- Conectar-se a outro LouvorJA como controle remoto (usado pelo teclado
           virtual em Header.vue) — oculto por ora, sem remover a funcionalidade. -->
      <template v-if="false">
        <v-card-text class="px-0">
          <small>{{ t("info_module") }}</small>
        </v-card-text>
        <v-card-text class="px-0">
          <v-text-field
            v-model="url"
            :disabled="loading || is_connected"
            :label="t('labels.ip')"
            density="compact"
            variant="outlined"
            prepend-icon="mdi-ip-network"
            :hint="t('messages.get_ip')"
            persistent-hint
            :loading="loading ? 'warning' : null"
          />
          <v-text-field
            v-model="token"
            :disabled="loading || is_connected"
            :label="t('labels.token')"
            class="mt-3"
            density="compact"
            variant="outlined"
            prepend-icon="mdi-code-braces"
            persistent-hint
            :loading="loading ? 'warning' : null"
          />
        </v-card-text>
        <v-card-actions class="px-0">
          <v-spacer></v-spacer>
          <v-btn color="info" :text="t('labels.test_connection')" @click="test" />
          <v-btn
            v-if="!is_connected"
            color="success"
            text="Conectar"
            @click="connect"
          />
          <v-btn
            v-else
            color="error"
            :text="t('labels.disconnect')"
            @click="disonnect"
          />
        </v-card-actions>

        <v-divider class="my-2" />
      </template>

      <!-- ── Transmitir: servidor local (API com token + página de transmissão) ── -->
      <v-card-title class="px-0 text-subtitle-1 d-flex align-center gap-2">
        <v-icon size="18">mdi-broadcast</v-icon>
        <span>{{ t('transmit.title') }}</span>
        <v-switch
          :model-value="serverStatus.running"
          :loading="serverLoading"
          color="success"
          hide-details
          density="compact"
          class="flex-grow-0 ml-4"
          @update:modelValue="toggleServer"
        />
        <span class="text-body-2 text-medium-emphasis ml-1">
          {{ serverStatus.running ? t('transmit.running') : t('transmit.stopped') }}
        </span>
      </v-card-title>
      <v-card-text class="px-0">
        <small>{{ t('transmit.info') }}</small>
      </v-card-text>

      <template v-if="serverStatus.running">
        <v-card-text v-if="serverStatus.firewall && serverStatus.firewall.ok === false" class="px-0 pt-0">
          <v-alert type="warning" density="compact" variant="tonal">
            {{ t('transmit.firewall_warning') }}
          </v-alert>
        </v-card-text>

        <v-card-text class="px-0 d-flex gap-4 flex-wrap">
          <div style="flex:1; min-width:280px">
            <v-text-field
              :model-value="serverStatus.token"
              :label="t('transmit.token')"
              readonly
              density="compact"
              variant="outlined"
              prepend-icon="mdi-key-outline"
              hide-details
            >
              <template v-slot:append>
                <v-btn size="small" variant="text" icon="mdi-content-copy" @click="copyText(serverStatus.token)" />
                <v-btn size="small" variant="text" icon="mdi-refresh" :title="t('transmit.regenerate_token')" @click="confirmRegenerateToken" />
              </template>
            </v-text-field>

            <v-text-field
              v-for="link in serverUrls"
              :key="link.label"
              :model-value="link.value"
              :label="link.label"
              readonly
              class="mt-3"
              density="compact"
              variant="outlined"
              prepend-icon="mdi-link-variant"
              hide-details
            >
              <template v-slot:append>
                <v-btn size="small" variant="text" icon="mdi-content-copy" @click="copyText(link.value)" />
              </template>
            </v-text-field>

            <div v-if="otherIps.length" class="mt-3">
              <small class="text-medium-emphasis">{{ t('transmit.other_ips') }}</small>
              <div class="d-flex flex-wrap gap-2 mt-1">
                <v-chip
                  v-for="ip in otherIps"
                  :key="ip"
                  size="small"
                  variant="tonal"
                  :title="controlUrlFor(ip)"
                  @click="copyText(controlUrlFor(ip))"
                >
                  {{ ip }}
                </v-chip>
              </div>
            </div>
          </div>

          <div v-if="qrDataUrl" class="d-flex flex-column align-center justify-center">
            <img :src="qrDataUrl" width="140" height="140" alt="QR" />
            <span class="text-caption text-medium-emphasis mt-1">{{ t('transmit.control_page') }}</span>
          </div>
        </v-card-text>
      </template>
    </v-card>
  </ModuleContainer>
</template>

<script setup>
/* ########################################################### */
/* ####### INSTALAÇÃO DO MODULO ############################## */
/* ########################################################### */
import { ref, computed, getCurrentInstance, onMounted } from "vue";
import manifest from "../manifest.json";
import ModuleContainer from "@/components/ModuleContainer.vue";
const moduleContainer = ref(null);
const t = (key) => {
  if (!moduleContainer.value) {
    const tr = manifest.translations?.['pt'];
    if (tr) {
      const val = key.split('.').reduce((obj, k) => obj?.[k], tr);
      if (typeof val === 'string') return val;
    }
    return key;
  }
  const result = moduleContainer.value.t(key);
  return (result && result !== `modules.${manifest.id}.${key}`) ? result : key;
};
/* ########################################################### */
/* ########################################################### */
/* ########################################################### */

const { proxy } = getCurrentInstance();
const url = ref("");
const token = ref("");
const loading = ref(false);

const is_connected = computed(() => {
  return proxy.$userdata.get("remote.is_connected");
});

/* ########################################################### */
/* ###################### METHODS ############################# */
/* ########################################################### */

function getUrl(url) {
  url = url
    .trim()
    .replace(/\s+/g, "") // remove qualquer espaço na string
    .replace(/\\/g, "/") // converte \ para /
    .replace(/\/+$/, "");

  if (!/^https?:\/\//i.test(url)) {
    url = "http://" + url;
  }

  if (url == "http://") {
    url = "";
  }

  return url;
}

async function testUrl(url) {
  if (!url || url == "http://" || url == "https://") {
    return {
      message: "modules.remote_control.messages.url_not_provided",
      error: "",
      status: false,
    };
  }

  try {
    const response = await fetch(url + "/api/ping?token=" + token.value, {
      method: "GET",
      mode: "cors",
    });

    if (!response.ok) {
      return {
        message: "modules.remote_control.messages.url_not_provided",
        error: response.status,
        status: false,
      };
    }

    const data = await response.json();

    if (data.status != "ok") {
      return {
        message:
          data.code == "INVALID_TOKEN"
            ? "modules.remote_control.messages.invalid_token"
            : "modules.remote_control.messages.error",
        error: data.code,
        status: false,
      };
    }
    console.log(data);

    return {
      message: "modules.remote_control.messages.success",
      data: data,
      status: true,
    };
  } catch (error) {
    return {
      message: "modules.remote_control.messages.failed_to_connect",
      error: error.message,
      status: false,
    };
  }
}

async function test() {
  url.value = getUrl(url.value);

  loading.value = true;
  const ret = await testUrl(url.value);
  loading.value = false;

  if (!ret.status) {
    proxy.$alert.error({
      text: ret.message,
      error: ret.error,
    });
    return false;
  }

  if (!ret.status == "ok" && !ret.app == "LouvorJA") {
    proxy.$alert.error({
      text: ret.invalid_url,
    });
    return false;
  }

  proxy.$alert.info({
    text: "modules.remote_control.messages.success",
  });

  return true;
}

async function connect() {
  proxy.$userdata.set("remote.url", getUrl(url.value));
  proxy.$userdata.set("remote.token", token.value);

  if (!(await test())) {
    return;
  }

  proxy.$userdata.set("remote.is_connected", true);
}

function disonnect() {
  proxy.$userdata.set("remote.is_connected", false);
}

/* ########################################################### */
/* ############### TRANSMITIR (servidor local) ################ */
/* ########################################################### */

const serverStatus = ref({ running: false, port: 0, ip: "", ips: [], token: "" });
const serverLoading = ref(false);
const qrDataUrl = ref(null);

const serverUrls = computed(() => {
  if (!serverStatus.value.running) return [];
  const base = `http://${serverStatus.value.ip}:${serverStatus.value.port}`;
  const tk = serverStatus.value.token;
  return [
    // Sem "?token=" de propósito — esse é o link pensado pra ser copiado/
    // colado (WhatsApp, etc.); o QR code (refreshQrCode) é que carrega o
    // token embutido pra conectar direto ao ler. Quem abrir este link à mão
    // cai no modal de token normalmente (ver remote_pages.js).
    { label: t('transmit.control_page'), value: `${base}/remote` },
    { label: t('transmit.mirror_page'),  value: `${base}/mirror?token=${tk}` },
  ];
});

// IPs alternativos detectados na máquina — o primeiro (serverStatus.ip) é o
// escolhido automaticamente pra montar o QR code/links, mas se o PC tiver
// mais de uma rede ativa (Ethernet + Wi-Fi, VPN, etc.) o escolhido pode não
// ser o alcançável pelo celular; expõe os demais pra tentativa manual.
const otherIps = computed(() => {
  const ips = serverStatus.value.ips || [];
  return ips.filter((ip) => ip !== serverStatus.value.ip);
});

function controlUrlFor(ip) {
  // Sem token — mesmo motivo do link principal em serverUrls (link pra
  // copiar/compartilhar; token só embutido no QR code).
  return `http://${ip}:${serverStatus.value.port}/remote`;
}

async function refreshServerStatus() {
  const status = await proxy.$electron.remoteServerStatus();
  if (status) serverStatus.value = status;
  await refreshQrCode();
}

async function refreshQrCode() {
  if (!serverStatus.value.running) { qrDataUrl.value = null; return; }
  const base = `http://${serverStatus.value.ip}:${serverStatus.value.port}`;
  qrDataUrl.value = await proxy.$electron.qrcodeGenerate(`${base}/remote?token=${serverStatus.value.token}`, { width: 200 });
}

async function toggleServer(value) {
  serverLoading.value = true;
  try {
    if (value) {
      const status = await proxy.$electron.remoteServerStart();
      if (status) serverStatus.value = status;
    } else {
      await proxy.$electron.remoteServerStop();
      serverStatus.value = { ...serverStatus.value, running: false };
    }
    await refreshQrCode();
  } finally {
    serverLoading.value = false;
  }
}

function confirmRegenerateToken() {
  proxy.$alert.yesno("modules.remote_control.transmit.regenerate_confirm", async (btn) => {
    if (btn !== "yes") return;
    const newToken = await proxy.$electron.remoteServerRegenerateToken();
    if (newToken) serverStatus.value = { ...serverStatus.value, token: newToken };
    await refreshQrCode();
  });
}

function copyText(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text).catch(() => {});
}

/* ########################################################### */
/* ###################### MOUNTED ############################# */
/* ########################################################### */

onMounted(() => {
  url.value = proxy.$userdata.get("remote.url");
  token.value = proxy.$userdata.get("remote.token");
  refreshServerStatus();
});
</script>
