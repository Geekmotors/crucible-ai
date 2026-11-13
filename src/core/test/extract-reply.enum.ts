import { ExtractReasoning } from './extract-reasoning.enum.js';

enum ExtractReply {
  Two = '{"value":2,"reasoning":"the answer is two"}',
  TwoAsText = '{"value":"2","reasoning":"the answer is two"}',
  City = '{"value":"Paris","reasoning":"lives in Paris"}',
  Booked = '{"value":true,"reasoning":"says the room is booked"}',
  Hedged = `{"value":null,"reasoning":"${ExtractReasoning.Hedged}"}`,
  Infinite = '{"value":1e999,"reasoning":"overflow"}',
  NoValue = '{"reasoning":"forgot the value"}',
  NoReasoning = '{"value":2}',
  NotJson = 'two',
}

export { ExtractReply };
