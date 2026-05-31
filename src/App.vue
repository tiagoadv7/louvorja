<template>
  <AppLoading />
  <v-btn
    v-show="false"
    @shortkey="handleKeydown()"
    v-shortkey="['ctrl', 'alt', 'd']"
  />
  <v-app id="app-container">
    <router-view />
  </v-app>
</template>

<script>
import AppLoading from "@/layout/Loading.vue";

export default {
  name: "App",
  components: {
    AppLoading,
  },
  methods: {
    handleKeydown() {
      console.log("click ");
      this.$dev.toogle();
    },
  },
};
</script>

<style>
#app-container > .v-application__wrap {
  height: 100vh;
}
</style>
