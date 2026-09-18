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

export function buildLyricBlocks(lines: LineLyrics[]): LyricBlock[] {
  const blocks: LyricBlock[] = [];
  const used = new Array<boolean>(lines.length).fill(false);

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

    const [lead, ...rest] = group;
    if (lead === undefined) continue;
    blocks.push({
      kind: 'split',
      left: [lead],
      right: rest,
    });
  }

  return blocks;
}
