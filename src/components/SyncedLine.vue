<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'

import type {LineLyrics} from "src/plugins/synced-lyrics/types";
import {
  canonicalize,
  romanize,
  simplifyUnicode
} from "src/plugins/synced-lyrics/renderer/utils";
import {useRoute} from "vue-router";
import {useHeightStore} from "stores/height";

const route = useRoute();


const props = defineProps<{
  line: LineLyrics;
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

watch(
  () => props.current,
  (current) => {
    wordRefs.value.forEach((el, index) => {
      popWord(el, index, current, small.value)
    });

    romanjiRefs.value.forEach((el, index) => {
      popWord(el, index, current)
    });
  }
);

function popWord(el: HTMLElement | null, index: number, current: number, small: string = '') {

  if (!el) return;
  if (small === 'small') {
    el.style.fontSize = `${heightStore.smallFont}rem`;
    return;
  }
  if (status.value !== 'current') {
    el.style.fontSize = `${baseFont}rem`;
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
  el.style.fontSize = `${fontSize}rem`;
}

const bigbangWords = [
  'BIG',
  'BANG',
  'BIGBANG',
  '(BANG',
  'BANG)',
]

const bigbangLetters = [
  'B',
  'B.',
  'I',
  'I.',
  'G',
  'G.',
]
const bigbangLines = [
  'B TO THE I TO THE G (BANG BANG)'
]

const pokeWords = [
  'pokémon',
  '(pokémon)',
  'pokémon,',
]

onMounted(() => {
  const bigbang = true
  const pokemon = true
  if (bigbang) {
    wordRefs.value.forEach((el) => {
      if (!el) return;
      const wordUp = (el.textContent ?? '').trim().toUpperCase();

      if (bigbangWords.includes(wordUp)) {
        el.style.fontFamily = 'Earth,sans-serif';
        el.textContent = (el.textContent ?? '').toUpperCase();
        return;
      }
      if (bigbangLines.includes(props.line.text.trim().toUpperCase())) {
        if (bigbangLetters.includes(wordUp)) {
          el.style.fontFamily = 'Earth,sans-serif';
          el.textContent = (el.textContent ?? '').toUpperCase();
          return;
        }
      }
    });
  }
  if (pokemon) {
    wordRefs.value.forEach((el) => {
      if (!el) return;
      const wordUp = (el.textContent ?? '').trim().toLowerCase();

      if (pokeWords.includes(wordUp)) {
        el.classList.add('texto-pokemon')
        el.textContent = (el.textContent ?? '');
        return;
      }
    });
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


const showRomanji = ref(false);
const small = ref('')
onMounted(async () => {
  //TODO: configurable romanization
  // if (!config()?.romanization) return;

  const input = canonicalize(text.value);

  await romanize(input).then((result) => {
    romanization.value=canonicalize(result);
  });


  showRomanji.value = simplifyUnicode(text.value) !== simplifyUnicode(romanization.value)
  if (smallKanji && showRomanji.value) {
    small.value = 'small'
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
          class="text-lyrics texto-con-borde-grueso"
          ref="durationDiv"
        >
        <span :class="'row justify-center'">
          <span v-for="(word, index) in text.split(' ')" :key="index"
                :ref="el=>setWordRef(el,index)"
          >
<!--                      <yt-formatted-string>-->
                {{ word }}&ensp;
            <!--                      </yt-formatted-string>-->
          </span>
        </span>

          <!--        TODO: config()?.romanization-->
          <span class="romaji row justify-center texto-con-borde-grueso"
                v-if="showRomanji">
            <span v-for="(word, index) in romanization.split(' ')" :key="index"
                  :ref="el=>setRomanjiRef(el,index)">
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
  font-size: 2rem;
  //-webkit-text-stroke: .3rem black;
}

@mixin text-outline($width: 2px, $color: black) {
  $shadows: ();

  @for $i from -$width through $width {
    @for $j from -$width through $width {
      $shadows: append($shadows, #{$i}px #{$j}px 0 $color, comma);
    }
  }

  text-shadow: $shadows;
}

.texto-con-borde-grueso {
  color: white;
  @include text-outline(3, black); /* 3px de grosor */
}

.texto-pokemon {
  color: #ffcb02;
  font-family: pokemonFont, serif;
  @include text-outline(5, #0065b0); /* 3px de grosor */
  letter-spacing: 10px;
}

</style>
