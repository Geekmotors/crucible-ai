enum VerdictReply {
  Coherent = '{"verdict":true,"reasoning":"consistent with the facts"}',
  Contradicted = '{"verdict":false,"reasoning":"the facts say otherwise"}',
}

export { VerdictReply };
