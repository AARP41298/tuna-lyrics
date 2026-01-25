<script setup lang="ts">


import LyricsContainer from "components/LyricsContainer.vue";

import {computed, onMounted} from "vue";

const config = () => ({
  enabled: true,
  lineEffect: 'fancy', // ejemplo
});
// watchEffect(() => {
onMounted(() => {
  if (!config().enabled) return;

  const root = document.documentElement;

  switch (config().lineEffect) {
    case 'fancy':
      root.style.setProperty('--lyrics-font-size', '3rem');
      root.style.setProperty('--lyrics-line-height', '1.333');
      root.style.setProperty('--lyrics-width', '100%');
      root.style.setProperty('--lyrics-padding', '2rem');
      root.style.setProperty(
        '--lyrics-animations',
        'lyrics-glow var(--lyrics-glow-duration) forwards, lyrics-wobble var(--lyrics-wobble-duration) forwards',
      );

      root.style.setProperty('--lyrics-inactive-font-weight', '700');
      root.style.setProperty('--lyrics-inactive-opacity', '0.33');
      root.style.setProperty('--lyrics-inactive-scale', '0.95');
      root.style.setProperty('--lyrics-inactive-offset', '0');

      root.style.setProperty('--lyrics-active-font-weight', '700');
      root.style.setProperty('--lyrics-active-opacity', '1');
      root.style.setProperty('--lyrics-active-scale', '1');
      root.style.setProperty('--lyrics-active-offset', '0');
      break;
    case 'scale':
      root.style.setProperty(
        '--lyrics-font-size',
        'clamp(1.4rem, 1.1vmax, 3rem)',
      );
      root.style.setProperty(
        '--lyrics-line-height',
        'var(--ytmusic-body-line-height)',
      );
      root.style.setProperty('--lyrics-width', '83%');
      root.style.setProperty('--lyrics-padding', '0');
      root.style.setProperty('--lyrics-animations', 'none');

      root.style.setProperty('--lyrics-inactive-font-weight', '400');
      root.style.setProperty('--lyrics-inactive-opacity', '0.33');
      root.style.setProperty('--lyrics-inactive-scale', '1');
      root.style.setProperty('--lyrics-inactive-offset', '0');

      root.style.setProperty('--lyrics-active-font-weight', '700');
      root.style.setProperty('--lyrics-active-opacity', '1');
      root.style.setProperty('--lyrics-active-scale', '1.2');
      root.style.setProperty('--lyrics-active-offset', '0');
      break;
    case 'offset':
      root.style.setProperty(
        '--lyrics-font-size',
        'clamp(1.4rem, 1.1vmax, 3rem)',
      );
      root.style.setProperty(
        '--lyrics-line-height',
        'var(--ytmusic-body-line-height)',
      );
      root.style.setProperty('--lyrics-width', '100%');
      root.style.setProperty('--lyrics-padding', '0');
      root.style.setProperty('--lyrics-animations', 'none');

      root.style.setProperty('--lyrics-inactive-font-weight', '400');
      root.style.setProperty('--lyrics-inactive-opacity', '0.33');
      root.style.setProperty('--lyrics-inactive-scale', '1');
      root.style.setProperty('--lyrics-inactive-offset', '0');

      root.style.setProperty('--lyrics-active-font-weight', '700');
      root.style.setProperty('--lyrics-active-opacity', '1');
      root.style.setProperty('--lyrics-active-scale', '1');
      root.style.setProperty('--lyrics-active-offset', '5%');
      break;
    case 'focus':
      root.style.setProperty(
        '--lyrics-font-size',
        'clamp(1.4rem, 1.1vmax, 3rem)',
      );
      root.style.setProperty(
        '--lyrics-line-height',
        'var(--ytmusic-body-line-height)',
      );
      root.style.setProperty('--lyrics-width', '100%');
      root.style.setProperty('--lyrics-padding', '0');
      root.style.setProperty('--lyrics-animations', 'none');

      root.style.setProperty('--lyrics-inactive-font-weight', '400');
      root.style.setProperty('--lyrics-inactive-opacity', '0.33');
      root.style.setProperty('--lyrics-inactive-scale', '1');
      root.style.setProperty('--lyrics-inactive-offset', '0');

      root.style.setProperty('--lyrics-active-font-weight', '700');
      root.style.setProperty('--lyrics-active-opacity', '1');
      root.style.setProperty('--lyrics-active-scale', '1');
      root.style.setProperty('--lyrics-active-offset', '0');
      break;
  }
});

import {ref} from "vue";
import {useHeightStore} from "stores/height";

const time = ref(0)

function reciveTime(currentTime: number) {
  time.value = currentTime
}

const opacity = computed(() => {
  if (time.value < 5000) return 1;

  const abs = Math.abs(5000 - time.value);
  const maxDiff = 5000;
  const clamped = Math.min(abs, maxDiff);

  const t = 1 - clamped / maxDiff;

  const logNorm = Math.log1p(t * 9) / Math.log1p(9);

  //todo: just debug, return to 0
  return Math.max(logNorm, 0);
});

const marcaFont = ref(2)
const heightStore = useHeightStore();
marcaFont.value = heightStore.baseFont

</script>

<template>
  <div class="lyrics-renderer"
       style="overflow: hidden;
  margin: 0;
  padding: 0;">
     <span :style="{
       'font-size': marcaFont + 'rem',
        color: 'white',
         position: 'absolute',
         opacity: opacity,
         top: '5%',
         left: '5%',
         }">
      By <span style="font-family: Earth,sans-serif">AARP</span> music
    </span>
    <LyricsContainer @update-time="reciveTime"/>
  </div>
</template>

<style scoped>

</style>
