import { defineStore, acceptHMRUpdate } from 'pinia';

export const useRomanizedStore = defineStore('romanized', {
  state: () => ({
    total: 0,
    count: 0,
    extra: 0,
    extraCount: 0,
  }),
  getters: {
    completedRom: (state) => state.total > 0 && state.count >= state.total,
    completedExtra: (state) => state.extra > 0 && state.extraCount >= state.extra,

  },
  actions: {
    reset(total: number) {
      this.total = total
      this.count = 0
    },
    lineReady() {
      this.count++
    },

    extraPlus(){
      this.extra++
    },
    extraReady(){
      this.extraCount++

    }
  }
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useRomanizedStore, import.meta.hot));
}
