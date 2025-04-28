<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'

import type {LineLyrics} from "src/plugins/synced-lyrics/types";
import {
  canonicalize, romanizeChinese,
  romanizeHangul,
  romanizeJapanese,
  romanizeJapaneseOrHangul, simplifyUnicode
} from "src/plugins/synced-lyrics/renderer/utils";


const props = defineProps<{
  line: LineLyrics;
  hasJapanese: boolean;
  hasKorean: boolean;
  current: number;
}>()

const durationDiv = ref<HTMLDivElement | null>(null);

const status = computed(() => {

  if (props.line.timeInMs >= props.current) return 'upcoming';
  if (props.current - props.line.timeInMs >= props.line.duration) return 'previous';
  return 'current';
});

const text = computed(() => {
  if (!props.line.text.trim()) {
    // return config()?.defaultTextString ?? '';
    return '';
  }

  return props.line.text;
});

const romanization = ref('')

/*watch(text, async (newText) => {
  console.log(newText);
  //TODO: configurable romanization
  // if (!config()?.romanization) return;

  const input = canonicalize(newText);

  let result: string;
  if (props.hasJapanese) {
    if (props.hasKorean) result = await romanizeJapaneseOrHangul(input);
    else result = await romanizeJapanese(input);
  } else if (props.hasKorean) result = romanizeHangul(input);
  else result = romanizeChinese(input);

  romanization.value = canonicalize(result);
});*/

onMounted(async () => {
  //TODO: configurable romanization
  // if (!config()?.romanization) return;

  const input = canonicalize(text.value);

  let result: string;
  if (props.hasJapanese) {
    if (props.hasKorean) result = await romanizeJapaneseOrHangul(input);
    else result = await romanizeJapanese(input);
  } else if (props.hasKorean) result = romanizeHangul(input);
  else result = romanizeChinese(input);

  romanization.value = canonicalize(result);
})

watch(() => props.line.duration, (newDuration) => {
  console.log('watch 74')
  if (durationDiv.value) {
    durationDiv.value.style.setProperty(
      '--lyrics-duration',
      `${newDuration / 1000}s`,
      'important'
    );
  }
})

function goToTime() {
  console.log('goToLine', props.line.timeInMs / 100);
  //TODO: call youtube api

}

</script>

<template>
  <div v-if="!text">

  </div>
  <div
    v-else
    :class="'synced-line '+status"
    @click="goToTime()">
    <div dir="auto" class="description ytmusic-description-shelf-renderer">
      <!--TODO: configurable showTimeCodes
      <yt-formatted-string v-if="config()?.showTimeCodes">
              {{`[${props.line.time}] `}}
            </yt-formatted-string>
       -->
      <!--         TODO: Investigate the animation, even though the duration is properly set, all lines have the same animation duration-->
      <div
        class="text-lyrics"
        ref="durationDiv"
        :style="{
        display: 'flex',
        'flex-direction': 'column' }">
        <span>
          <span v-for="(word, index) in text.split(' ')" :key="index"
                :style="{ 'transition-delay': `${index * 0.05}s`,
                      'animation-delay': `${index * 0.05}s`,}">
                      <yt-formatted-string>
                     {{ `${word} ` }}
                      </yt-formatted-string>
          </span>
        </span>

        <!--        TODO: config()?.romanization-->
        <span class="romaji" v-if="simplifyUnicode(text) !== simplifyUnicode(romanization)">
          <span v-for="(word, index) in romanization.split(' ')" :key="index"
                :style="{ 'transition-delay': `${index * 0.05}s`,
                      'animation-delay': `${index * 0.05}s`,}">
                      <yt-formatted-string>
                        {{ `${word} ` }}
                      </yt-formatted-string>
          </span>
        </span>

      </div>
    </div>

  </div>

</template>

<style scoped>

</style>
