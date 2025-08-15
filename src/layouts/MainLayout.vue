<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container id="scene" :style="{
      width: width + 'px',
      height: height + 'px',
    }">
      <RenderLyrics/>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import RenderLyrics from "src/plugins/synced-lyrics/renderer/RenderLyrics.vue";
import {onBeforeMount, ref} from "vue";
import {useRoute} from "vue-router";
import {useHeightStore} from "stores/height";
const heightStore = useHeightStore();

const route = useRoute();

const width = ref(1920)
const height = ref(1080)

onBeforeMount(() => {
  const h = Array.isArray(route.query.height)
    ? route.query.height[0] ?? '1080'
    : route.query.height ?? '1080'

  height.value = parseInt(h)
  heightStore.setHeight(height.value)


  const w = Array.isArray(route.query.width)
    ? route.query.width[0] ?? '1920'
    : route.query.width ?? '1920'
  width.value = parseInt(w)


})

</script>

<style>
/*#scene {
  width: 1920px;
  height: 1080px;
}*/
</style>
