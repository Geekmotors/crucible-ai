def fence_open: "<<<";
def fence_close: ">>>";

def neutralize_fences:
  split("\n")
  | map(if . == fence_open or . == fence_close then " " + . else . end)
  | join("\n");

def section($header):
  "\($header)\n\(fence_open)\n\(neutralize_fences)\n\(fence_close)";

def coherent_payload:
  [
    (if (.state | length) > 0 then (.state | join("\n") | section("STATE")) else empty end),
    (.response | section("RESPONSE")),
    (.claim | section("CLAIM"))
  ]
  | join("\n\n");

def coherent_request($schema; $judge):
  ($judge.meta // {})
  + {
      model: $judge.model,
      messages: [
        { role: "system", content: $schema },
        { role: "user", content: coherent_payload }
      ],
      usage: { include: true }
    };

def strict_verdict:
  length == 1
  and (.[0] | type == "object")
  and (.[0] | keys == ["reasoning", "verdict"])
  and (.[0].verdict | type == "boolean")
  and (.[0].reasoning | type == "string");
