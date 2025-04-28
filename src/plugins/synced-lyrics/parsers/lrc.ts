interface LRCTag {
  tag: string;
  value: string;
}

export interface LRCLine {
  time: string;
  timeInMs: number;
  duration: number;
  text: string;
}


interface LRC {
  tags: LRCTag[];
  lines: LRCLine[];
}

const tagRegex = /^\[(?<tag>\w+):\s*(?<value>.+?)\s*\]$/;
const lyricRegex = /^\[(?<minutes>\d+):(?<seconds>\d+)\.(?<milliseconds>\d+)\](?<text>.+)$/;

export const LRC = {
  parse: (text: string): LRC => {
    const lrc: LRC = {
      tags: [],
      lines: [],
    };

    let offset = 0;
    let previousLine: LRCLine | null = null;

    for (const line of text.split('\n')) {
      if (!line.trim().startsWith('[')) continue;

      const lyric = line.match(lyricRegex)?.groups;

      if (!lyric) {
        const tag = line.match(tagRegex)?.groups;

        if (tag && tag.value && tag.tag) {
          offset = parseInt(tag.value);
          if (tag.tag === 'offset') {
            offset = parseInt(tag.value);
            continue;
          }

          lrc.tags.push({
            tag: tag.tag,
            value: tag.value,
          });
        }
        continue;
      }

      const {minutes, seconds, milliseconds, text} = lyric;

      if (!minutes || !seconds || !milliseconds || !text) continue;

      const timeInMs =
        parseInt(minutes) * 60 * 1000 +
        parseInt(seconds) * 1000 +
        parseInt(milliseconds);

      const currentLine: LRCLine = {
        time: `${minutes}:${seconds}:${milliseconds}`,
        timeInMs,
        text: text.trim(),
        duration: Infinity,
      };

      if (previousLine) {
        previousLine.duration = timeInMs - previousLine.timeInMs;
      }

      previousLine = currentLine;
      lrc.lines.push(currentLine);
    }

    for (const line of lrc.lines) {
      line.timeInMs += offset;
    }

    const first = lrc.lines.at(0);
    if (first && first.timeInMs > 300) {
      lrc.lines.unshift({
        time: '0:0:0',
        timeInMs: 0,
        duration: first.timeInMs,
        text: '',
      });
    }

    return lrc;
  },
};
