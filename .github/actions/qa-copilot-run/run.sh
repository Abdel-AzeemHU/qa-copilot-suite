#!/usr/bin/env bash
set -euo pipefail

# QA Copilot Suite — composite action runner.
# Triggers a pipeline, polls until terminal, prints a summary, and exits
# non-zero if the pipeline failed and fail-on-regression is true.

: "${QACS_TOKEN:?api-token input is required}"
: "${QACS_TARGET_URL:?target-url input is required}"
QACS_BASE_URL="${QACS_BASE_URL:-https://app.qacopilot.dev}"
QACS_VISUAL="${QACS_VISUAL:-true}"
QACS_FAIL="${QACS_FAIL:-true}"
QACS_TIMEOUT="${QACS_TIMEOUT:-600}"
QACS_REF="${QACS_REF:-}"
QACS_COMMIT="${QACS_COMMIT:-}"
QACS_PR_NUMBER="${QACS_PR_NUMBER:-}"

# Mask the token in logs.
echo "::add-mask::${QACS_TOKEN}"

# Strip a trailing slash from the base URL.
QACS_BASE_URL="${QACS_BASE_URL%/}"

step_summary() {
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    echo "$1" >>"${GITHUB_STEP_SUMMARY}"
  fi
}

# --- Build request body ----------------------------------------------------
visual_bool="false"
if [ "${QACS_VISUAL}" = "true" ]; then visual_bool="true"; fi

body=$(jq -n \
  --arg targetUrl "${QACS_TARGET_URL}" \
  --argjson visual "${visual_bool}" \
  --arg ref "${QACS_REF}" \
  --arg commit "${QACS_COMMIT}" \
  --arg prNumber "${QACS_PR_NUMBER}" \
  '{targetUrl: $targetUrl, visual: $visual}
   + (if $ref != "" then {ref: $ref} else {} end)
   + (if $commit != "" then {commit: $commit} else {} end)
   + (if $prNumber != "" then {prNumber: ($prNumber | tonumber)} else {} end)')

echo "Triggering QA Copilot Suite pipeline for ${QACS_TARGET_URL} ..."

trigger_resp=$(curl -sS -X POST "${QACS_BASE_URL}/api/ci/trigger" \
  -H "Authorization: Bearer ${QACS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${body}") || {
  echo "::error::Failed to reach QA Copilot Suite trigger endpoint."
  exit 1
}

pipeline_id=$(echo "${trigger_resp}" | jq -r '.pipelineRunId // empty')
if [ -z "${pipeline_id}" ]; then
  echo "::error::Trigger did not return a pipelineRunId. Response: ${trigger_resp}"
  exit 1
fi

echo "Pipeline started: ${pipeline_id}"

# --- Poll until terminal ---------------------------------------------------
deadline=$(( $(date +%s) + QACS_TIMEOUT ))
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
    echo "::error::Timed out after ${QACS_TIMEOUT}s waiting for pipeline ${pipeline_id}."
    step_summary "## QA Copilot Suite: timed out after ${QACS_TIMEOUT}s"
    exit 1
  fi

  poll_resp=$(curl -sS "${QACS_BASE_URL}/api/ci/runs/${pipeline_id}" \
    -H "Authorization: Bearer ${QACS_TOKEN}") || {
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
  echo "## QA Copilot Suite"
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
if [ "${QACS_FAIL}" = "true" ]; then
  if [ -n "${gate_verdict}" ]; then
    case "${gate_verdict}" in
      pass | pass_with_warnings)
        [ "${gate_verdict}" = "pass_with_warnings" ] && \
          echo "::warning::Known-flaky test failed but is quarantined — not blocking the merge."
        ;;
      *)
        echo "::error::QA Copilot Suite merge gate blocked this change."
        exit 1
        ;;
    esac
  elif [ "${conclusion}" = "failure" ]; then
    echo "::error::QA Copilot Suite pipeline failed."
    exit 1
  fi
fi

exit 0
