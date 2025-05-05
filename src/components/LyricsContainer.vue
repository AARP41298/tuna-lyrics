<script setup lang="ts">
import {onBeforeUnmount, ref, watch} from "vue";
import {hasJapaneseInString, hasKoreanInString} from "src/plugins/synced-lyrics/renderer/utils";


import LoadingKaomoji from "components/LoadingKaomoji.vue";
// import {currentLyrics} from "src/plugins/synced-lyrics/providers";
import SyncedLine from "components/SyncedLine.vue";
import {LRCLib} from "src/plugins/synced-lyrics/providers/LRCLib";
import type {LineLyrics, LyricResult} from "src/plugins/synced-lyrics/types";

const hasJapanese = ref(false);
const hasKorean = ref(false);
const currentTime = ref(0);
const FETCH_URL = 'http://localhost:1608/';


const title = ref('');
const alternativeTitle = ref('');
const artistsYT = ref<string[]>([]);
const album = ref('');
const durationMs = ref(0);
const duration = ref(0);
const status = ref('');
const tags = ref<string[]>([]);
const fetching = ref('');

const lines = ref<LineLyrics[] | undefined>(undefined);
const lyrics = ref<string | undefined>('');
const searchResult = ref<LyricResult | null>(null);

const LRCLibClass = new LRCLib();
const REFRESH_INTERVAL_MS = 1000;


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

function fetch_data() {
  const startTime = performance.now();
  fetch(FETCH_URL)
    .then(response => response.json())
    .then(async data => {
      const endTime = performance.now();
      const lag = endTime - startTime;
      const predictedTime = data['progress'] + lag;
      // data now contains the json object with song metadata
      const diffTime = currentTime.value - predictedTime
      if (Math.abs(diffTime) > 1000) {
        currentTime.value = predictedTime + 600;
      }

      if (data['title'] != title.value) {
        document.documentElement.scrollTo({top: 0, behavior: "smooth"});
        title.value = data['title'];
        alternativeTitle.value = data['alternativeTitle'];
        //Why in array? ytm uses string, but tuna plugin does [songInfo.artist], how works other players?
        // src/plugins/tuna-obs/index.ts:89
        artistsYT.value = data['artists'];
        album.value = data['album'];
        // why in mili? ""  ""      ""                  ""

        durationMs.value = data['duration'];
        duration.value = data['duration'] / 1000;
        status.value = data['status'];
        tags.value = data['tags'];

        fetching.value = 'fetching';

        searchResult.value = await LRCLibClass.search({
          title: data['title'],
          alternativeTitle: data['alternativeTitle'],
          artist: data['artists'][0],
          album: data['album'],
          songDuration: data['duration'] / 1000,
          tags: data['tags'],
          videoId: ''
        });

        fetching.value = 'done'
        if (searchResult.value) {
          lines.value = searchResult.value.lines
          lyrics.value = searchResult.value.lyrics!
        } else {
          lines.value = undefined
          lyrics.value = undefined
        }
      }
    })
    .catch(function (error) {
      console.error(error);
      // Do nothing
    });

}

const requestInteral = setInterval(fetch_data, REFRESH_INTERVAL_MS);
const localInterval = setInterval(() => {
  if (status.value !== "playing") {
    return;
  }
  currentTime.value = currentTime.value + 50;
}, 50);

onBeforeUnmount(() => {
  clearInterval(requestInteral);
  clearInterval(localInterval);
})

</script>

<template>
  <div
    class="lyric-container row justify-center"
    style="padding-top: 50vh; padding-bottom: 50vh"
  >
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
      <SyncedLine
        v-for="(l, i) in lines" :key="i"
        :line="l"
        :hasJapanese="hasJapanese"
        :hasKorean="hasKorean"
        :current="currentTime"
        :durationMs="durationMs"
      />
    </div>
  </div>
</template>

<style scoped>
</style>
