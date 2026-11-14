import { describe, expect, it } from '@jest/globals';
import { JudgeReplyFixtureHarness } from './test/judge-reply-fixture-harness.util.js';
import { SpecFixtures } from './test/spec-fixtures.util.js';

describe('spec judge/reply', () => {
  it.each(SpecFixtures.judgeReply.cases)('$id', async (fixture) => {
    await expect(JudgeReplyFixtureHarness.reply(fixture.input)).resolves.toEqual(fixture.expect);
  });
});
