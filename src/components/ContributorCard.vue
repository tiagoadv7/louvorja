<template>
  <v-col cols="12" sm="6" md="4" lg="3">
    <v-card class="contributor-card" rounded="lg" variant="outlined">
      <div class="contributor-card-body">
        <v-avatar size="72" class="contributor-avatar">
          <v-img
            v-if="currentSrc && !showFallbackAvatar"
            :src="currentSrc"
            cover
            @error="onAvatarError"
          />
          <v-icon v-else icon="mdi-account" size="36" color="grey-lighten-1" />
        </v-avatar>
        <div class="contributor-info">
          <div class="contributor-name">{{ contributor.name }}</div>
          <div v-if="contributor.description" class="contributor-description">
            <template v-if="Array.isArray(contributor.description)">
              <v-chip
                v-for="role in contributor.description"
                :key="role"
                size="x-small"
                variant="tonal"
                color="primary"
                class="mr-1 mb-1"
              >
                {{ role }}
              </v-chip>
            </template>
            <template v-else>
              {{ contributor.description }}
            </template>
          </div>
        </div>
      </div>
      <div v-if="hasLinks" class="contributor-links">
        <v-btn
          v-if="contributor.github"
          :href="`https://github.com/${contributor.github}`"
          icon="mdi-github"
          variant="text"
          size="small"
          density="comfortable"
          target="_blank"
          rel="noopener noreferrer"
        />
        <v-btn
          v-if="contributor.linkedin"
          :href="`https://linkedin.com/in/${contributor.linkedin}`"
          icon="mdi-linkedin"
          variant="text"
          size="small"
          density="comfortable"
          target="_blank"
          rel="noopener noreferrer"
        />
        <v-btn
          v-if="contributor.facebook"
          :href="contributor.facebook.startsWith('http') ? contributor.facebook : `https://facebook.com/${contributor.facebook}`"
          icon="mdi-facebook"
          variant="text"
          size="small"
          density="comfortable"
          target="_blank"
          rel="noopener noreferrer"
        />
        <v-btn
          v-if="contributor.instagram"
          :href="`https://instagram.com/${contributor.instagram}`"
          icon="mdi-instagram"
          variant="text"
          size="small"
          density="comfortable"
          target="_blank"
          rel="noopener noreferrer"
        />
        <v-btn
          v-if="contributor.x"
          :href="`https://x.com/${contributor.x}`"
          icon="mdi-twitter"
          variant="text"
          size="small"
          density="comfortable"
          target="_blank"
          rel="noopener noreferrer"
        />
        <v-btn
          v-if="contributor.website"
          :href="contributor.website"
          icon="mdi-web"
          variant="text"
          size="small"
          density="comfortable"
          target="_blank"
          rel="noopener noreferrer"
        />
        <v-btn
          v-if="contributor.whatsapp"
          :href="`https://wa.me/${contributor.whatsapp}`"
          icon="mdi-whatsapp"
          variant="text"
          size="small"
          density="comfortable"
          target="_blank"
          rel="noopener noreferrer"
        />
        <v-btn
          v-if="contributor.website2"
          :href="contributor.website2"
          icon="mdi-web"
          variant="text"
          size="small"
          density="comfortable"
          target="_blank"
          rel="noopener noreferrer"
        />
        <v-btn
          v-if="contributor.email"
          :href="`mailto:${contributor.email}`"
          icon="mdi-email-outline"
          variant="text"
          size="small"
          density="comfortable"
          target="_blank"
          rel="noopener noreferrer"
        />
      </div>
    </v-card>
  </v-col>
</template>

<script>
export default {
  name: "ContributorCard",
  props: {
    contributor: {
      type: Object,
      required: true,
    },
  },
  data: () => ({
    avatarFallbackIndex: 0,
    showFallbackAvatar: false,
  }),
  computed: {
    // Tenta foto real (avatar do GitHub, do Facebook, ou favicon do site),
    // caindo pra próxima fonte se a anterior der 404 — sem isso a maioria
    // dos colaboradores (que só tem e-mail/link) ficaria sem nenhuma imagem.
    avatarSources() {
      const c = this.contributor;
      const sources = [];
      if (c.image) sources.push(c.image);
      if (c.github) sources.push(`https://github.com/${c.github}.png`);
      if (c.facebook && !c.facebook.startsWith("http")) {
        sources.push(`https://graph.facebook.com/${c.facebook}/picture?type=square`);
      }
      if (c.website) {
        const domain = c.website.replace(/^https?:\/\//, "").split("/")[0];
        sources.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
      }
      return sources;
    },
    currentSrc() {
      if (this.showFallbackAvatar) return null;
      return this.avatarSources[this.avatarFallbackIndex] ?? null;
    },
    hasLinks() {
      const c = this.contributor;
      return !!(c.github || c.linkedin || c.facebook || c.instagram || c.x || c.website || c.website2 || c.whatsapp || c.email);
    },
  },
  methods: {
    onAvatarError() {
      const next = this.avatarFallbackIndex + 1;
      if (next < this.avatarSources.length) {
        this.avatarFallbackIndex = next;
      } else {
        this.showFallbackAvatar = true;
      }
    },
  },
};
</script>

<style scoped>
.contributor-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}
.contributor-card:hover {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 2px 12px rgba(var(--v-theme-primary), 0.15);
}
.contributor-card-body {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 16px 12px;
  flex: 1;
}
.contributor-avatar {
  flex-shrink: 0;
  border: 2px solid rgba(var(--v-theme-on-surface), 0.15);
}
.contributor-info {
  min-width: 0;
  flex: 1;
}
.contributor-name {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
}
.contributor-description {
  font-size: 12.5px;
  color: rgba(var(--v-theme-on-surface), 0.65);
  line-height: 1.4;
  margin-top: 4px;
}
.contributor-links {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 0 8px 8px;
  justify-content: center;
}
</style>
