import { ExtractReasoning } from './extract-reasoning.enum.js';

enum ExtractReply {
  Two = '{"value":2,"reasoning":"the answer is two"}',
  TwoAsText = '{"value":"2","reasoning":"the answer is two"}',
  City = '{"value":"Paris","reasoning":"lives in Paris"}',
  Hedged = `{"value":null,"reasoning":"${ExtractReasoning.Hedged}"}`,
  NotJson = 'two',
}

export { ExtractReply };
