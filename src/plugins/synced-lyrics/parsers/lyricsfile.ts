import {parseDocument} from 'yaml';

import type {LineLyrics, LyricResult} from '../types';

const SUPPORTED_VERSION = '1.0';
const MAX_DOCUMENT_BYTES = 2_000_000;
const LEADING_SILENCE_MS = 300;
const CLOSING_SILENCE_MS = 10_000;

export class LyricsfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LyricsfileError';
  }
}

export type LyricsfileWord = {
  text: string;
  start_ms: number;
  end_ms?: number | undefined;
};

export type LyricsfileRawLine = {
  text: string;
  start_ms: number;
  end_ms?: number | undefined;
  words?: LyricsfileWord[] | undefined;
};

export type LyricsfileMetadata = {
  title: string;
  artist: string;
  album?: string | undefined;
  duration_ms?: number | undefined;
  offset_ms?: number | undefined;
  language?: string | undefined;
  instrumental?: boolean | undefined;
};

export type LyricsfileDocument = {
  version: string;
  metadata: LyricsfileMetadata;
  lines: LyricsfileRawLine[];
  plain?: string | undefined;
};

export type LyricsfileParsedLine = {
  time: string;
  timeInMs: number;
  duration: number;
  text: string;
  words: NonNullable<LineLyrics['words']>;
};

export type LyricsfileParseResult = {
  version: string;
  metadata: LyricsfileMetadata;
  lines: LyricsfileParsedLine[];
  plain?: string | undefined;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new LyricsfileError(`${path} must be a string`);
  }
  return value;
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return requireString(value, path);
}

function requireInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new LyricsfileError(`${path} must be an integer`);
  }
  return value;
}

function optionalInteger(value: unknown, path: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return requireInteger(value, path);
}

function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') {
    throw new LyricsfileError(`${path} must be a boolean`);
  }
  return value;
}

function requireNonNegativeMs(value: unknown, path: string): number {
  const ms = requireInteger(value, path);
  if (ms < 0) {
    throw new LyricsfileError(`${path} must not be negative`);
  }
  return ms;
}

function optionalEndMs(
  value: unknown,
  startMs: number,
  path: string,
): number | undefined {
  if (value === undefined || value === null) return undefined;
  const endMs = requireInteger(value, path);
  if (endMs < startMs) {
    throw new LyricsfileError(`${path} must be greater than or equal to start_ms`);
  }
  return endMs;
}

function formatTime(timeInMs: number): string {
  const minutes = Math.floor(timeInMs / 60000);
  const seconds = Math.floor((timeInMs % 60000) / 1000);
  const millis = timeInMs % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(millis).padStart(3, '0')}`;
}

function parseWord(value: unknown, path: string): LyricsfileWord {
  if (!isPlainObject(value)) {
    throw new LyricsfileError(`${path} must be a mapping`);
  }

  const startMs = requireNonNegativeMs(value.start_ms, `${path}.start_ms`);
  return {
    text: requireString(value.text, `${path}.text`),
    start_ms: startMs,
    end_ms: optionalEndMs(value.end_ms, startMs, `${path}.end_ms`),
  };
}

function parseLine(value: unknown, path: string): LyricsfileRawLine {
  if (!isPlainObject(value)) {
    throw new LyricsfileError(`${path} must be a mapping`);
  }

  const startMs = requireNonNegativeMs(value.start_ms, `${path}.start_ms`);
  const words = value.words;
  if (words !== undefined && words !== null && !Array.isArray(words)) {
    throw new LyricsfileError(`${path}.words must be a sequence`);
  }

  return {
    text: requireString(value.text, `${path}.text`),
    start_ms: startMs,
    end_ms: optionalEndMs(value.end_ms, startMs, `${path}.end_ms`),
    words: words?.map((word, index) => parseWord(word, `${path}.words[${index}]`)),
  };
}

function parseMetadata(value: unknown): LyricsfileMetadata {
  if (!isPlainObject(value)) {
    throw new LyricsfileError('metadata must be a mapping');
  }

  const durationMs = optionalInteger(value.duration_ms, 'metadata.duration_ms');
  if (durationMs !== undefined && durationMs < 0) {
    throw new LyricsfileError('metadata.duration_ms must not be negative');
  }

  return {
    title: requireString(value.title, 'metadata.title'),
    artist: requireString(value.artist, 'metadata.artist'),
    album: optionalString(value.album, 'metadata.album'),
    duration_ms: durationMs,
    offset_ms: optionalInteger(value.offset_ms, 'metadata.offset_ms'),
    language: optionalString(value.language, 'metadata.language'),
    instrumental: optionalBoolean(value.instrumental, 'metadata.instrumental'),
  };
}

function parseRoot(value: unknown): LyricsfileDocument {
  if (!isPlainObject(value)) {
    throw new LyricsfileError('Lyricsfile must contain a mapping at the top level');
  }

  const version = requireString(value.version, 'version');
  if (version !== SUPPORTED_VERSION) {
    throw new LyricsfileError(
      `Unsupported Lyricsfile version "${version}"; expected "${SUPPORTED_VERSION}"`,
    );
  }

  const metadata = parseMetadata(value.metadata);
  const instrumental = metadata.instrumental === true;

  if (value.lines !== undefined && value.lines !== null && !Array.isArray(value.lines)) {
    throw new LyricsfileError('lines must be a sequence');
  }

  const lines = (value.lines ?? []).map((line, index) =>
    parseLine(line, `lines[${index}]`),
  );
  const plain = optionalString(value.plain, 'plain');

  if (instrumental && (lines.length > 0 || (plain !== undefined && plain.length > 0))) {
    throw new LyricsfileError(
      'instrumental files must omit or empty both lines and plain',
    );
  }

  if (!instrumental && lines.length === 0 && (plain === undefined || plain.length === 0)) {
    throw new LyricsfileError('a non-instrumental file should contain lines or plain');
  }

  return {
    version,
    metadata,
    lines,
    plain,
  };
}

function wordDuration(
  word: LyricsfileWord,
  index: number,
  words: LyricsfileWord[],
  line: LyricsfileRawLine,
): number | undefined {
  if (word.end_ms !== undefined) {
    return word.end_ms - word.start_ms;
  }

  const next = words[index + 1];
  if (next) {
    return Math.max(0, next.start_ms - word.start_ms);
  }

  if (line.end_ms !== undefined) {
    return Math.max(0, line.end_ms - word.start_ms);
  }

  return undefined;
}

function lineDuration(
  line: LyricsfileRawLine,
  index: number,
  lines: LyricsfileRawLine[],
  durationMs?: number,
): number {
  if (line.end_ms !== undefined) {
    return line.end_ms - line.start_ms;
  }

  const next = lines[index + 1];
  if (next) {
    return Math.max(0, next.start_ms - line.start_ms);
  }

  if (durationMs !== undefined) {
    return Math.max(0, durationMs - line.start_ms);
  }

  return Number.POSITIVE_INFINITY;
}

function toParsedLines(doc: LyricsfileDocument): LyricsfileParsedLine[] {
  const lines = doc.lines.map((line, index) => {
    const words = (line.words ?? []).map((word, wordIndex, allWords) => ({
      timeInMs: word.start_ms,
      word: word.text,
      duration: wordDuration(word, wordIndex, allWords, line),
    }));

    return {
      time: formatTime(line.start_ms),
      timeInMs: line.start_ms,
      duration: lineDuration(line, index, doc.lines, doc.metadata.duration_ms),
      text: line.text,
      words,
    };
  });

  const first = lines[0];
  if (first && first.timeInMs > LEADING_SILENCE_MS) {
    lines.unshift({
      time: formatTime(0),
      timeInMs: 0,
      duration: first.timeInMs,
      text: '',
      words: [],
    });
  }

  const last = lines.at(-1);
  if (last?.text.trim()) {
    const start = Number.isFinite(last.duration)
      ? last.timeInMs + last.duration
      : last.timeInMs;
    const remaining =
      doc.metadata.duration_ms !== undefined
        ? doc.metadata.duration_ms - start
        : CLOSING_SILENCE_MS;
    lines.push({
      time: formatTime(start),
      timeInMs: start,
      duration: Math.max(remaining, CLOSING_SILENCE_MS),
      text: '',
      words: [],
    });
  }

  return lines;
}

function resolveDurationSeconds(parsed: LyricsfileParseResult): number | undefined {
  if (parsed.metadata.duration_ms !== undefined) {
    return parsed.metadata.duration_ms / 1000;
  }

  const last = parsed.lines.at(-1);
  if (!last) return undefined;
  if (Number.isFinite(last.duration)) {
    return (last.timeInMs + last.duration) / 1000;
  }
  return last.timeInMs / 1000;
}

export const Lyricsfile = {
  parse(text: string): LyricsfileParseResult {
    if (new TextEncoder().encode(text).length > MAX_DOCUMENT_BYTES) {
      throw new LyricsfileError('Lyricsfile exceeds the maximum document size');
    }

    const document = parseDocument(text, {
      prettyErrors: true,
      uniqueKeys: true,
    });

    if (document.errors.length > 0) {
      throw new LyricsfileError(
        document.errors.map((error) => error.message).join('; '),
      );
    }

    const doc = parseRoot(document.toJS({maxAliasCount: 100}));
    const parsed: LyricsfileParseResult = {
      version: doc.version,
      metadata: doc.metadata,
      lines: toParsedLines(doc),
    };
    if (doc.plain !== undefined) {
      parsed.plain = doc.plain;
    }
    return parsed;
  },

  toLyricResult(parsed: LyricsfileParseResult): LyricResult {
    const result: LyricResult = {
      title: parsed.metadata.title,
      artists: parsed.metadata.artist.split(/[&,]/g).map((artist) => artist.trim()),
    };

    if (parsed.lines.length) {
      result.lines = parsed.lines.map((line) => ({
        ...line,
        status: 'upcoming' as const,
      }));
    }

    if (parsed.plain !== undefined) {
      result.lyrics = parsed.plain;
    }

    const duration = resolveDurationSeconds(parsed);
    if (duration !== undefined) {
      result.duration = duration;
    }

    return result;
  },
};
