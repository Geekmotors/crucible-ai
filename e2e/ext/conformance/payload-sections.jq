def fence_open: "<<<";
def fence_close: ">>>";

def neutralize_fences:
  split("\n")
  | map(if . == fence_open or . == fence_close then " " + . else . end)
  | join("\n");

def section($header):
  "\($header)\n\(fence_open)\n\(neutralize_fences)\n\(fence_close)";

def state_section:
  if (.state | length) > 0 then (.state | join("\n") | section("STATE")) else empty end;

def chat_request($schema; $judge; $payload):
  ($judge.meta // {})
  + {
      model: $judge.model,
      messages: [
        { role: "system", content: $schema },
        { role: "user", content: $payload }
      ],
      usage: { include: true }
    };
