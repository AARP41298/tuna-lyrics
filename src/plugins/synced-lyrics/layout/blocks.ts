import {findLineVoiceEmojis} from '../emojiColors';
import type {LineLyrics} from '../types';

export type SplitSide = 'left' | 'right';

export type LyricBlock =
  | {
      kind: 'single';
      indices: [number];
    }
  | {
      kind: 'split';
      left: number[];
      right: number[];
    };

const UNISON = '__unison__';

function lineEndMs(line: LineLyrics): number {
  return line.timeInMs + line.duration;
}

function isTimedLine(line: LineLyrics | undefined): line is LineLyrics {
  return !!line && !!line.text.trim();
}

export function blockIndices(block: LyricBlock): number[] {
  return block.kind === 'single' ? [...block.indices] : [...block.left, ...block.right];
}

export function blockStartMs(block: LyricBlock, lines: LineLyrics[]): number {
  const starts = blockIndices(block)
    .map((index) => lines[index]?.timeInMs)
    .filter((time): time is number => time !== undefined);
  return starts.length ? Math.min(...starts) : 0;
}

function voiceOrder(lines: LineLyrics[]): string[] {
  const order: string[] = [];
  for (const line of lines) {
    for (const emoji of findLineVoiceEmojis(line.text)) {
      if (!order.includes(emoji)) order.push(emoji);
    }
  }
  return order;
}

function lineVoiceIds(lines: LineLyrics[]): (string | null)[] {
  let carried: string | null = null;
  return lines.map((line) => {
    if (!line.text.trim()) return carried;
    const emojis = findLineVoiceEmojis(line.text);
    if (emojis.length >= 2) {
      carried = emojis[emojis.length - 1] ?? carried;
      return UNISON;
    }
    if (emojis[0]) {
      carried = emojis[0];
      return carried;
    }
    return carried;
  });
}

function pushSingles(blocks: LyricBlock[], indices: number[]) {
  for (const index of indices) {
    blocks.push({kind: 'single', indices: [index]});
  }
}

function splitLeftVoice(
  group: number[],
  voices: (string | null)[],
  order: string[],
): string | null {
  const present = new Set<string>();
  for (const index of group) {
    const voice = voices[index];
    if (voice && voice !== UNISON) present.add(voice);
  }
  if (present.size < 2) return null;
  return order.find((emoji) => present.has(emoji)) ?? null;
}

function emitVoiceSplit(
  blocks: LyricBlock[],
  group: number[],
  voices: (string | null)[],
  leftVoice: string,
) {
  let pendingLeft: number[] = [];
  let pendingRight: number[] = [];

  const flush = () => {
    if (pendingLeft.length && pendingRight.length) {
      blocks.push({kind: 'split', left: pendingLeft, right: pendingRight});
    } else {
      pushSingles(blocks, [...pendingLeft, ...pendingRight]);
    }
    pendingLeft = [];
    pendingRight = [];
  };

  for (const index of group) {
    const voice = voices[index];
    if (voice === UNISON) {
      flush();
      blocks.push({kind: 'single', indices: [index]});
      continue;
    }
    if (voice === leftVoice) pendingLeft.push(index);
    else pendingRight.push(index);
  }
  flush();
}

export function buildLyricBlocks(lines: LineLyrics[]): LyricBlock[] {
  const blocks: LyricBlock[] = [];
  const used = new Array<boolean>(lines.length).fill(false);
  const voices = lineVoiceIds(lines);
  const order = voiceOrder(lines);

  for (let i = 0; i < lines.length; i++) {
    if (used[i]) continue;
    const line = lines[i];
    if (!isTimedLine(line)) {
      used[i] = true;
      blocks.push({kind: 'single', indices: [i]});
      continue;
    }

    const group = [i];
    used[i] = true;
    let groupEnd = lineEndMs(line);

    for (let j = i + 1; j < lines.length; j++) {
      if (used[j]) continue;
      const other = lines[j];
      if (!isTimedLine(other)) break;
      if (other.timeInMs >= groupEnd) break;
      group.push(j);
      used[j] = true;
      groupEnd = Math.max(groupEnd, lineEndMs(other));
    }

    if (group.length === 1) {
      const only = group[0];
      if (only === undefined) continue;
      blocks.push({kind: 'single', indices: [only]});
      continue;
    }

    const leftVoice = splitLeftVoice(group, voices, order);
    if (leftVoice) {
      emitVoiceSplit(blocks, group, voices, leftVoice);
      continue;
    }

    const marked = group.some((index) => findLineVoiceEmojis(lines[index]?.text ?? '').length > 0);
    if (!marked) {
      const [lead, ...rest] = group;
      if (lead === undefined) continue;
      blocks.push({
        kind: 'split',
        left: [lead],
        right: rest,
      });
      continue;
    }

    pushSingles(blocks, group);
  }

  return blocks;
}
