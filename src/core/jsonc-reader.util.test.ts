import { describe, expect, it } from '@jest/globals';
import { JsoncReader } from './jsonc-reader.util.js';
import { JsoncText } from './test/jsonc-text.enum.js';
import { JsoncValue } from './test/jsonc-value.enum.js';
import { LeakedSecret } from './test/leaked-secret.enum.js';

const reader = new JsoncReader();

describe('JsoncReader reads JSON with comments', () => {
  it('reads plain JSON unchanged', () => {
    expect(reader.read(JsoncText.Plain)).toEqual({
      ok: true,
      value: { name: JsoncValue.Name, runs: JsoncValue.Runs },
    });
  });

  it('ignores line comments, leading, trailing and on their own line', () => {
    expect(reader.read(JsoncText.LineComments)).toEqual({
      ok: true,
      value: { name: JsoncValue.Name, runs: JsoncValue.Runs },
    });
  });

  it('ignores block comments, including ones spanning lines', () => {
    expect(reader.read(JsoncText.BlockComments)).toEqual({
      ok: true,
      value: { name: JsoncValue.Name },
    });
  });

  it('accepts a trailing comma in an object', () => {
    expect(reader.read(JsoncText.TrailingCommaInObject)).toEqual({
      ok: true,
      value: { name: JsoncValue.Name, runs: JsoncValue.Runs },
    });
  });

  it('accepts a trailing comma in an array', () => {
    expect(reader.read(JsoncText.TrailingCommaInArray)).toEqual({
      ok: true,
      value: { list: [1, 2, 3] },
    });
  });

  it('accepts a trailing comma followed by comments', () => {
    expect(reader.read(JsoncText.TrailingCommaBeforeComment)).toEqual({
      ok: true,
      value: { name: JsoncValue.Name },
    });
  });

  it('ends a line comment at a carriage-return line ending', () => {
    expect(reader.read(JsoncText.CarriageReturnLines)).toEqual({
      ok: true,
      value: { name: JsoncValue.Name, runs: JsoncValue.Runs },
    });
  });

  it('accepts a leading byte-order mark', () => {
    expect(reader.read(JsoncText.ByteOrderMark)).toEqual({
      ok: true,
      value: { name: JsoncValue.Name },
    });
  });
});

describe('JsoncReader keeps string content as text', () => {
  it('keeps // inside a string, as in a URL', () => {
    expect(reader.read(JsoncText.LineMarkerInString)).toEqual({
      ok: true,
      value: { url: JsoncValue.Url },
    });
  });

  it('keeps /* and */ inside a string', () => {
    expect(reader.read(JsoncText.BlockMarkerInString)).toEqual({
      ok: true,
      value: { glob: 'src/**/*.ts', close: '*/' },
    });
  });

  it('keeps a comma before a closing bracket inside a string', () => {
    expect(reader.read(JsoncText.CommaBraceInString)).toEqual({
      ok: true,
      value: { text: 'a,}b,]' },
    });
  });

  it('does not end a string at an escaped quote', () => {
    expect(reader.read(JsoncText.EscapedQuote)).toEqual({
      ok: true,
      value: { quote: 'say "hi" // not a comment' },
    });
  });

  it('ends a string at a quote that follows an escaped backslash', () => {
    expect(reader.read(JsoncText.EscapedBackslashBeforeQuote)).toEqual({
      ok: true,
      value: { path: 'C:\\', next: 1 },
    });
  });
});

describe('JsoncReader rejects malformed content', () => {
  it.each([
    ['an unterminated block comment', JsoncText.UnterminatedBlockComment],
    ['an unterminated string', JsoncText.UnterminatedString],
    ['a missing comma', JsoncText.MissingCommaOnLineThree],
    ['a comma with nothing before it', JsoncText.LoneComma],
    ['a number split by a block comment', JsoncText.BlockCommentBetweenDigits],
    ['empty content', JsoncText.Empty],
    ['only a comment', JsoncText.OnlyComment],
  ])('%s', (_label, text) => {
    expect(reader.read(text).ok).toBe(false);
  });

  it('names the line of an unterminated block comment', () => {
    expect(reader.read(JsoncText.UnterminatedBlockComment)).toEqual({ ok: false, line: 3 });
  });

  it('names the line of an unterminated string', () => {
    expect(reader.read(JsoncText.UnterminatedString)).toEqual({ ok: false, line: 2 });
  });

  it('names the line of a syntax error', () => {
    expect(reader.read(JsoncText.MissingCommaOnLineThree)).toEqual({ ok: false, line: 3 });
  });

  it('names the line of a syntax error in a file with carriage-return line endings', () => {
    expect(reader.read(JsoncText.MissingCommaOnLineThreeCarriageReturn)).toEqual({
      ok: false,
      line: 3,
    });
  });

  it('never carries the content of a malformed file', () => {
    expect(JSON.stringify(reader.read(JsoncText.LeakedKey))).not.toContain(
      LeakedSecret.InMalformedConfig,
    );
  });
});
