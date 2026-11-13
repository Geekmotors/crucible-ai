def coherent_payload:
  [
    state_section,
    (.response | section("RESPONSE")),
    (.claim | section("CLAIM"))
  ]
  | join("\n\n");

def coherent_request($schema; $judge):
  chat_request($schema; $judge; coherent_payload);

def coherent_strict_reply($case):
  length == 1
  and (.[0] | type == "object")
  and (.[0] | keys == ["reasoning", "verdict"])
  and (.[0].verdict | type == "boolean")
  and (.[0].reasoning | type == "string");

def coherent_outcome:
  .[0].verdict;
