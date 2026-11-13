#!/bin/sh
set -eu

HARNESS_DIR=$(cd "$(dirname "$0")" && pwd)
SUITES=${CONFORMANCE_SUITES:-coherent extract}
SCHEMA_DIR=${CONFORMANCE_SCHEMA_DIR:-$HARNESS_DIR/schemas}
CASES_DIR=${CONFORMANCE_CASES_DIR:-$HARNESS_DIR/cases}
JUDGE_CONFIG=${CONFORMANCE_JUDGE_CONFIG:-$HARNESS_DIR/judge.config.json}
REPS=${CONFORMANCE_REPS:-3}
EXTRA_CA_FILE=${CONFORMANCE_EXTRA_CA:-/etc/conformance/extra-ca.pem}
SYSTEM_CA_FILE=/etc/ssl/certs/ca-certificates.crt
ENDPOINT=https://openrouter.ai/api/v1/chat/completions
CALL_TIMEOUT_SECONDS=120
EXIT_MISMATCH=1
EXIT_USAGE=2

jq_lib() {
  jq -L "$HARNESS_DIR" "$@"
}

suite_defs() {
  cat "$HARNESS_DIR/payload-sections.jq" "$HARNESS_DIR/$1-payload.jq"
}

schema_file() {
  printf '%s/%s.md' "$SCHEMA_DIR" "$1"
}

cases_file() {
  printf '%s/%s.json' "$CASES_DIR" "$1"
}

require_suites() {
  for suite in $SUITES; do
    case "$suite" in
      coherent | extract) ;;
      *)
        echo "conformance: unknown suite '$suite' in CONFORMANCE_SUITES (known: coherent extract)" >&2
        exit "$EXIT_USAGE"
        ;;
    esac
  done
}

print_payloads() {
  for suite in $SUITES; do
    jq_lib -r --arg suite "$suite" \
      "$(suite_defs "$suite")
.cases[] | \"=== \\(\$suite)/\\(.id)\\n\\(${suite}_payload)\"" \
      "$(cases_file "$suite")"
  done
}

require_key() {
  if [ -z "${OPENROUTER_API_KEY:-}" ]; then
    echo "conformance: OPENROUTER_API_KEY is not set. Pass it at runtime: docker run --env OPENROUTER_API_KEY ..." >&2
    exit "$EXIT_USAGE"
  fi
}

prepare_ca_bundle() {
  CA_BUNDLE=$WORK_DIR/ca-bundle.pem
  cat "$SYSTEM_CA_FILE" > "$CA_BUNDLE"
  if [ -e "$EXTRA_CA_FILE" ]; then
    cat "$EXTRA_CA_FILE" >> "$CA_BUNDLE"
  fi
}

request_body() {
  jq_lib -n \
    --rawfile schema "$(schema_file "$1")" \
    --slurpfile judge "$JUDGE_CONFIG" \
    --slurpfile matrix "$(cases_file "$1")" \
    --argjson index "$2" \
    "$(suite_defs "$1")
\$matrix[0].cases[\$index] | ${1}_request(\$schema; \$judge[0])"
}

strict_outcome() {
  jq_lib -s -c \
    --slurpfile matrix "$(cases_file "$1")" \
    --argjson index "$2" \
    "$(suite_defs "$1")
if ${1}_strict_reply(\$matrix[0].cases[\$index]) then ${1}_outcome else error(\"non-compliant\") end" \
    "$3"
}

call_judge() {
  printf 'header = "Authorization: Bearer %s"\n' "$OPENROUTER_API_KEY" |
    curl --config - \
      --silent --show-error \
      --max-time "$CALL_TIMEOUT_SECONDS" \
      --cacert "$CA_BUNDLE" \
      --header 'Content-Type: application/json' \
      --data-binary "@$1" \
      --output "$2" \
      --write-out '%{http_code} %{time_total}' \
      "$ENDPOINT"
}

run_matrix() {
  model=$(jq -r '.model' "$JUDGE_CONFIG")
  echo "conformance: suites [$SUITES] x $REPS reps against $model"
  calls=0
  failures=0
  total_cost=0
  summary=""
  for suite in $SUITES; do
    run_suite "$suite"
  done
  echo
  printf '%s' "$summary"
  echo "calls $calls, cost \$$total_cost"
  if [ "$failures" -gt 0 ]; then
    echo "conformance: FAILED ($failures of $calls calls did not conform)"
    exit "$EXIT_MISMATCH"
  fi
  echo "conformance: PASSED"
}

run_suite() {
  suite=$1
  cases=$(cases_file "$suite")
  case_count=$(jq '.cases | length' "$cases")
  echo "conformance: suite $suite, $case_count cases"
  index=0
  while [ "$index" -lt "$case_count" ]; do
    case_id="$suite/$(jq -r ".cases[$index].id" "$cases")"
    expected=$(jq -c ".cases[$index].expected" "$cases")
    request_body "$suite" "$index" > "$WORK_DIR/body.json"
    matched=0
    compliant=0
    errored=0
    rep=1
    while [ "$rep" -le "$REPS" ]; do
      calls=$((calls + 1))
      if ! transport=$(call_judge "$WORK_DIR/body.json" "$WORK_DIR/reply.json"); then
        transport="curl-failed 0"
      fi
      status=${transport% *}
      seconds=${transport#* }
      if [ "$status" != "200" ] || ! jq -e '.choices[0].message.content | type == "string"' "$WORK_DIR/reply.json" > /dev/null 2>&1; then
        errored=$((errored + 1))
        failures=$((failures + 1))
        echo "ERRORED $case_id rep $rep/$REPS: http $status"
        rep=$((rep + 1))
        continue
      fi
      cost=$(jq -r '.usage.cost // 0' "$WORK_DIR/reply.json")
      total_cost=$(awk -v a="$total_cost" -v b="$cost" 'BEGIN { printf "%.6f", a + b }')
      jq -j '.choices[0].message.content' "$WORK_DIR/reply.json" > "$WORK_DIR/content.txt"
      if outcome=$(strict_outcome "$suite" "$index" "$WORK_DIR/content.txt" 2> /dev/null); then
        compliant=$((compliant + 1))
      else
        outcome=non-compliant
      fi
      if [ "$outcome" = "$expected" ]; then
        matched=$((matched + 1))
        echo "PASS $case_id rep $rep/$REPS: $outcome (${seconds}s, \$$cost)"
      else
        failures=$((failures + 1))
        echo "FAIL $case_id rep $rep/$REPS: $outcome, expected $expected (${seconds}s, \$$cost)"
        echo "     reply: $(cat "$WORK_DIR/content.txt")"
      fi
      rep=$((rep + 1))
    done
    summary="$summary$(printf '%-34s expected %-7s matches %s/%s  strict JSON %s/%s  errored %s' \
      "$case_id" "$expected" "$matched" "$REPS" "$compliant" "$REPS" "$errored")
"
    index=$((index + 1))
  done
}

case "$REPS" in
  '' | *[!0-9]* | 0)
    echo "conformance: CONFORMANCE_REPS must be a positive integer, got '$REPS'" >&2
    exit "$EXIT_USAGE"
    ;;
esac

require_suites

case "${1:-run}" in
  payloads)
    print_payloads
    ;;
  run)
    require_key
    WORK_DIR=$(mktemp -d)
    trap 'rm -rf "$WORK_DIR"' EXIT
    prepare_ca_bundle
    run_matrix
    ;;
  *)
    echo "usage: conformance.sh [run|payloads]" >&2
    exit "$EXIT_USAGE"
    ;;
esac
