<script setup lang="ts">
import {ref, onMounted, onUnmounted} from "vue";

const states = [
  '(>_<)',
  '{ (>_<) }',
  '{{ (>_<) }}',
  '{{{ (>_<) }}}',
  '{{ (>_<) }}',
  '{ (>_<) }',
];

const counter = ref(0)
let interval: NodeJS.Timeout | null = null

onMounted(() => {
  interval = setInterval(() => {
    counter.value++
  }, 500)
})

onUnmounted(() => {
  if (interval) {
    clearInterval(interval)
  }
})
</script>

<template>
  <div class="text-lyrics description ytmusic-description-shelf-renderer"
       :style="{display: 'inline-flex',
      'justify-content': 'center',
          width: '100%',
          'user-select': 'none'}">
    {{ states[counter % states.length] }}
  </div>
  <!--  <div
      class="text-lyrics description ytmusic-description-shelf-renderer"
      :style="{display: 'inline-flex',
      'justify-content': 'center',
          width: '100%',
          'user-select': 'none'}">
        {{ states[counter % states.length]}}
    </div>-->
</template>

<style scoped>

</style>
