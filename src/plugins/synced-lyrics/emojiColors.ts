export type EmojiProgressColor = {
  /** Fill / arc color for the circular progress */
  color: string;
  /** Optional track (background ring) when the fill needs contrast */
  trackColor?: string;
};

/** Default arc color when no emoji has been seen yet */
export const DEFAULT_PROGRESS_COLOR = '#fd04fd';

/** Default track when no override is set (Quasar grey-3-ish) */
export const DEFAULT_PROGRESS_TRACK_COLOR = '#e0e0e0';

/** Progress color for lines that are only a parenthetical annotation */
export const ANNOTATION_PROGRESS_COLOR = '#000000';
export const ANNOTATION_PROGRESS_TRACK_COLOR = '#9e9e9e';

/**
 * Emoji → progress colors.
 * Keys are stored without U+FE0F so ☀️ and ☀ match the same entry.
 */
export const EMOJI_PROGRESS_COLORS: Record<string, EmojiProgressColor> = {
  // Section / member markers (BiiiG color circles)
  '🔴': {color: '#e53935'},
  '🔵': {color: '#1e88e5'},
  '🟡': {color: '#fdd835', trackColor: '#9e9e9e'},

  // BIGBANG-style member markers
  '🐰': {color: '#ccc4d5', trackColor: '#ff9286'},
  '🐲': {color: '#f50a8c'},
  '☀': {color: '#fdce38'},
  '🐯': {color: '#fd8827'},
  '🐼': {color: '#423f6c', trackColor: '#f2f2f2'},

  // Other lyrics markers used in local LRC files
  '🌸': {color: '#ec407a'},
  '🥷': {color: '#455a64'},
  '🤖': {color: '#78909c'},
  '🗣': {color: '#8d6e63'},
  '🎩': {color: '#543b66'},
  '👠': {color: '#d81b60'},
  '🗿': {color: '#795548'},
  '👨': {color: '#42a5f5'},
  '🎤': {color: '#ab47bc'},
  // '🎙': {color: '#b5aebc'},
  '🎙': {color: '#601824'}, //saco rojo marco antonio
  '🪶': {color: '#a1887f'},
  '🕺': {color: '#26a69a'},
  '💃': {color: '#ef5350'},
  '👨‍🎤': {color: '#009af2'},
  '🧑🏻‍🎤': {color: '#fd711e'},
};

function stripVariationSelectors(text: string): string {
  return text.replace(/\uFE0F/g, '');
}

/** Keys without U+FE0F; later map entries win when two keys normalize the same. */
const NORMALIZED_EMOJI_COLORS: Record<string, EmojiProgressColor> = {};
for (const [key, value] of Object.entries(EMOJI_PROGRESS_COLORS)) {
  NORMALIZED_EMOJI_COLORS[stripVariationSelectors(key)] = value;
}

const NORMALIZED_EMOJI_KEYS = Object.keys(NORMALIZED_EMOJI_COLORS).sort(
  (a, b) => b.length - a.length,
);

/** Drop parenthetical annotations so emojis inside them do not change color. */
function textOutsideParentheses(text: string): string {
  return text.replace(/\([^()]*\)/g, '');
}

/**
 * True when the whole line is annotation(s) in parentheses, e.g. "(Big big big big)".
 * Does not match empty silence lines or lines with lyrics outside (...).
 */
export function isAnnotationOnlyLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return textOutsideParentheses(trimmed).trim() === '';
}

/**
 * Last known-color emoji in the line (outside parentheses), or null.
 * Mid-line emojis count; emojis only inside (...) do not.
 */
export function findLastProgressEmoji(text: string): string | null {
  const haystack = stripVariationSelectors(textOutsideParentheses(text));
  if (!haystack) return null;

  const taken: {start: number; end: number}[] = [];
  let bestIndex = -1;
  let bestKey: string | null = null;

  for (const needle of NORMALIZED_EMOJI_KEYS) {
    let from = 0;
    let idx: number;
    while ((idx = haystack.indexOf(needle, from)) !== -1) {
      const end = idx + needle.length;
      const overlaps = taken.some((range) => idx < range.end && end > range.start);
      if (!overlaps) {
        taken.push({start: idx, end});
        if (
          idx > bestIndex ||
          (idx === bestIndex &&
            bestKey !== null &&
            needle.length > bestKey.length)
        ) {
          bestIndex = idx;
          bestKey = needle;
        }
      }
      from = idx + Math.max(1, needle.length);
    }
  }

  return bestKey;
}

export type ProgressColorState = {
  progressColor: string;
  progressTrackColor: string;
};

function colorFromEmoji(emoji: string | null): ProgressColorState | null {
  if (!emoji) return null;
  const entry = NORMALIZED_EMOJI_COLORS[stripVariationSelectors(emoji)];
  if (!entry) return null;
  return {
    progressColor: entry.color,
    progressTrackColor: entry.trackColor ?? DEFAULT_PROGRESS_TRACK_COLOR,
  };
}

/** Next non-empty line's progress emoji, if any. */
function findUpcomingProgressEmoji<T extends {text: string}>(
  lines: T[],
  fromIndex: number,
): string | null {
  for (let i = fromIndex; i < lines.length; i++) {
    const text = lines[i]?.text ?? '';
    if (!text.trim()) continue;
    return findLastProgressEmoji(text);
  }
  return null;
}

/**
 * Walk lyrics in order and carry the last emoji color forward
 * until another (non-parenthetical) emoji appears.
 *
 * Empty lines (♪ / line zero) preview the next non-empty line's emoji
 * color when present; otherwise they keep the carried color.
 *
 * Annotation-only lines like "(Big big big big)" use black and do not
 * change the carried section color.
 */
export function applyEmojiProgressColors<T extends {text: string}>(
  lines: T[],
): (T & ProgressColorState)[] {
  let progressColor = DEFAULT_PROGRESS_COLOR;
  let progressTrackColor = DEFAULT_PROGRESS_TRACK_COLOR;

  return lines.map((line, index) => {
    if (!line.text.trim()) {
      const upcoming = colorFromEmoji(
        findUpcomingProgressEmoji(lines, index + 1),
      );
      return {
        ...line,
        progressColor: upcoming?.progressColor ?? progressColor,
        progressTrackColor: upcoming?.progressTrackColor ?? progressTrackColor,
      };
    }

    if (isAnnotationOnlyLine(line.text)) {
      return {
        ...line,
        progressColor: ANNOTATION_PROGRESS_COLOR,
        progressTrackColor: ANNOTATION_PROGRESS_TRACK_COLOR,
      };
    }

    const fromEmoji = colorFromEmoji(findLastProgressEmoji(line.text));
    if (fromEmoji) {
      progressColor = fromEmoji.progressColor;
      progressTrackColor = fromEmoji.progressTrackColor;
    }

    return {
      ...line,
      progressColor,
      progressTrackColor,
    };
  });
}
