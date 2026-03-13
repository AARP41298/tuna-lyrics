import {defineStore} from 'pinia';

export const useHeightStore = defineStore('height', {
  state: () => ({
    height: 1080,
    smallFont: 3,
    baseFont: 4,
    maxFont: 5,
  }),

  getters: {
  },

  actions: {
    setHeight(newHeight: number) {
      this.height = newHeight;

      const smallProp = 2 / 1080;
      const baseProp = 3 / 1080;
      const maxProp = 4 / 1080;

      this.smallFont = newHeight * smallProp;
      this.baseFont = newHeight * baseProp;
      this.maxFont = newHeight * maxProp;
    },
  },
});

