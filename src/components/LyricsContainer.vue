<script setup lang="ts">
import {computed, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, watch} from "vue";
import {hasJapaneseInString, hasKoreanInString} from "src/plugins/synced-lyrics/renderer/utils";


import LoadingKaomoji from "components/LoadingKaomoji.vue";
// import {currentLyrics} from "src/plugins/synced-lyrics/providers";
import SyncedLine from "components/SyncedLine.vue";
import {LRCLib} from "src/plugins/synced-lyrics/providers/LRCLib";
import type {LineLyrics, LyricResult} from "src/plugins/synced-lyrics/types";
import {useRoute} from "vue-router";
import {LRC} from "src/plugins/synced-lyrics/parsers/lrc";
import {useHeightStore} from "stores/height";

const hasJapanese = ref(false);
const hasKorean = ref(false);
const currentTime = ref(0);
// const FETCH_URL = 'http://localhost:1608/';
const YT_API = 'http://localhost:26538/api/v1/song';


const title = ref('');
const alternativeTitle = ref('');
const artistsYT = ref<string[]>([]);
const album = ref('');
const durationMs = ref(0);
const duration = ref(0);
const status = ref('');
const isPaused = ref(false);
const tags = ref<string[]>([]);
const fetching = ref('');

const lines = ref<LineLyrics[] | undefined>(undefined);
const lyrics = ref<string | undefined>('');
const searchResult = ref<LyricResult | null>(null);

const LRCLibClass = new LRCLib();

const route = useRoute();


watch(searchResult, (newRes) => {
  const data = newRes
  if (data) {
    hasKorean.value = hasKoreanInString(data)
    hasJapanese.value = hasJapaneseInString(data)
  } else {
    hasKorean.value = false
    hasJapanese.value = false
  }
})

async function fetch_data() {

  const lrclibID = Array.isArray(route.query.lrclibid)
    ? route.query.lrclibid[0] ?? ''
    : route.query.lrclibid ?? ''

  console.log(lrclibID)

  const jsonName = Array.isArray(route.query.json)
    ? route.query.json[0] ?? ''
    : route.query.json ?? ''
  console.log(jsonName)

  const lrcName = Array.isArray(route.query.lrc)
    ? route.query.lrc[0] ?? ''
    : route.query.lrc ?? ''

  if (lrclibID || jsonName || lrcName) {
    let idData;
    if (lrclibID) {
      idData = await (await fetch(`https://lrclib.net/api/get/${lrclibID}`)).json()
    }
    if (jsonName) {
      idData = await (await fetch(`/lrc/${jsonName}.json`)).json();
    }
    if (lrcName) {
      const response = await fetch(`/lrc/${lrcName}.lrc`);
      const text = await response.text();
      const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())

      idData = {
        syncedLyrics:lines.join("\n"),
        plainLyrics: "",
        trackName: "",
        artistName: "",
      }
    }

    //from LRCLib.ts
    const raw = idData.syncedLyrics;
    const plain = idData.plainLyrics;

    searchResult.value = {
      title: idData.trackName,
      artists: idData.artistName.split(/[&,]/g),
      lines: raw
        ? LRC.parse(raw).lines.map((l) => ({
          ...l,
          status: 'upcoming' as const,
        }))
        : undefined,
      lyrics: plain,
      duration: idData.duration,
    }

  } else {


    await fetch(YT_API)
      .then(response => response.json())
      .then(async data => {
        // data now contains the json object with song metadata

        const debugTime = Array.isArray(route.query.debugTime)
          ? route.query.debugTime[0] ?? ''
          : route.query.debugTime ?? ''
        if (debugTime) {
          currentTime.value = parseInt(debugTime) * 1000
        }

        if (data['title'] != title.value) {
          title.value = data['title'];
          alternativeTitle.value = data['alternativeTitle'];
          //Why in array? ytm uses string, but tuna plugin does [songInfo.artist], how works other players?
          // src/plugins/tuna-obs/index.ts:89
          artistsYT.value = data['artists'];
          album.value = data['album'];
          // why in mili? ""  ""      ""                  ""

          durationMs.value = data['songDuration'] * 1000;
          duration.value = data['songDuration'];
          status.value = data['status'];
          isPaused.value = data['isPaused'];
          tags.value = data['tags'];

          fetching.value = 'fetching';

          //en vez de buscar, el ID de la cancion
          // https://lrclib.net/api/get/3396226


          searchResult.value = await LRCLibClass.search({
            title: data['title'],
            alternativeTitle: data['alternativeTitle'],
            artist: data['artist'],
            album: data['album'],
            songDuration: data['songDuration'],
            tags: data['tags'],
            videoId: ''
          });

          fetching.value = 'done'


        }
        return 'return'
      })
      .catch(function (error) {
        console.error(error);
        // Do nothing
      });
  }


  if (searchResult.value) {
    lines.value = searchResult.value.lines
    lyrics.value = searchResult.value.lyrics!
  } else {
    lines.value = []
    lyrics.value = undefined
  }

}

// const requestInteral = setInterval(fetch_data, REFRESH_INTERVAL_MS);
/*const localInterval = setInterval(() => {
  currentTime.value = currentTime.value + 50;
}, 50);*/

onBeforeUnmount(() => {
  // clearInterval(requestInteral);
  // clearInterval(localInterval);
})


declare global {
  interface Window {
    getInfo: () => Promise<{ fps: number; numberOfFrames: number }>
    seekToFrame: (frame: number) => void
  }
}

onMounted(() => {
  window.getInfo = getInfo
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  window.seekToFrame = seekToFrame
})

const fps = ref(24)

onBeforeMount(() => {
  const fpsQ = Array.isArray(route.query.fps)
    ? route.query.fps[0] ?? 24
    : route.query.fps ?? 24
  fps.value = parseInt(fpsQ.toString())
})

async function getInfo() {
  await fetch_data()


  return {
    fps: fps.value,
    numberOfFrames: (searchResult.value?.duration || 10) * fps.value,
  }
}

const rFrame = ref(0)

const emits = defineEmits(['update-time'])

async function seekToFrame(frame: number) {
  rFrame.value = frame
  await fetch_data()
  currentTime.value = (frame / fps.value) * 1000
  emits('update-time', currentTime.value)
  await nextTick(updateLineHeights)


}

const currentIndex = computed(() => {
  const checkLines = lines.value ?? [];

  return checkLines.findIndex(l => {
    return currentTime.value >= l.timeInMs &&
      currentTime.value < l.timeInMs + l.duration
  })
})

const lineHeights = ref<number[]>([])
const lineRefs = ref<(InstanceType<typeof SyncedLine> | null)[]>([])

const setLinesRef = (el: unknown, index: number) => {
  lineRefs.value[index] = el as InstanceType<typeof SyncedLine>
}

function updateLineHeights() {
  lineHeights.value = lineRefs.value.map(lRef => lRef?.$el.offsetHeight || 0)
}

onMounted(async () => {
  // await nextTick(updateLineHeights)
  // window.addEventListener('resize', updateLineHeights)
})


const offsetY = computed(() => {
  const idx = currentIndex.value
  const prevHeights = lineHeights.value.slice(0, idx)
  const sumPrev = prevHeights.reduce((a, b) => a + b, 0)
  const currentHeight = lineHeights.value[idx] || 0
  return centerOffset - (sumPrev + currentHeight / 2)
})

const offsetYAnimated = computed(() => {
  const idx = currentIndex.value
  if (idx < 0) return offsetY.value

  // Tiempo de inicio y fin de la animación
  if (!lines.value) return offsetY.value
  const nextLine = lines.value[idx + 1]
  if (!nextLine) return offsetY.value

  const animStart = nextLine.timeInMs - 200 // 0.2s antes
  const animEnd = nextLine.timeInMs + 200   // 0.2s después
  const tNow = currentTime.value

  // Si estamos fuera del rango, usar posición fija
  if (tNow <= animStart) return offsetY.value
  if (tNow >= animEnd) {
    // Ya pasamos a la siguiente línea, usar offset de la nueva
    const idxNext = idx + 1
    const prevHeights = lineHeights.value.slice(0, idxNext)
    const sumPrev = prevHeights.reduce((a, b) => a + b, 0)
    const currentHeight = lineHeights.value[idxNext] || 0
    return centerOffset - (sumPrev + currentHeight / 2)
  }

  // Normalizar el progreso entre 0 y 1
  const progress = (tNow - animStart) / (animEnd - animStart)

  // Easing cuadrático: suave → rápido → suave
  const ease = progress < 0.5
    ? 2 * progress * progress
    : -1 + (4 - 2 * progress) * progress

  // Calcular offset inicial y final
  const startOffset = offsetY.value
  const idxNext = idx + 1
  const prevHeightsNext = lineHeights.value.slice(0, idxNext)
  const sumPrevNext = prevHeightsNext.reduce((a, b) => a + b, 0)
  const nextOffset = centerOffset - (sumPrevNext + (lineHeights.value[idxNext] || 0) / 2)

  // Interpolar suavemente
  return startOffset + (nextOffset - startOffset) * ease
})

const heightStore = useHeightStore();

const centerOffset = heightStore.height / 2
</script>

<template>
  <div
    class="lyric-container row justify-center"
    :style="{
        transform: `translateY(${offsetYAnimated}px)`}">
    <LoadingKaomoji v-if="fetching==='fetching'"/>
    <div v-else-if="!lines && !lyrics"
         class="text-lyrics description ytmusic-description-shelf-renderer"
         :style="{display: 'inline-flex',
              'justify-content': 'center',
              width: '100%',
              'user-select': 'none'}">
      ＼(〇_ｏ)／
    </div>

    <div v-else-if="lines">
      <!--      <span style="font-size: 3rem; color: white; float: left">
            {{ rFrame }} - {{ currentTime }}
            </span>-->

      <SyncedLine
        v-for="(l, i) in lines" :key="i"
        :line="l"
        :hasJapanese="hasJapanese"
        :hasKorean="hasKorean"
        :current="currentTime"
        :durationMs="durationMs"
        :ref="(el)=>setLinesRef(el, i)"
      />
    </div>
  </div>
</template>

<style scoped>
</style>
