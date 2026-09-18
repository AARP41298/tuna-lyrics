<script setup lang="ts">
import {computed, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, watch} from "vue";


import LoadingKaomoji from "components/LoadingKaomoji.vue";
// import {currentLyrics} from "src/plugins/synced-lyrics/providers";
import SyncedLine from "components/SyncedLine.vue";
import {LRCLib} from "src/plugins/synced-lyrics/providers/LRCLib";
import type {LineLyrics, LyricResult} from "src/plugins/synced-lyrics/types";
import {useRoute} from "vue-router";
import {LRC} from "src/plugins/synced-lyrics/parsers/lrc";
import {Lyricsfile} from "src/plugins/synced-lyrics/parsers/lyricsfile";
import {applyEmojiProgressColors} from "src/plugins/synced-lyrics/emojiColors";
import {
  blockIndices,
  blockStartMs,
  buildLyricBlocks,
} from "src/plugins/synced-lyrics/layout/blocks";
import {useHeightStore} from "stores/height";
import { useRomanizedStore} from "stores/romanized";

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

const lines = ref<LineLyrics[] | undefined>([]);
const lyrics = ref<string | undefined>('');
const searchResult = ref<LyricResult | null>(null);

const LRCLibClass = new LRCLib();

const route = useRoute();
let alreadyFetched = false;



async function fetch_data() {
  if (alreadyFetched){
    return;
  }

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

  const yamlName = Array.isArray(route.query.yaml)
    ? route.query.yaml[0] ?? ''
    : route.query.yaml ?? ''

  if (yamlName) {
    const fileName = /\.ya?ml$/i.test(yamlName) ? yamlName : `${yamlName}.yaml`;
    const response = await fetch(`/yaml/${fileName}`);
    if (!response.ok) {
      throw new Error(`Failed to load Lyricsfile /yaml/${fileName} (${response.status})`);
    }

    const parsed = Lyricsfile.parse(await response.text());
    const result = Lyricsfile.toLyricResult(parsed);
    if (result.lines) {
      result.lines = applyEmojiProgressColors(result.lines);
    }

    durationMs.value = parsed.metadata.duration_ms ?? Math.round((result.duration ?? 0) * 1000);
    searchResult.value = result;
  } else if (lrclibID || jsonName || lrcName) {
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
        ? applyEmojiProgressColors(
          LRC.parse(raw).lines.map((l) => ({
            ...l,
            status: 'upcoming' as const,
          })),
        )
        : undefined,
      lyrics: plain,
      duration: idData.duration,
    }

  } else {


    await fetch(YT_API)
      .then(response => response.json())
      .then(async data => {
        // data now contains the json object with song metadata

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

  const debugTime = Array.isArray(route.query.debugTime)
    ? route.query.debugTime[0] ?? ''
    : route.query.debugTime ?? ''
  if (debugTime) {
    currentTime.value = parseInt(debugTime.toString()) * 1000
  }

  if (searchResult.value) {
    lines.value = searchResult.value.lines
    lyrics.value = searchResult.value.lyrics!
  } else {
    lines.value = []
    lyrics.value = undefined
  }
  romanizedStore.reset(lines.value?.length || 0)
  alreadyFetched = true

}

const romanizedStore = useRomanizedStore()

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

/*function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}*/

 onMounted( () => {
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
   romanizedStore.extraPlus()
  await fetch_data()
  romanizedStore.extraReady()
  await seekToFrame(0)
  // await sleep(2000)
  await waitUntilAllReady()

  return {
    fps: fps.value,
    numberOfFrames: Math.ceil((searchResult.value?.duration || 10)) * fps.value,
  }
}

const rFrame = ref(0)

const emits = defineEmits(['update-time'])

onMounted(async ()=>{
  const seek = Array.isArray(route.query.seek)
    ? route.query.seek[0] ?? null
    : route.query.seek ?? null
  if (seek) {
    await seekToFrame(Number.parseInt(seek))
  }
})

async function seekToFrame(frame: number) {

  rFrame.value = frame
  await fetch_data()
  currentTime.value = (frame / fps.value) * 1000
  emits('update-time', currentTime.value)
  await nextTick(updateLineHeights)
  await waitUntilAllReady()
  await nextTick(updateLineHeights)
  // await sleep(2000)
  await nextTick()
}

function waitUntilAllReady(): Promise<void> {
  const romanizedStore = useRomanizedStore()
  return new Promise((resolve) => {
    const isReady = () =>
      romanizedStore.completedRom && romanizedStore.completedExtra

    if (isReady()) return resolve()

    const stop = watch(
      () => [romanizedStore.completedRom, romanizedStore.completedExtra],
      () => {
        if (isReady()) {
          stop()
          resolve()
        }
      },
    )
  })
}

const heightStore = useHeightStore();
const centerOffset = heightStore.height / 2

/** Consecutive lines whose times overlap render as a left/right split. */
const lyricBlocks = computed(() => buildLyricBlocks(lines.value ?? []))

const currentBlockIndex = computed(() => {
  const checkLines = lines.value ?? [];
  const blocks = lyricBlocks.value;
  const tNow = currentTime.value;

  const active = blocks.findIndex((block) =>
    blockIndices(block).some((index) => {
      const line = checkLines[index];
      return !!line && tNow >= line.timeInMs && tNow < line.timeInMs + line.duration;
    }),
  );
  if (active !== -1) return active;

  let lastStarted = -1;
  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];
    if (!block) continue;
    if (blockStartMs(block, checkLines) > tNow) break;
    lastStarted = b;
  }
  return lastStarted;
})

const blockHeights = ref<number[]>([])
const blockEls = ref<(HTMLElement | null)[]>([])

const setBlockRef = (el: unknown, index: number) => {
  blockEls.value[index] = el instanceof HTMLElement ? el : null
}

function updateLineHeights() {
  blockHeights.value = lyricBlocks.value.map((_, index) => blockEls.value[index]?.offsetHeight || 0)
}

watch(lyricBlocks, async () => {
  await nextTick()
  updateLineHeights()
})

function offsetForBlock(idx: number): number {
  const prevHeights = blockHeights.value.slice(0, idx)
  const sumPrev = prevHeights.reduce((a, b) => a + b, 0)
  const currentHeight = blockHeights.value[idx] || 0
  return centerOffset - (sumPrev + currentHeight / 2)
}

const offsetY = computed(() => offsetForBlock(currentBlockIndex.value))

const offsetYAnimated = computed(() => {
  const idx = currentBlockIndex.value
  const checkLines = lines.value
  if (idx < 0 || !checkLines) return offsetY.value

  const nextBlock = lyricBlocks.value[idx + 1]
  if (!nextBlock) return offsetY.value

  const nextStart = blockStartMs(nextBlock, checkLines)
  const animStart = nextStart - 200
  const animEnd = nextStart + 200
  const tNow = currentTime.value

  if (tNow <= animStart) return offsetY.value
  if (tNow >= animEnd) return offsetForBlock(idx + 1)

  const progress = (tNow - animStart) / (animEnd - animStart)
  const ease = progress < 0.5
    ? 2 * progress * progress
    : -1 + (4 - 2 * progress) * progress

  return offsetY.value + (offsetForBlock(idx + 1) - offsetY.value) * ease
})
</script>

<template>
  <div
    class="lyric-container"
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

    <div v-else-if="lines" class="lyric-blocks">
      <div
        v-for="(block, b) in lyricBlocks"
        :key="'block-'+b"
        class="lyric-block"
        :class="{ 'lyric-split': block.kind === 'split' }"
        :ref="(el) => setBlockRef(el, b)"
      >
        <template v-if="block.kind === 'split'">
          <div class="lyric-split-pane lyric-split-left">
            <SyncedLine
              v-for="i in block.left"
              :key="'L'+i"
              :line="lines[i]!"
              :index="i"
              :is-last="i === lines.length - 1"
              :current="currentTime"
              :durationMs="durationMs"
              :next-duration="lines[i + 1]?.duration ?? Number.POSITIVE_INFINITY"
              :artists="searchResult?.artists ?? []"
              split-side="left"
            />
          </div>
          <div class="lyric-split-pane lyric-split-right">
            <SyncedLine
              v-for="i in block.right"
              :key="'R'+i"
              :line="lines[i]!"
              :index="i"
              :is-last="i === lines.length - 1"
              :current="currentTime"
              :durationMs="durationMs"
              :next-duration="lines[i + 1]?.duration ?? Number.POSITIVE_INFINITY"
              :artists="searchResult?.artists ?? []"
              split-side="right"
            />
          </div>
        </template>
        <SyncedLine
          v-else
          :line="lines[block.indices[0]]!"
          :index="block.indices[0]"
          :is-last="block.indices[0] === lines.length - 1"
          :current="currentTime"
          :durationMs="durationMs"
          :next-duration="lines[block.indices[0] + 1]?.duration ?? Number.POSITIVE_INFINITY"
          :artists="searchResult?.artists ?? []"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.lyric-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.lyric-blocks {
  width: 100%;
}

.lyric-block {
  width: 100%;
}

.lyric-split {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
}

.lyric-split-pane {
  flex: 1 1 50%;
  min-width: 0;
  max-width: 50%;
}

.lyric-split-left {
  padding-right: 1.2vw;
}

.lyric-split-right {
  padding-left: 1.2vw;
}
</style>
