def fence_open: "<<<";
def fence_close: ">>>";

def fence_line_breaks: ["\n", "\u000b", "\f", "\r", "\u001c", "\u001d", "\u001e", "\u0085", "\u2028", "\u2029"];
def fence_invisible: "\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff0-\ufff8\ud82f\udca0-\ud82f\udca3\ud834\udd73-\ud834\udd7a\udb40\udc00-\udb43\udfff";
def fence_padding: "[\t \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\(fence_invisible)]*";
def fence_marker($marker): $marker | split("") | join("[\(fence_invisible)]*");
def fence_line: "\\A\(fence_padding)(?:\(fence_marker(fence_open))|\(fence_marker(fence_close)))\(fence_padding)\\z";

def neutralize_lines($breaks; $fence_line):
  if $breaks == [] then (if test($fence_line) then " " + . else . end)
  else $breaks[0] as $break | split($break) | map(neutralize_lines($breaks[1:]; $fence_line)) | join($break)
  end;

def neutralize_fences: neutralize_lines(fence_line_breaks; fence_line);

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
      ]
    }
  + (if $judge.provider == "openrouter" then { usage: { include: true } } else {} end);
