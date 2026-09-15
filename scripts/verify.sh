#!/usr/bin/env bash

set -euo pipefail

REPORT_DIRECTORY="$(mktemp -d)"
trap 'rm -rf "${REPORT_DIRECTORY}"' EXIT

fail() {
  local gate="$1"
  local log_file="$2"

  echo
  echo "${gate} verification failed"
  echo "----------------------------------------"
  cat "${log_file}"
  exit 1
}

run_gate() {
  local gate="$1"
  local script_path="$2"
  local log_file="${REPORT_DIRECTORY}/${gate}.log"

  echo "Running ${gate}..."

  if ! bash "${script_path}" >"${log_file}" 2>&1; then
    fail "${gate}" "${log_file}"
  fi
}

find_summary() {
  local pattern="$1"
  local log_file="$2"

  grep -E "${pattern}" "${log_file}" | tail -n 1 || true
}

find_value() {
  local label="$1"
  local log_file="$2"

  awk -v label="${label}" '
    index($0, label) == 1 {
      value = $NF
    }

    END {
      print value
    }
  ' "${log_file}"
}

run_gate "G1" "./scripts/verify-g1.sh"
run_gate "G2" "./scripts/verify-g2.sh"
run_gate "G3" "./scripts/verify-g3.sh"
run_gate "G4" "./scripts/verify-g4.sh"
run_gate "G5" "./scripts/verify-g5.sh"

g1_summary="$(
  find_summary '^G1 resume after kill ' "${REPORT_DIRECTORY}/G1.log"
)"

g2_unique_events="$(
  find_value 'Unique processed events' "${REPORT_DIRECTORY}/G2.log"
)"

g2_duplicate_rows="$(
  find_value 'Duplicate processed rows' "${REPORT_DIRECTORY}/G2.log"
)"

g3_summary="$(
  find_summary '^G3 sink outage ' "${REPORT_DIRECTORY}/G3.log"
)"

g4_written_records="$(
  find_value 'Successful Elasticsearch docs' "${REPORT_DIRECTORY}/G4.log"
)"

g4_dlq_records="$(
  find_value 'DLQ messages' "${REPORT_DIRECTORY}/G4.log"
)"

g5_summary="$(
  find_summary '^G5 observability ' "${REPORT_DIRECTORY}/G5.log"
)"

if [[ -z "${g1_summary}" ]]; then
  fail "G1 summary" "${REPORT_DIRECTORY}/G1.log"
fi

if [[ -z "${g2_unique_events}" || -z "${g2_duplicate_rows}" ]]; then
  fail "G2 summary" "${REPORT_DIRECTORY}/G2.log"
fi

if [[ -z "${g3_summary}" ]]; then
  fail "G3 summary" "${REPORT_DIRECTORY}/G3.log"
fi

if [[ -z "${g4_written_records}" || -z "${g4_dlq_records}" ]]; then
  fail "G4 summary" "${REPORT_DIRECTORY}/G4.log"
fi

if [[ -z "${g5_summary}" ]]; then
  fail "G5 summary" "${REPORT_DIRECTORY}/G5.log"
fi

echo
echo "Verification report"
echo "============================================================"
echo "${g1_summary}"
printf \
  'G2 no duplicates ................ PASS (%s unique / %s duplicate rows)\n' \
  "${g2_unique_events}" \
  "${g2_duplicate_rows}"
echo "${g3_summary}"
printf \
  'G4 partial batch failure ........ PASS (%s written, %s in DLQ)\n' \
  "${g4_written_records}" \
  "${g4_dlq_records}"
echo "${g5_summary}"