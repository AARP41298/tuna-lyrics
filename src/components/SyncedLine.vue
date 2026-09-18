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
  /** Duration of the following line; used to speed up past-line fade during rap. */
  nextDuration: number;
  /** Overlapping vocal column; wrap and layout use half the scene. */
  splitSide?: 'left' | 'right';
}>()

const isSplitLine = computed(() => props.splitSide === 'left' || props.splitSide === 'right');

const durationDiv = ref<HTMLDivElement | null>(null);
const refLine = ref<HTMLDivElement | null>(null);
const kanjiRow = ref<HTMLDivElement | null>(null);
const romanjiRow = ref<HTMLDivElement | null>(null);

/** Word indices that start a new visual line (pre-wrapped at max font). */
const kanjiBreakBefore = ref<number[]>([]);
const romanjiBreakBefore = ref<number[]>([]);

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

const CLOSING_HOLD_MS = 4000;
const CLOSING_FADE_MS = 1000;
const PAST_FADE_MS = 2000;

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
    if (elapsed <= CLOSING_HOLD_MS) return 1;
    if (elapsed >= CLOSING_HOLD_MS + CLOSING_FADE_MS) return 0;
    return 1 - (elapsed - CLOSING_HOLD_MS) / CLOSING_FADE_MS;
  }

  if (status.value === 'current') return 1;

  if (status.value === 'previous') {
    const lineEnd = props.line.timeInMs + props.line.duration;
    const elapsed = props.current - lineEnd;
    const nextGap = props.nextDuration;
    const fadeMs = Math.min(
      PAST_FADE_MS,
      Number.isFinite(nextGap) && nextGap > 0 ? nextGap : PAST_FADE_MS,
    );
    if (elapsed >= fadeMs) return 0;
    if (elapsed <= 0) return 1;
    return 1 - elapsed / fadeMs;
  }

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
const maxFontCss = computed(() => `${heightStore.maxFont}vh`);


const wordDelay = 100; // fallback ms between words when no timed words exist
const growTime = 100; // ms que tarda en llegar al max

function wordStartMs(index: number): number {
  const timed = props.line.words;
  if (timed && timed.length > 0) {
    return timed[Math.min(index, timed.length - 1)]?.timeInMs ?? props.line.timeInMs;
  }
  return props.line.timeInMs + index * wordDelay;
}

function wordEndMs(index: number, wordCount: number): number {
  if (index < wordCount - 1) {
    return wordStartMs(index + 1);
  }

  const timed = props.line.words?.[index];
  if (timed?.duration !== undefined) {
    return timed.timeInMs + timed.duration;
  }

  const lineEnd = props.line.timeInMs + props.line.duration;
  if (Number.isFinite(lineEnd)) {
    return Math.max(wordStartMs(index) + 80, lineEnd);
  }
  return wordStartMs(index) + 400;
}

type BouncePt = {x: number; y: number};
type BounceSeg = {
  from: BouncePt;
  ctrl: BouncePt;
  to: BouncePt;
  startMs: number;
  endMs: number;
  samples: BouncePt[];
  cumLen: number[];
  length: number;
};

const bounceHost = ref<HTMLDivElement | null>(null);
const bounceTracks = ref<
  {
    pathD: string;
    ball: BouncePt | null;
    totalLen: number;
    traveled: number;
    remaining: number;
    trail: {d: string; opacity: number}[];
  }[]
>([]);
const bounceView = ref({w: 1, h: 1, pad: 0});

const bounceBallR = computed(() => Math.max(5, (heightStore.height / 1080) * 8));
const bounceMinH = computed(() => (heightStore.height / 1080) * 40);
const bounceMaxH = computed(() => (heightStore.height / 1080) * 168);
const hasWordSync = computed(() => (props.line.words?.length ?? 0) > 0);
const bounceClearanceCss = computed(() => {
  if (!hasWordSync.value) return '0px';
  return `${(bounceMaxH.value + bounceBallR.value + 18) * 0.5}px`;
});

function quadPoint(p0: BouncePt, p1: BouncePt, p2: BouncePt, t: number): BouncePt {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function bounceControl(from: BouncePt, to: BouncePt, height: number): BouncePt {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const chord = Math.hypot(dx, dy);
  const mid = {x: (from.x + to.x) / 2, y: (from.y + to.y) / 2};
  if (height <= 0 || chord < 0.001) {
    return {x: mid.x, y: mid.y - Math.max(0, height)};
  }
  let nx = -dy / chord;
  let ny = dx / chord;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return {x: mid.x + nx * height, y: mid.y + ny * height};
}

function sampleQuad(from: BouncePt, ctrl: BouncePt, to: BouncePt, steps = 32) {
  const samples: BouncePt[] = [from];
  const cumLen = [0];
  let length = 0;
  let prev = from;
  for (let i = 1; i <= steps; i++) {
    const point = quadPoint(from, ctrl, to, i / steps);
    length += Math.hypot(point.x - prev.x, point.y - prev.y);
    samples.push(point);
    cumLen.push(length);
    prev = point;
  }
  return {samples, cumLen, length};
}

function bounceHeightForDuration(durationMs: number): number {
  const minH = bounceMinH.value;
  const maxH = bounceMaxH.value;
  const t = Math.min(1, Math.max(0, (durationMs - 160) / 740));
  return minH + t * (maxH - minH);
}

function pointAtLength(samples: BouncePt[], cumLen: number[], dist: number): BouncePt {
  const last = samples[samples.length - 1];
  if (!last || samples.length < 2) return last ?? {x: 0, y: 0};

  const total = cumLen[cumLen.length - 1] ?? 0;
  const d = Math.min(total, Math.max(0, dist));
  for (let i = 1; i < cumLen.length; i++) {
    const end = cumLen[i] ?? 0;
    if (d <= end) {
      const start = cumLen[i - 1] ?? 0;
      const span = end - start;
      const t = span <= 0 ? 1 : (d - start) / span;
      const a = samples[i - 1];
      const b = samples[i];
      if (!a || !b) return last;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      };
    }
  }
  return last;
}

function ballOnSegs(segs: BounceSeg[], current: number): BouncePt | null {
  const first = segs[0];
  const last = segs[segs.length - 1];
  if (!first || !last) return null;
  if (current <= first.startMs) return first.from;
  if (current >= last.endMs) return last.to;

  for (const seg of segs) {
    if (current < seg.endMs) {
      const span = seg.endMs - seg.startMs;
      const dist =
        span <= 0
          ? seg.length
          : (Math.max(0, current - seg.startMs) / span) * seg.length;
      return pointAtLength(seg.samples, seg.cumLen, dist);
    }
  }
  return last.to;
}

const BOUNCE_TRAIL_MS = 480;

function traveledOnSegs(segs: BounceSeg[], current: number): number {
  const first = segs[0];
  if (!first) return 0;
  if (current <= first.startMs) return 0;

  let acc = 0;
  for (const seg of segs) {
    if (current >= seg.endMs) {
      acc += seg.length;
      continue;
    }
    if (current <= seg.startMs) return acc;
    const span = seg.endMs - seg.startMs;
    const dist =
      span <= 0 ? seg.length : ((current - seg.startMs) / span) * seg.length;
    return acc + dist;
  }
  return acc;
}

function bounceTrail(
  segs: BounceSeg[],
  current: number,
): {d: string; opacity: number}[] {
  const trail: {d: string; opacity: number}[] = [];
  let prev: BouncePt | null = null;
  let prevAge = 0;

  for (const seg of segs) {
    const span = Math.max(0, seg.endMs - seg.startMs);
    for (let i = 0; i < seg.samples.length; i++) {
      const pt = seg.samples[i];
      if (!pt) continue;
      const len = seg.cumLen[i] ?? 0;
      const t = seg.length <= 0 ? 1 : len / seg.length;
      const age = current - (seg.startMs + t * span);
      if (
        prev &&
        prevAge > 0 &&
        age > 0 &&
        Math.hypot(pt.x - prev.x, pt.y - prev.y) > 0.4
      ) {
        const opacity = 1 - (prevAge + age) / 2 / BOUNCE_TRAIL_MS;
        if (opacity > 0.03) {
          trail.push({
            d: `M ${prev.x} ${prev.y} L ${pt.x} ${pt.y}`,
            opacity,
          });
        }
      }
      prev = pt;
      prevAge = age;
    }
  }
  return trail;
}

function segsFromHops(
  hops: {from: BouncePt; to: BouncePt; startMs: number; endMs: number}[],
): BounceSeg[] {
  return hops.map((hop) => {
    const height = bounceHeightForDuration(hop.endMs - hop.startMs);
    const ctrl = bounceControl(hop.from, hop.to, height);
    const sampled = sampleQuad(hop.from, ctrl, hop.to);
    return {
      from: hop.from,
      to: hop.to,
      ctrl,
      startMs: hop.startMs,
      endMs: hop.endMs,
      samples: sampled.samples,
      cumLen: sampled.cumLen,
      length: sampled.length,
    };
  });
}

function pathFromSegs(segs: BounceSeg[]): string {
  return segs
    .map((seg, i) => {
      const start = i === 0 ? `M ${seg.from.x} ${seg.from.y}` : '';
      return `${start} Q ${seg.ctrl.x} ${seg.ctrl.y} ${seg.to.x} ${seg.to.y}`;
    })
    .join(' ');
}

function updateBounce(current: number) {
  const host = bounceHost.value;
  if (
    !host ||
    !hasWordSync.value ||
    isClosingSilence.value ||
    isLeadingSilence.value ||
    !props.line.text.trim() ||
    opacity.value <= 0.02
  ) {
    bounceTracks.value = [];
    return;
  }

  const timedEls: {el: HTMLElement; index: number}[] = [];
  wordRefs.value.forEach((el, index) => {
    if (el) timedEls.push({el, index});
  });
  if (timedEls.length === 0) {
    bounceTracks.value = [];
    return;
  }

  const hostRect = host.getBoundingClientRect();
  const r = bounceBallR.value;
  const wrapBreaks = new Set(kanjiBreakBefore.value);

  const boxOf = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return {
      left: rect.left - hostRect.left,
      right: rect.right - hostRect.left,
      y: rect.top - hostRect.top,
    };
  };

  const rows: {el: HTMLElement; index: number; box: ReturnType<typeof boxOf>}[][] = [];
  for (const item of timedEls) {
    const box = boxOf(item.el);
    const lastRow = rows[rows.length - 1];
    const startNewRow =
      wrapBreaks.has(item.index) ||
      (lastRow?.[0] !== undefined && Math.abs(box.y - lastRow[0].box.y) > 10);
    if (startNewRow || !lastRow) {
      rows.push([{...item, box}]);
    } else {
      lastRow.push({...item, box});
    }
  }

  const lastIndex = timedEls[timedEls.length - 1]?.index ?? 0;
  const rowSegs: BounceSeg[][] = [];
  let minY = 0;

  for (const row of rows) {
    const hops: {from: BouncePt; to: BouncePt; startMs: number; endMs: number}[] = [];
    for (let i = 0; i < row.length; i++) {
      const word = row[i];
      if (!word) continue;
      const from = {x: word.box.left + r, y: word.box.y};
      const next = row[i + 1];
      const to = next
        ? {x: next.box.left + r, y: next.box.y}
        : {x: Math.max(from.x + 10, word.box.right - r), y: word.box.y};
      const startMs = wordStartMs(word.index);
      const endMs = Math.max(startMs + 40, wordEndMs(word.index, lastIndex + 1));
      hops.push({from, to, startMs, endMs});
    }
    const segs = segsFromHops(hops);
    for (const seg of segs) {
      minY = Math.min(minY, seg.from.y, seg.to.y, seg.ctrl.y);
    }
    if (segs.length) rowSegs.push(segs);
  }

  if (rowSegs.length === 0) {
    bounceTracks.value = [];
    return;
  }

  const pad = Math.max(24, bounceBallR.value + 8 - minY);
  const shift = (pt: BouncePt): BouncePt => ({x: pt.x, y: pt.y + pad});
  for (const segs of rowSegs) {
    for (const seg of segs) {
      seg.from = shift(seg.from);
      seg.to = shift(seg.to);
      seg.ctrl = shift(seg.ctrl);
      seg.samples = seg.samples.map(shift);
    }
  }

  bounceView.value = {
    w: Math.max(1, hostRect.width),
    h: Math.max(1, hostRect.height + pad),
    pad,
  };
  bounceTracks.value = rowSegs.map((segs) => {
    const totalLen = segs.reduce((sum, seg) => sum + seg.length, 0);
    const traveled = Math.min(totalLen, Math.max(0, traveledOnSegs(segs, current)));
    return {
      pathD: pathFromSegs(segs),
      ball: ballOnSegs(segs, current),
      totalLen: Math.max(0.001, totalLen),
      traveled,
      remaining: Math.max(0, totalLen - traveled),
      trail: bounceTrail(segs, current),
    };
  });
}

const bounceLaidOut = ref(false);

const showBounce = computed(
  () =>
    hasWordSync.value &&
    bounceLaidOut.value &&
    bounceTracks.value.length > 0,
);

const smallKanji = route.query.smallKanji ?? false
const romanizedStore = useRomanizedStore()

let romWorkDone = false
let mountedLayoutDone = false
let signaledReady = false

function signalLineReady() {
  if (signaledReady || !romWorkDone || !mountedLayoutDone) return
  signaledReady = true
  romanizedStore.lineReady()
}

async function finishBounceLayout() {
  applySpecialFonts(wordRefs.value)
  applySpecialFonts(romanjiRefs.value)
  await nextTick()
  lockWraps()
  await nextTick()
  bounceLaidOut.value = true
  updateBounce(props.current)
}

watch(
  () => props.current,
  async (current) => {
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
    if (bounceLaidOut.value) {
      await nextTick()
      updateBounce(current)
    }
    romanizedStore.extraReady()
  },
  {immediate: true}
);

function popWord(el: HTMLElement | null, index: number, current: number, small: string = '') {

  if (!el) return;
  if (small === 'small') {
    el.style.fontSize = `${heightStore.smallFont}vh`;
    el.style.fontWeight = '';
    return;
  }

  const startTime = wordStartMs(index);
  const endTime = startTime + growTime;
  const lineFinished = status.value === 'previous';
  const hasStarted = lineFinished || current >= startTime;

  if (!hasStarted) {
    el.style.fontSize = `${baseFont}vh`;
    el.style.fontWeight = '';
    return;
  }

  let fontSize = maxFont;
  if (!lineFinished && current <= endTime) {
    const t = (current - startTime) / growTime;
    fontSize = baseFont + (maxFont - baseFont) * t;
  }

  el.style.fontSize = `${fontSize}vh`;
  el.style.fontWeight = 'bold';
}

function getMeasureWidth(): number {
  if (isSplitLine.value) {
    const column = refLine.value?.clientWidth;
    if (column && column > 0) return column;

    const scene = document.getElementById('scene');
    if (scene && scene.clientWidth > 0) return Math.floor(scene.clientWidth / 2);
  }

  const scene = document.getElementById('scene');
  if (scene && scene.clientWidth > 0) return scene.clientWidth;

  const container = document.querySelector('.lyric-container');
  if (container instanceof HTMLElement && container.clientWidth > 0) {
    return container.clientWidth;
  }

  return 0;
}

/**
 * Simulate the line at max (bold) font inside a hidden clone and record
 * where flex-wrap would split, so those breaks exist before words pop in.
 * Width must be the full scene — the live row shrink-wraps to current text,
 * which would otherwise look like a wrap every 2–3 words.
 */
function findWrapBreaks(
  row: HTMLElement | null,
  measureFontVh: number,
): number[] {
  if (!row) return [];

  const availableWidth = getMeasureWidth();
  const mountAt = document.getElementById('scene') ?? durationDiv.value ?? refLine.value;
  if (!mountAt || availableWidth <= 0) return [];

  const wordCount = row.querySelectorAll(':scope > .lyric-word').length;
  if (wordCount < 2) return [];

  const clone = row.cloneNode(true) as HTMLElement;
  clone.classList.add('lyric-measure-clone');
  clone.classList.remove('items-center');
  clone.style.alignItems = 'flex-start';
  clone.style.fontFamily = 'Verdana, sans-serif';
  clone.style.boxSizing = 'border-box';
  clone.style.position = 'absolute';
  clone.style.visibility = 'hidden';
  clone.style.pointerEvents = 'none';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.width = `${availableWidth}px`;
  clone.style.minWidth = `${availableWidth}px`;
  clone.style.maxWidth = `${availableWidth}px`;
  clone.querySelectorAll('.lyric-line-break').forEach((el) => el.remove());

  clone.querySelectorAll<HTMLElement>(':scope > .lyric-word').forEach((el) => {
    el.style.fontSize = `${measureFontVh}vh`;
    el.style.fontWeight = 'bold';
    el.style.flexShrink = '0';
  });

  mountAt.appendChild(clone);

  try {
    const cloneWords = clone.querySelectorAll<HTMLElement>(':scope > .lyric-word');
    const breaks: number[] = [];
    let lastTop = cloneWords[0]?.offsetTop ?? 0;
    for (let i = 1; i < cloneWords.length; i++) {
      const wordEl = cloneWords[i];
      if (!wordEl) continue;
      const top = wordEl.offsetTop;
      if (top > lastTop + 1) {
        breaks.push(i);
        lastTop = top;
      }
    }
    return breaks;
  } finally {
    clone.remove();
  }
}

function lockWraps() {
  const kanjiFont = small.value === 'small' ? heightStore.smallFont : maxFont;
  kanjiBreakBefore.value = findWrapBreaks(kanjiRow.value, kanjiFont);
  romanjiBreakBefore.value = findWrapBreaks(romanjiRow.value, maxFont);
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

onMounted(async () => {
  await finishBounceLayout()
  mountedLayoutDone = true
  signalLineReady()
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

const displayWords = computed(() => {
  if (isClosingSilence.value || isLeadingSilence.value) {
    return onlyKanjis.value.split(' ');
  }
  if (props.line.words?.length) {
    return props.line.words.map((word) => word.word.trimEnd());
  }
  return onlyKanjis.value.split(' ');
});


let onlyFurigana = "";
const onlyKanjis = ref("");

const romanization = ref('')


const showRomanji = ref(false);
const small = ref('')
onBeforeMount(async () => {
  if (isLeadingSilence.value) {
    romWorkDone = true
    signalLineReady()
    return
  }

  if (isClosingSilence.value) {
    onlyKanjis.value = text.value
    onlyFurigana = text.value
    romanization.value = 'Thanks for watching'
    showRomanji.value = true
    await finishBounceLayout()
    romWorkDone = true
    signalLineReady()
    return
  }

  //TODO: configurable romanization
  // if (!config()?.romanization) return;
  onlyKanjis.value = text.value.replace(/\(([^|]+)\|([^)]+)\)/g, '$1');
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

  await finishBounceLayout()
  romWorkDone = true
  signalLineReady()
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
    :class="{
      'col-12': !isSplitLine,
      'lyric-split-line': isSplitLine,
      'leading-silence': isLeadingSilence,
    }"
    :style="{ opacity: isLeadingSilence ? 0 : opacity }"
    :aria-hidden="isLeadingSilence || (isClosingSilence && opacity <= 0)"
  >
    <template v-if="!isLeadingSilence">
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

          <div class="lyric-bounce-host" ref="bounceHost">
            <svg
              v-if="showBounce"
              class="lyric-bounce-svg"
              :viewBox="`0 0 ${bounceView.w} ${bounceView.h}`"
              :style="{ top: -bounceView.pad + 'px', height: bounceView.h + 'px' }"
              aria-hidden="true"
            >
              <g v-for="(track, trackIndex) in bounceTracks" :key="trackIndex">
                <path
                  v-if="track.remaining > 2"
                  class="lyric-bounce-path-outline lyric-bounce-path-ahead"
                  :d="track.pathD"
                  :pathLength="track.totalLen"
                  :stroke-dasharray="`${track.remaining} ${track.totalLen}`"
                  :stroke-dashoffset="-track.traveled"
                />
                <path
                  v-if="track.remaining > 2"
                  class="lyric-bounce-path lyric-bounce-path-ahead"
                  :d="track.pathD"
                  :stroke="progressColor"
                  :pathLength="track.totalLen"
                  :stroke-dasharray="`${track.remaining} ${track.totalLen}`"
                  :stroke-dashoffset="-track.traveled"
                />
                <g v-for="(piece, pieceIndex) in track.trail" :key="'t-'+pieceIndex">
                  <path
                    class="lyric-bounce-path-outline"
                    :d="piece.d"
                    :opacity="piece.opacity"
                  />
                  <path
                    class="lyric-bounce-path"
                    :d="piece.d"
                    :stroke="progressColor"
                    :opacity="piece.opacity"
                  />
                </g>
                <circle
                  v-if="track.ball"
                  class="lyric-bounce-ball-outline"
                  :cx="track.ball.x"
                  :cy="track.ball.y"
                  :r="bounceBallR + 2"
                />
                <circle
                  v-if="track.ball"
                  class="lyric-bounce-ball"
                  :cx="track.ball.x"
                  :cy="track.ball.y"
                  :r="bounceBallR"
                  :fill="progressColor"
                />
              </g>
            </svg>
          <div ref="kanjiRow" class="row justify-center items-center">
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
            <template v-for="(word, index) in displayWords" :key="'k-'+index">
              <div
                v-if="kanjiBreakBefore.includes(index)"
                class="lyric-line-break"
              />
              <span
                class="lyric-word"
                :ref="el=>setWordRef(el,index)"
              >
                    {{ word }}&ensp;
              </span>
            </template>
            <img
              v-if="isClosingSilence"
              class="mexico-flag"
              :style="{ height: baseFont + 'vh' }"
              src="/icons/flag-mexico.png"
              alt="🇲🇽"
            >
          </div>
          </div>

          <!--        TODO: config()?.romanization-->
          <div class="romaji row justify-center texto-con-borde-grueso"
               ref="romanjiRow"
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
            <template v-for="(word, index) in romanization.split(' ')" :key="'r-'+index">
              <div
                v-if="romanjiBreakBefore.includes(index)"
                class="lyric-line-break"
              />
              <span
                class="lyric-word"
                :ref="el=>setRomanjiRef(el,index)"
              >
  <!--                      <yt-formatted-string>-->
                  {{ word }}&ensp;
              <!--                      </yt-formatted-string>-->
              </span>
            </template>
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

.lyric-split-line {
  width: 100%;
}

.leading-silence {
  height: 0;
  overflow: hidden;
  pointer-events: none;
}

.text-lyrics {
  position: relative;
  line-height: 1.45;
}

.lyric-bounce-host {
  position: relative;
  width: 100%;
  padding-top: v-bind(bounceClearanceCss);
}

.lyric-bounce-svg {
  position: absolute;
  left: 0;
  width: 100%;
  overflow: visible;
  pointer-events: none;
  z-index: 4;
  text-shadow: none;
}

.lyric-bounce-path-outline {
  fill: none;
  stroke: #000;
  stroke-width: 6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.lyric-bounce-path {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.lyric-bounce-path-ahead {
  stroke-linecap: butt;
}

.lyric-bounce-ball-outline {
  fill: #000;
}

.lyric-bounce-ball {
  stroke: #000;
  stroke-width: 1.5;
}

.lyric-line-break {
  flex-basis: 100%;
  height: v-bind(bounceClearanceCss);
  overflow: hidden;
  margin: 0;
  padding: 0;
  border: none;
  pointer-events: none;
}

.lyric-measure-clone {
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden;
  pointer-events: none;
  z-index: -1;
}

.mexico-flag {
  display: inline-block;
  vertical-align: middle;
  margin-left: 0.15em;
}

.current,
.previous {
  font-weight: bold;
}

.previous .lyric-word {
  font-size: v-bind(maxFontCss);
  font-weight: bold;
}

.upcoming {
  font-weight: normal;
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
