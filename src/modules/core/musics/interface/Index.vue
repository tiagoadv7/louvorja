<template>
  <ModuleContainer
    ref="moduleContainer"
    :manifest="manifest"
    compact
    @close="close()"
    @scroll="onScroll"
    @hasScroll="hasScroll"
    :index="data.count"
  >
    <template v-slot:header>
      <div :class="classform.group">
        <div :class="classform.group_item" style="flex-basis: 600px">
          <Search
            v-model="search"
            :label="t('inputs.search')"
            :error="data.filter_count <= 0"
            :disabled="disabled"
            :disabled-hint="t('inputs.search_disabled')"
          />
        </div>
        <div :class="classform.group_item" style="flex-basis: 350px">
          <Checkbox
            v-model="userdata.search.name"
            :label="t('inputs.filter_name')"
          />
          <Checkbox
            v-model="userdata.search.lyric"
            :label="t('inputs.filter_lyric')"
          />
          <Checkbox
            v-model="userdata.search.album"
            :label="t('inputs.filter_album')"
          />
          <Checkbox
            v-model="userdata.search.track"
            :label="t('inputs.filter_track')"
          />
        </div>
        <v-divider vertical />
        <div :class="classform.group_item" style="flex-basis: 200px">
          <div>
            <Checkbox
              switch
              v-model="userdata.filter.instrumental_music"
              :label="t('inputs.filter_instrumental')"
            />
          </div>
          <div>
            <Checkbox
              switch
              v-model="userdata.filter.custom_collections"
              :label="t('inputs.filter_custom_collections')"
            />
          </div>
        </div>
      </div>
    </template>

    <Table
      v-model="data"
      :search="search"
      :letter="letter"
      :searchable_fields="{
        name: search_name,
        lyric: search_lyric,
        albums_names: search_album,
        track: search_track,
      }"
      :filter="{ has_instrumental_music: filter_instrumental_music }"
      :disabled_albums="disabled_albums"
      :scroll="scroll"
      :has_scroll="has_scroll"
      sort_by="name"
      :file="`${$i18n.locale}_musics`"
    >
      <thead>
        <tr>
          <th class="text-left">{{ t("table.music_name") }}</th>
          <th v-if="!compact" class="text-left">
            {{ t("table.album_name") }}
          </th>
          <th class="text-right">{{ t("table.duration") }}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in data.data" :key="item.id_music">
          <td>
            {{ item.name }}
            <div v-if="compact" class="pb-1">
              <v-chip
                v-for="album in item.albums"
                :key="album.id_album"
                :color="$theme.primary()"
                size="x-small"
                @click="openAlbum(album.id_album)"
              >
                {{ album.name }}
              </v-chip>
            </div>
          </td>
          <td v-if="!compact">
            <v-chip
              v-for="album in item.albums"
              :key="album.id_album"
              :color="$theme.primary()"
              density="compact"
              @click="openAlbum(album.id_album)"
            >
              {{ album.name }}
            </v-chip>
          </td>
          <td class="text-right">{{ $datetime.shortTime(item.duration) }}</td>
          <td>
            <div class="d-flex justify-end">
              <MusicMenuTable
                :id_music="item.id_music"
                :has_instrumental_music="item.has_instrumental_music"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </Table>

    <v-alert
      v-if="search && data.filter_count <= 0"
      type="error"
      :text="t('data.not_found')"
      variant="tonal"
      border="start"
      class="ma-2"
    />

    <!-- Resultados de "Coletâneas Personalizadas" -- fonte totalmente
         separada do catálogo (arquivos do usuário, não a tabela pt_musics),
         então não dá pra usar o :filter/:searchable_fields da Table acima
         (ver DataTable.vue, filtra só DENTRO de um dataset já carregado).
         Clicar num resultado abre o módulo custom_collections já na
         coletânea que contém aquela música (mesmo deep-link usado por
         "Coletâneas" > categoria "Coletâneas Personalizadas", ver
         modules/core/collections/interface/Index.vue#openAlbum). -->
    <template v-if="userdata.filter.custom_collections && search">
      <v-divider class="my-1" />
      <div class="text-caption text-medium-emphasis px-3 pt-2 pb-1">
        {{ t("data.custom_collections_results") }}
      </div>
      <v-list v-if="customCollectionMatches.length" density="compact">
        <v-list-item
          v-for="song in customCollectionMatches"
          :key="song.id"
          :title="song.nome"
          rounded="lg"
          prepend-icon="mdi-folder-music-outline"
          @click="openCustomSong(song)"
        />
      </v-list>
      <div v-else class="text-caption text-medium-emphasis px-3 pb-2">
        {{ t("data.not_found") }}
      </div>
    </template>

    <template v-slot:footer>
      <div class="w-100">
        <LetterPaginate v-model="letter" />
        <div class="text-right">
          <small>
            {{ t("data.records") }}:
            {{ data.filter_count }}
          </small>
        </div>
      </div>
    </template>
  </ModuleContainer>
</template>

<script setup>
/* ########################################################### */
/* ####### INSTALAÇÃO DO MODULO ############################## */
/* ########################################################### */
import { ref, computed, getCurrentInstance } from "vue";
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
const userdata = computed(() => {
  return moduleContainer.value?.userdata;
});
/* ########################################################### */
/* ########################################################### */
/* ########################################################### */

import { watch } from "vue";
import Table from "@/components/DataTable.vue";
import Search from "@/components/inputs/Search.vue";
import Checkbox from "@/components/inputs/CheckBox.vue";
import MusicMenuTable from "@/components/MusicMenuTable.vue";
import LetterPaginate from "@/components/LetterPagination.vue";
import CustomSongs from "@/helpers/CustomSongs";

/* -------------------------------------------------- */
/* STATE                                              */
/* -------------------------------------------------- */
const { proxy } = getCurrentInstance();

const search = ref("");
const data = ref([]);
const scroll = ref({});
const has_scroll = ref(false);
const letter = ref("");

/* -------------------------------------------------- */
/* COMPUTEDS                                          */
/* -------------------------------------------------- */
const search_name = computed(() => {
  return userdata.value.search.name;
});

const search_lyric = computed(() => {
  return userdata.value.search.lyric;
});

const search_album = computed(() => {
  return userdata.value.search.album;
});

const search_track = computed(() => {
  return userdata.value.search.track;
});

const filter_instrumental_music = computed(() => {
  return userdata.value.filter.instrumental_music;
});

/* -------------------------------------------------- */
/* COLETÂNEAS PERSONALIZADAS (busca opcional)         */
/* -------------------------------------------------- */
// Carregado uma única vez, sob demanda (só quando o operador liga o
// checkbox pela primeira vez) -- são arquivos locais do usuário, não a
// tabela pt_musics já carregada pela Table acima, então não tem custo de
// rede, mas também não precisa ler disco à toa se ninguém usar isso.
const customSongs = ref([]);
const customCollectionsList = ref([]);
const customCollectionsLoaded = ref(false);

async function loadCustomCollectionsData() {
  if (customCollectionsLoaded.value) return;
  customCollectionsLoaded.value = true;
  customSongs.value = await CustomSongs.listSongs();
  customCollectionsList.value = await CustomSongs.listCollections();
}

watch(
  () => userdata.value.filter.custom_collections,
  (on) => { if (on) loadCustomCollectionsData(); },
  { immediate: true },
);

const customCollectionMatches = computed(() => {
  const q = proxy.$string.clean(search.value || "");
  if (!q) return [];
  return customSongs.value.filter((s) => proxy.$string.clean(s.nome || "").includes(q));
});

// Álbuns desativados pelo operador (ver Menu.vue > "Gerenciar Álbuns") —
// músicas cujo(s) álbum(ns) estão TODOS desativados somem desta listagem
// (ver DataTable.vue#filterData, prop disabled_albums).
const disabled_albums = computed(() => {
  return proxy.$userdata.get("options.disabled_albums", []);
});

const disabled = computed(() => {
  return (
    !search_name.value &&
    !search_lyric.value &&
    !search_album.value &&
    !search_track.value
  );
});

const classform = computed(() => ({
  group: "d-flex flex-wrap",
  group_item: "flex-shrink-1 flex-grow-1 d-flex flex-wrap justify-space-around",
}));

const compact = computed(() => {
  return proxy.$vuetify.display.width <= 800;
});

/* -------------------------------------------------- */
/* METHODS                                            */
/* -------------------------------------------------- */
function onScroll(value) {
  scroll.value = value;
}

function hasScroll(value) {
  has_scroll.value = value;
}

function openAlbum(id_album) {
  proxy.$media.openAlbum(id_album);
}

// Abre a coletânea personalizada que contém essa música (pode estar em mais
// de uma -- pega a primeira) no módulo custom_collections, já selecionada
// (mesmo deep-link de collections/interface/Index.vue#openAlbum). Sem
// nenhuma coletânea encontrada (música ainda não adicionada a nenhuma),
// abre o módulo mesmo assim, só sem apontar pra uma coletânea específica.
function openCustomSong(song) {
  const collection = customCollectionsList.value.find((c) =>
    (c.items || []).some((i) => i.type === "custom" && i.id === song.id)
  );
  if (collection) {
    proxy.$appdata.set("modules.custom_collections.open_collection_id", collection.id);
  }
  proxy.$modules.open("custom_collections");
}

function close() {
  search.value = "";
}
</script>
