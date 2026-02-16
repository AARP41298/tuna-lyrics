<script setup lang="ts">
import {onBeforeUnmount, ref} from "vue";


import LoadingKaomoji from "components/LoadingKaomoji.vue";
// import {currentLyrics} from "src/plugins/synced-lyrics/providers";
import SyncedLine from "components/SyncedLine.vue";
import {LRCLib} from "src/plugins/synced-lyrics/providers/LRCLib";
import type {LineLyrics, LyricResult} from "src/plugins/synced-lyrics/types";

const currentTime = ref(0);
// const FETCH_URL = 'http://localhost:1608/';
const protocol = window.location.protocol === 'https:' ? 'https' : 'http'
const host = window.location.hostname
const FETCH_URL = `${protocol}://${host}:26538/api/v1/song`


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
const REFRESH_INTERVAL_MS = 1000;



function fetch_data() {
  const startTime = performance.now();
  fetch(FETCH_URL)
    .then(response => response.json())
    .then(async data => {
      const endTime = performance.now();
      const lag = endTime - startTime;
      const predictedTime = (data['elapsedSeconds'] * 1000) + lag;
      // data now contains the json object with song metadata
      const diffTime = currentTime.value - predictedTime
      if (Math.abs(diffTime) > 2000) {
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
  if (isPaused.value) {
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
        :current="currentTime"
        :durationMs="durationMs"
      />
    </div>
  </div>
</template>

<style scoped>
</style>
