<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container id="scene">
      <RenderLyrics/>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import RenderLyrics from "src/plugins/synced-lyrics/renderer/RenderLyrics.vue";
</script>

<style>
#scene {
  width: 1920px;
  height: 1080px;
}
</style>
