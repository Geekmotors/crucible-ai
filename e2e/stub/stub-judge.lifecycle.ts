import { afterAll, beforeAll } from '@jest/globals';
import { StubJudgeHost } from '../test/stub-judge-host.util.js';

const host = new StubJudgeHost();

beforeAll(() => host.start());

afterAll(() => host.stop());
