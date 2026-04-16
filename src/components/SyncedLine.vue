<script setup lang="ts">
import {computed, onBeforeMount, onMounted, ref, watch} from 'vue'

import type {LineLyrics} from "src/plugins/synced-lyrics/types";
import {
  canonicalize,
  romanize,
  simplifyUnicode
} from "src/plugins/synced-lyrics/renderer/utils";
import {useRoute} from "vue-router";
import {useHeightStore} from "stores/height";
import {useRomanizedStore} from "stores/romanized";

const route = useRoute();


const props = defineProps<{
  line: LineLyrics;
  current: number;
  durationMs: number;
  index: number;
}>()

const durationDiv = ref<HTMLDivElement | null>(null);

const status = computed(() => {

  if (props.line.timeInMs >= props.current) return 'upcoming';
  if (props.current - props.line.timeInMs >= props.line.duration) return 'previous';
  return 'current';
});

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


let onlyFurigana = "";
let onlyKanjis = "";

const romanization = ref('')


const showRomanji = ref(false);
const small = ref('')
onBeforeMount(async () => {
  //TODO: configurable romanization
  // if (!config()?.romanization) return;
  onlyKanjis = text.value.replace(/\(([^|]+)\|([^)]+)\)/g, '$1');
  onlyFurigana = text.value.replace(/\(([^|]+)\|([^)]+)\)/g, '$2');
  const input = canonicalize(onlyFurigana);


  const parts = input.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]+|[^\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]+/gu) || []
  const resultParts: string[] = await Promise.all(
    parts.map(async (part): Promise<string> => {
      // Si es japonés, romanízalo
      if (/^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]+$/u.test(part)) {
        return canonicalize(await romanize(part))
      }
      // Si no, déjalo igual (emojis, texto, símbolos…)
      return part
    })
  )


  romanization.value = resultParts.join('')
  /*await romanize(input).then((result) => {
    romanization.value=canonicalize(result);
  });*/


  showRomanji.value = simplifyUnicode(text.value) !== simplifyUnicode(romanization.value)
  if (smallKanji && showRomanji.value) {
    small.value = 'small'
  }

  romanizedStore.lineReady()
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

          <div class="row justify-center items-center">
            <!--              color="teal"-->
            <q-circular-progress
              show-value
              instant-feedback
              :font-size="(maxFont-1)+'vh'"
              :value="prog3"
              :size="(maxFont+1)+'vh'"
              :thickness="0.2"
              track-color="grey-3"
              class="q-ma-md texto-bordecito"
            >
              {{ cuenta3 }}
            </q-circular-progress>
            <span v-for="(word, index) in onlyKanjis.split(' ')" :key="index"
                  :ref="el=>setWordRef(el,index)">
                    {{ word }}&ensp;
            </span>
          </div>

          <!--        TODO: config()?.romanization-->
          <div class="romaji row justify-center texto-con-borde-grueso"
               v-if="showRomanji">
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
  </div>


</template>

<style scoped lang="scss">
@use "sass:math";
@use 'sass:list';

:deep(.q-circular-progress__circle) {
  //todo: extract main color of album thumbnail, or in json
  color: #cd355d;
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
