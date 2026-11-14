import { describe, expect, it } from '@jest/globals';
import { JsoncReader } from './jsonc-reader.util.js';
import { JsoncText } from './test/jsonc-text.enum.js';

const reader = new JsoncReader();

describe('JsoncReader names the line of malformed content', () => {
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
});
