#!/bin/sh
set -eu

HARNESS_DIR=$(cd "$(dirname "$0")" && pwd)
SCHEMA_FILE=${CONFORMANCE_SCHEMA:-$HARNESS_DIR/schema.md}
CASES_FILE=${CONFORMANCE_CASES:-$HARNESS_DIR/cases.json}
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

print_payloads() {
  jq_lib -r 'include "coherent-payload"; .cases[] | "=== \(.id)\n\(coherent_payload)"' "$CASES_FILE"
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
    --rawfile schema "$SCHEMA_FILE" \
    --slurpfile judge "$JUDGE_CONFIG" \
    --slurpfile matrix "$CASES_FILE" \
    --argjson index "$1" \
    'include "coherent-payload"; $matrix[0].cases[$index] | coherent_request($schema; $judge[0])'
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
  case_count=$(jq '.cases | length' "$CASES_FILE")
  model=$(jq -r '.model' "$JUDGE_CONFIG")
  echo "conformance: $case_count cases x $REPS reps against $model"
  calls=0
  failures=0
  total_cost=0
  summary=""
  index=0
  while [ "$index" -lt "$case_count" ]; do
    case_id=$(jq -r ".cases[$index].id" "$CASES_FILE")
    expected=$(jq -r ".cases[$index].expected" "$CASES_FILE")
    request_body "$index" > "$WORK_DIR/body.json"
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
      if jq_lib -s -e 'include "coherent-payload"; strict_verdict' "$WORK_DIR/content.txt" > /dev/null 2>&1; then
        compliant=$((compliant + 1))
        verdict=$(jq -s -r '.[0].verdict' "$WORK_DIR/content.txt")
      else
        verdict=non-compliant
      fi
      if [ "$verdict" = "$expected" ]; then
        matched=$((matched + 1))
        echo "PASS $case_id rep $rep/$REPS: verdict $verdict (${seconds}s, \$$cost)"
      else
        failures=$((failures + 1))
        echo "FAIL $case_id rep $rep/$REPS: verdict $verdict, expected $expected (${seconds}s, \$$cost)"
        echo "     reply: $(cat "$WORK_DIR/content.txt")"
      fi
      rep=$((rep + 1))
    done
    summary="$summary$(printf '%-26s expected %-5s verdict matches %s/%s  strict JSON %s/%s  errored %s' \
      "$case_id" "$expected" "$matched" "$REPS" "$compliant" "$REPS" "$errored")
"
    index=$((index + 1))
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

case "$REPS" in
  '' | *[!0-9]* | 0)
    echo "conformance: CONFORMANCE_REPS must be a positive integer, got '$REPS'" >&2
    exit "$EXIT_USAGE"
    ;;
esac

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
