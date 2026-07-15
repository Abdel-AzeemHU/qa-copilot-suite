#!/usr/bin/env bash
set -euo pipefail

# Qaera — composite action runner.
# Triggers a pipeline, polls until terminal, prints a summary, and exits
# non-zero if the pipeline failed and fail-on-regression is true.

: "${QAERA_TOKEN:?api-token input is required}"
: "${QAERA_TARGET_URL:?target-url input is required}"
QAERA_BASE_URL="${QAERA_BASE_URL:-https://app.qaera.ai}"
QAERA_VISUAL="${QAERA_VISUAL:-true}"
QAERA_FAIL="${QAERA_FAIL:-true}"
QAERA_TIMEOUT="${QAERA_TIMEOUT:-600}"
QAERA_REF="${QAERA_REF:-}"
QAERA_COMMIT="${QAERA_COMMIT:-}"
QAERA_PR_NUMBER="${QAERA_PR_NUMBER:-}"

# Mask the token in logs.
echo "::add-mask::${QAERA_TOKEN}"

# Strip a trailing slash from the base URL.
QAERA_BASE_URL="${QAERA_BASE_URL%/}"

step_summary() {
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    echo "$1" >>"${GITHUB_STEP_SUMMARY}"
  fi
}

# --- Build request body ----------------------------------------------------
visual_bool="false"
if [ "${QAERA_VISUAL}" = "true" ]; then visual_bool="true"; fi

body=$(jq -n \
  --arg targetUrl "${QAERA_TARGET_URL}" \
  --argjson visual "${visual_bool}" \
  --arg ref "${QAERA_REF}" \
  --arg commit "${QAERA_COMMIT}" \
  --arg prNumber "${QAERA_PR_NUMBER}" \
  '{targetUrl: $targetUrl, visual: $visual}
   + (if $ref != "" then {ref: $ref} else {} end)
   + (if $commit != "" then {commit: $commit} else {} end)
   + (if $prNumber != "" then {prNumber: ($prNumber | tonumber)} else {} end)')

echo "Triggering Qaera pipeline for ${QAERA_TARGET_URL} ..."

trigger_resp=$(curl -sS -X POST "${QAERA_BASE_URL}/api/ci/trigger" \
  -H "Authorization: Bearer ${QAERA_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${body}") || {
  echo "::error::Failed to reach Qaera trigger endpoint."
  exit 1
}

pipeline_id=$(echo "${trigger_resp}" | jq -r '.pipelineRunId // empty')
if [ -z "${pipeline_id}" ]; then
  echo "::error::Trigger did not return a pipelineRunId. Response: ${trigger_resp}"
  exit 1
fi

echo "Pipeline started: ${pipeline_id}"

# --- Poll until terminal ---------------------------------------------------
deadline=$(( $(date +%s) + QAERA_TIMEOUT ))
status="queued"
conclusion="neutral"
summary=""
stages_md=""
run_url=""
gate_verdict=""
gate_reasons=""
gate_class=""

while true; do
  if [ "$(date +%s)" -ge "${deadline}" ]; then
    echo "::error::Timed out after ${QAERA_TIMEOUT}s waiting for pipeline ${pipeline_id}."
    step_summary "## Qaera: timed out after ${QAERA_TIMEOUT}s"
    exit 1
  fi

  poll_resp=$(curl -sS "${QAERA_BASE_URL}/api/ci/runs/${pipeline_id}" \
    -H "Authorization: Bearer ${QAERA_TOKEN}") || {
    echo "Poll request failed; retrying in 5s ..."
    sleep 5
    continue
  }

  status=$(echo "${poll_resp}" | jq -r '.status // "unknown"')
  conclusion=$(echo "${poll_resp}" | jq -r '.conclusion // "neutral"')
  summary=$(echo "${poll_resp}" | jq -r '.summary // ""')
  run_url=$(echo "${poll_resp}" | jq -r '.url // ""')
  stages_md=$(echo "${poll_resp}" | jq -r '.stages[]? | "- " + .name + ": " + .status')
  gate_verdict=$(echo "${poll_resp}" | jq -r '.gate.verdict // ""')
  gate_reasons=$(echo "${poll_resp}" | jq -r '.gate.reasons[]? | "- " + .')
  gate_class=$(echo "${poll_resp}" | jq -r '.gate.failureClass // ""')

  echo "Status: ${status}"

  case "${status}" in
    succeeded | failed | error)
      break
      ;;
  esac
  sleep 5
done

# --- Report ----------------------------------------------------------------
echo "----------------------------------------"
echo "Pipeline ${pipeline_id} finished: ${status} (${conclusion})"
[ -n "${gate_verdict}" ] && echo "Merge gate: ${gate_verdict}${gate_class:+ (failure class: ${gate_class})}"
[ -n "${gate_reasons}" ] && echo "${gate_reasons}"
[ -n "${summary}" ] && echo "${summary}"
echo "Stages:"
echo "${stages_md}"
[ -n "${run_url}" ] && echo "View run: ${run_url}"
echo "----------------------------------------"

{
  echo "## Qaera"
  echo ""
  echo "**Status:** ${status} (${conclusion})"
  if [ -n "${gate_verdict}" ]; then
    echo ""
    echo "**Merge gate:** ${gate_verdict}${gate_class:+ — failure classified as \`${gate_class}\`}"
    [ -n "${gate_reasons}" ] && echo "" && echo "${gate_reasons}"
  fi
  [ -n "${summary}" ] && echo "" && echo "${summary}"
  echo ""
  echo "### Stages"
  echo "${stages_md}"
  [ -n "${run_url}" ] && echo "" && echo "[View run](${run_url})"
} >>"${GITHUB_STEP_SUMMARY:-/dev/null}"

# --- Gate decision -----------------------------------------------------------
# The flakiness-aware gate verdict takes precedence over the raw conclusion:
# a quarantined known-flaky failure yields "pass_with_warnings" and does NOT
# block the merge. Fall back to the raw conclusion for older servers.
if [ "${QAERA_FAIL}" = "true" ]; then
  if [ -n "${gate_verdict}" ]; then
    case "${gate_verdict}" in
      pass | pass_with_warnings)
        [ "${gate_verdict}" = "pass_with_warnings" ] && \
          echo "::warning::Known-flaky test failed but is quarantined — not blocking the merge."
        ;;
      *)
        echo "::error::Qaera merge gate blocked this change."
        exit 1
        ;;
    esac
  elif [ "${conclusion}" = "failure" ]; then
    echo "::error::Qaera pipeline failed."
    exit 1
  fi
fi

exit 0
