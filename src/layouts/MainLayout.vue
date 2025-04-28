<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <RenderLyrics/>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import RenderLyrics from "src/plugins/synced-lyrics/renderer/RenderLyrics.vue";
</script>
