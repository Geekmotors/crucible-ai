def extract_payload:
  [
    state_section,
    (.response | section("RESPONSE")),
    (.target | section("TARGET")),
    (.type | section("TYPE")),
    (.mode | section("MODE"))
  ]
  | join("\n\n");

def extract_request($schema; $judge):
  chat_request($schema; $judge; extract_payload);

def typed_value($wanted):
  . == null
  or (type == $wanted and ($wanted != "number" or isinfinite == false));

def extract_strict_reply($case):
  length == 1
  and (.[0] | type == "object")
  and (.[0] | keys == ["reasoning", "value"])
  and (.[0].value | typed_value($case.type))
  and (.[0].reasoning | type == "string");

def extract_outcome:
  .[0].value
  | if type == "number" then . + 0 else . end;
