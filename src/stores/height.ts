import {defineStore} from 'pinia';

const s = 3.8;
const b = 5.8;
const m = 6.8;

export const useHeightStore = defineStore('height', {
  state: () => ({
    height: 1080,
    smallFont: s,
    baseFont: b,
    maxFont: m,
  }),

  getters: {
  },

  actions: {
    setHeight(newHeight: number) {
      this.height = newHeight;

      const smallProp = s / 1080;
      const baseProp = b / 1080;
      const maxProp = m / 1080;

      this.smallFont = newHeight * smallProp;
      this.baseFont = newHeight * baseProp;
      this.maxFont = newHeight * maxProp;
    },
  },
});

