<script setup lang="ts">
import {computed, nextTick, onBeforeMount, onMounted, ref, watch} from 'vue'

import type {LineLyrics} from "src/plugins/synced-lyrics/types";
import {
  canonicalize,
  needsRomanization,
  romanize,
  simplifyUnicode
} from "src/plugins/synced-lyrics/renderer/utils";
import {
  DEFAULT_PROGRESS_COLOR,
  DEFAULT_PROGRESS_TRACK_COLOR,
} from "src/plugins/synced-lyrics/emojiColors";
import {useRoute} from "vue-router";
import {useHeightStore} from "stores/height";
import {useRomanizedStore} from "stores/romanized";

const route = useRoute();


const props = defineProps<{
  line: LineLyrics;
  current: number;
  durationMs: number;
  index: number;
  isLast?: boolean;
  artists?: string[];
}>()

const durationDiv = ref<HTMLDivElement | null>(null);

const status = computed(() => {

  if (props.line.timeInMs >= props.current) return 'upcoming';
  if (props.current - props.line.timeInMs >= props.line.duration) return 'previous';
  return 'current';
});

/** Injected empty line at t=0 — keep for timing, hide ♪ + countdown (always showed "3"). */
const isLeadingSilence = computed(
  () => props.index === 0 && !props.line.text.trim(),
);

/** Final empty silence → thank-you message instead of ♪. */
const isClosingSilence = computed(
  () => !!props.isLast && !props.line.text.trim(),
);

const closingGone = computed(
  () => isClosingSilence.value && props.current - props.line.timeInMs >= 3000,
);

const cuenta3 = computed(() => {
  const remaining = props.line.timeInMs - props.current
  if (remaining <= 0) {
    return "3"
  }
  if (remaining <= 1000) {
    return "2"
  }
  if (remaining <= 2000) {
    return "1"
  }
  if (remaining <= 3000) {
    return ""
  }
  return ""
})

const prog3 = computed(() => {
  const window = 3000
  const start = props.line.timeInMs - window
  const end = props.line.timeInMs

  if (props.current <= start) return 0
  if (props.current >= end) return 100

  const progress = (props.current - start) / window
  return progress * 100
})


const opacity = computed(() => {
  if (isClosingSilence.value) {
    if (props.current < props.line.timeInMs) {
      const abs = props.line.timeInMs - props.current;
      const maxDiff = 5000;
      const clamped = Math.min(abs, maxDiff);
      const t = 1 - clamped / maxDiff;
      return Math.max(Math.log1p(t * 9) / Math.log1p(9), 0);
    }
    const elapsed = props.current - props.line.timeInMs;
    if (elapsed >= 3000) return 0;
    return 1;
  }

  if (status.value === 'current') return 1;

  const abs = Math.abs(props.line.timeInMs - props.current);
  const maxDiff = 5000;
  const clamped = Math.min(abs, maxDiff);

  const t = 1 - clamped / maxDiff;

  const logNorm = Math.log1p(t * 9) / Math.log1p(9);

  //todo: just debug, return to 0
  return Math.max(logNorm, 0);
});

const wordRefs = ref<(HTMLElement | null)[]>([])
const setWordRef = (el: unknown, index: number) => {
  wordRefs.value[index] = el as HTMLElement
}

const romanjiRefs = ref<(HTMLElement | null)[]>([])
const setRomanjiRef = (el: unknown, index: number) => {
  romanjiRefs.value[index] = el as HTMLElement
}

//todo: dinamic rem by resolution
//small: 2rem
const heightStore = useHeightStore();

const baseFont = heightStore.baseFont;
const maxFont = heightStore.maxFont;  // 1080->4 1440->5 2160->6


const wordDelay = 100; // ms entre inicios de palabras
const growTime = 100; // ms que tarda en llegar al max

const smallKanji = route.query.smallKanji ?? false
const romanizedStore = useRomanizedStore()

watch(
  () => props.current,
  (current) => {

    romanizedStore.extraPlus()
    wordRefs.value.forEach((el, index) => {
      romanizedStore.extraPlus()
      popWord(el, index, current, small.value)
      romanizedStore.extraReady()
    });

    romanjiRefs.value.forEach((el, index) => {
      romanizedStore.extraPlus()
      popWord(el, index, current)
      romanizedStore.extraReady()
    });
    romanizedStore.extraReady()
  },
  {immediate: true}
);

function popWord(el: HTMLElement | null, index: number, current: number, small: string = '') {

  if (!el) return;
  if (small === 'small') {
    el.style.fontSize = `${heightStore.smallFont}vh`;
    return;
  }
  if (status.value !== 'current') {
    el.style.fontSize = `${baseFont}vh`;
    return;
  }

  const startTime = props.line.timeInMs + index * wordDelay;
  const endTime = startTime + growTime;

  let fontSize = baseFont;

  if (current >= startTime) {
    if (current <= endTime) {
      // Progreso de 0 a 1 durante el crecimiento
      const t = (current - startTime) / growTime;
      fontSize = baseFont + (maxFont - baseFont) * t;
    } else {
      // Ya creció al máximo → mantener en 4rem
      fontSize = maxFont;
    }
  }
  el.style.fontSize = `${fontSize}vh`;
}

const bigbangWordCores = new Set([
  'BIG',
  'BANG',
  'BIGBANG',
  'BIGZ',
])

const bigbangLetterCores = new Set([
  'B',
  'I',
  'G',
])

function normalizeArtistName(name: string): string {
  return name.trim().toUpperCase().replace(/[\s._-]+/g, '')
}

function lyricLetters(word: string): string {
  return word
    .trim()
    .toUpperCase()
    .replace(/[‘’‛ʻʼ]/g, "'")
    .replace(/[^A-Z]/g, '')
}

function isBigbangWord(word: string): boolean {
  return bigbangWordCores.has(lyricLetters(word))
}

function isBigbangLetterLine(text: string): boolean {
  const n = text
    .trim()
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
  return n.includes('B TO THE I TO THE G')
}

function isBigbangLetter(word: string): boolean {
  return bigbangLetterCores.has(lyricLetters(word))
}

const isBigbang = computed(() =>
  (props.artists ?? []).some((a) => normalizeArtistName(a) === 'BIGBANG'),
)

const pokeWords = [
  'pokémon',
  '(pokémon)',
  'pokémon,',
]

function applySpecialFonts(els: (HTMLElement | null)[]) {
  els.forEach((el) => {
    if (!el) return;
    const word = el.textContent ?? '';

    if (isBigbang.value) {
      if (isBigbangWord(word) || (isBigbangLetterLine(props.line.text) && isBigbangLetter(word))) {
        el.style.fontFamily = 'Earth,sans-serif';
        el.textContent = word.toUpperCase();
        return;
      }
    }

    const wordUp = word.trim().toLowerCase();
    if (pokeWords.includes(wordUp)) {
      el.classList.add('texto-pokemon')
    }
  });
}

onMounted(() => {
  applySpecialFonts(wordRefs.value)
})


const text = computed(() => {
  if (isClosingSilence.value) {
    return 'Gracias por ver 🫰';
  }
  if (!props.line.text.trim()) {
    // return config()?.defaultTextString ?? '';
    const param = route.query.defaultText
    return (Array.isArray(param) ? param[0] : param) ?? '♪';
  }

  return props.line.text;
});


let onlyFurigana = "";
let onlyKanjis = "";

const romanization = ref('')


const showRomanji = ref(false);
const small = ref('')
onBeforeMount(async () => {
  if (isLeadingSilence.value) {
    romanizedStore.lineReady()
    return
  }

  if (isClosingSilence.value) {
    onlyKanjis = text.value
    onlyFurigana = text.value
    romanization.value = 'Thanks for watching'
    showRomanji.value = true
    romanizedStore.lineReady()
    await nextTick()
    applySpecialFonts(wordRefs.value)
    applySpecialFonts(romanjiRefs.value)
    return
  }

  //TODO: configurable romanization
  // if (!config()?.romanization) return;
  onlyKanjis = text.value.replace(/\(([^|]+)\|([^)]+)\)/g, '$1');
  onlyFurigana = text.value.replace(/\(([^|]+)\|([^)]+)\)/g, '$2');
  const input = canonicalize(onlyFurigana);

  if (needsRomanization(input)) {
    romanization.value = canonicalize(await romanize(input))
    showRomanji.value = simplifyUnicode(input) !== simplifyUnicode(romanization.value)
  } else {
    romanization.value = input
    showRomanji.value = false
  }

  if (smallKanji && showRomanji.value) {
    small.value = 'small'
  }

  romanizedStore.lineReady()

  await nextTick()
  applySpecialFonts(wordRefs.value)
  applySpecialFonts(romanjiRefs.value)
})


function goToTime() {
  console.log('goToLine', props.line.timeInMs / 100);
  //TODO: call youtube api

}

const progressColor = computed(
  () => props.line.progressColor ?? DEFAULT_PROGRESS_COLOR,
);
const progressTrackColor = computed(
  () => props.line.progressTrackColor ?? DEFAULT_PROGRESS_TRACK_COLOR,
);
const progressStyle = computed(() => ({
  '--progress-color': progressColor.value,
  '--progress-track-color': progressTrackColor.value,
}));

</script>

<template>
  <div
    ref="refLine"
    class="col-12"
    :class="{
      'leading-silence': isLeadingSilence || closingGone,
    }"
    :style="{ opacity: isLeadingSilence || closingGone ? 0 : opacity }"
    :aria-hidden="isLeadingSilence || closingGone"
  >
    <template v-if="!isLeadingSilence && !closingGone">
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
          class="text-lyrics texto-con-borde-grueso"
          ref="durationDiv"
        >

          <div class="row justify-center items-center">
            <!--              color="teal"-->
            <q-circular-progress
              v-if="!showRomanji && !isClosingSilence"
              show-value
              instant-feedback
              :font-size="(maxFont-1)+'vh'"
              :value="prog3"
              :size="(maxFont+1)+'vh'"
              :thickness="0.2"
              track-color="grey-3"
              :style="progressStyle"
              class="q-ma-md texto-bordecito emoji-progress"
            >
              {{ cuenta3 }}
            </q-circular-progress>
            <span v-for="(word, index) in onlyKanjis.split(' ')" :key="index"
                  :ref="el=>setWordRef(el,index)">
                    {{ word }}&ensp;
            </span>
            <img
              v-if="isClosingSilence"
              class="mexico-flag"
              :style="{ height: baseFont + 'vh' }"
              src="/icons/flag-mexico.png"
              alt="🇲🇽"
            >
          </div>

          <!--        TODO: config()?.romanization-->
          <div class="romaji row justify-center texto-con-borde-grueso"
               v-if="showRomanji">
            <q-circular-progress
              v-if="!isClosingSilence"
              show-value
              instant-feedback
              :font-size="(maxFont-1)+'vh'"
              :value="prog3"
              :size="(maxFont+1)+'vh'"
              :thickness="0.2"
              track-color="grey-3"
              :style="progressStyle"
              class="q-ma-md texto-bordecito emoji-progress"
            >
              {{ cuenta3 }}
            </q-circular-progress>
            <span v-for="(word, index) in romanization.split(' ')" :key="index"
                  :ref="el=>setRomanjiRef(el,index)">
  <!--                      <yt-formatted-string>-->
                  {{ word }}&ensp;
              <!--                      </yt-formatted-string>-->
            </span>
          </div>

        </div>
      </div>

    </div>
    </template>
  </div>


</template>

<style scoped lang="scss">
@use "sass:math";
@use 'sass:list';

:deep(.emoji-progress .q-circular-progress__circle) {
  color: var(--progress-color, #2c00cc);
}

:deep(.emoji-progress .q-circular-progress__track) {
  stroke: var(--progress-track-color, #e0e0e0);
}

.leading-silence {
  height: 0;
  overflow: hidden;
  pointer-events: none;
}

.mexico-flag {
  display: inline-block;
  vertical-align: middle;
  margin-left: 0.15em;
}

.current {
  font-weight: bold;
  //font-size: 4rem;

}

.upcoming, .previous {
  font-weight: normal;
  //font-size: 3rem;

}

.upcoming, .previous, .current {
  font-family: Verdana, sans-serif;
  //font-family: ;
  color: white;
  paint-order: stroke fill;

}

.small {
  //font-size: 2rem;
  //-webkit-text-stroke: .3rem black;
}

@mixin text-outline($width: 2px, $color: black) {
  $shadows: ();

  @for $i from -$width through $width {
    @for $j from -$width through $width {
      $shadows: append($shadows, #{$i}px #{$j}px 0 $color, comma);
    }
  }
  $shadows: append($shadows, .5vh .5vh .5vh black, comma);

  text-shadow: $shadows;
}


@mixin math-text-outline($offset, $color, $num-steps: 16) {
  $shadows: ();
  @for $i from 0 to $num-steps {
    //$angle: $i * 360deg / $num-steps;
    $angle: math.div($i * 360deg, $num-steps);
    $x: calc(#{math.cos($angle)} * #{$offset});
    $y: calc(#{math.sin($angle)} * #{$offset});
    $shadows: list.append($shadows, #{$x} #{$y} 0 #{$color}, $separator: comma);
  }
  $shadows: append($shadows, 1.75vh 1.75vh 1.75vh black, comma);

  text-shadow: $shadows;
}

.texto-con-borde-grueso {
  color: white;
  // heavy af
  //@include text-outline(3, black); /* 3px de grosor */

  //Firefox, Safari and (Chrome, since March 2024) broken streamlabs feb 2026
  //-webkit-text-stroke: 5px black;
  //paint-order: stroke fill;


  @include math-text-outline($offset: calc(.5vh + 0.2em),
  $color: black,
  $num-steps: 32);
}

.texto-bordecito {
  color: white;

  @include math-text-outline($offset: calc(.05vh),
  $color: black,
  $num-steps: 32);
}

.texto-pokemon {
  color: #ffcb02;
  font-family: pokemonFont, serif;
  @include text-outline(5, #0065b0); /* 3px de grosor */
  letter-spacing: 10px;
}

</style>
