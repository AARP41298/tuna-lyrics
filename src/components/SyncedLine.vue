<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'

import type {LineLyrics} from "src/plugins/synced-lyrics/types";
import {
  canonicalize,
  romanizeChinese,
  romanizeHangul,
  romanizeJapanese,
  romanizeJapaneseOrHangul,
  simplifyUnicode
} from "src/plugins/synced-lyrics/renderer/utils";
import {useRoute} from "vue-router";

const route = useRoute();


const props = defineProps<{
  line: LineLyrics;
  hasJapanese: boolean;
  hasKorean: boolean;
  current: number;
  durationMs: number;
}>()

const durationDiv = ref<HTMLDivElement | null>(null);

const status = computed(() => {

  if (props.line.timeInMs >= props.current) return 'upcoming';
  if (props.current - props.line.timeInMs >= props.line.duration) return 'previous';
  return 'current';
});


const opacity = computed(() => {
  if (status.value === 'current') return 1;

  const abs = Math.abs(props.line.timeInMs - props.current);
  const maxDiff = 5000;
  const clamped = Math.min(abs, maxDiff);

  const t = 1 - clamped / maxDiff;

  const logNorm = Math.log1p(t * 9) / Math.log1p(9);

  return Math.max(logNorm, 0.05);
});

const refLine = ref<HTMLDivElement | undefined>(undefined);
watch(status, () => {
  if (status.value === 'current') {
    refLine.value?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    })
  }
})

const text = computed(() => {
  if (!props.line.text.trim()) {
    // return config()?.defaultTextString ?? '';
    const param = route.query.defaultText
    return (Array.isArray(param) ? param[0] : param) ?? '♪';
  }

  return props.line.text;
});

const romanization = ref('')


const smallKanji = route.query.smallKanji ?? false
const showRomanji = ref(false);
const small = ref('')
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

  showRomanji.value = simplifyUnicode(text.value) !== simplifyUnicode(romanization.value)
  if (smallKanji && showRomanji.value) {
    small.value = 'small'
  }
})

onMounted(() => {
  if (durationDiv.value) {
    durationDiv.value.style.setProperty(
      '--lyrics-duration',
      `${props.line.duration / 1000}s`,
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
  <div ref="refLine" class="col-12" :style="{'opacity': opacity}">

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
        >
        <span :class="'row justify-center ' +small">
          <span v-for="(word, index) in text.split(' ')" :key="index"
                :style="{ 'transition-delay': `${index * 0.05}s`,
                      'animation-delay': `${index * 0.05}s`,}">
<!--                      <yt-formatted-string>-->
                {{ word }}&ensp;
            <!--                      </yt-formatted-string>-->
          </span>
        </span>

          <!--        TODO: config()?.romanization-->
          <span class="romaji row justify-center"
                v-if="showRomanji">
            <span v-for="(word, index) in romanization.split(' ')" :key="index"
                  :style="{ 'transition-delay': `${index * 0.05}s`,
                        'animation-delay': `${index * 0.05}s`,}">
  <!--                      <yt-formatted-string>-->
                  {{ word }}&ensp;
              <!--                      </yt-formatted-string>-->
            </span>
        </span>

        </div>
      </div>

    </div>
  </div>


</template>

<style scoped lang="scss">
.current {
  font-weight: bold;
  font-size: 4rem;
  -webkit-text-stroke: .5rem black;
}

.upcoming, .previous {
  font-weight: normal;
  font-size: 3rem;
  -webkit-text-stroke: .2rem black;
}

.upcoming, .previous, .current {
  font-family: Verdana, sans-serif;
  color: white;
  text-shadow: .5rem .5rem .5rem black;
  paint-order: stroke fill;

}

.small {
  font-size: 2rem;
  -webkit-text-stroke: .3rem black;

}

</style>
