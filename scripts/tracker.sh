#!/usr/bin/env bash
# tracker.sh — the only safe way to change rows on TRACKER.md.
# Several Claude sessions share the board: a lock directory serialises writes, and a row can only be
# claimed while it is pending. The board always lives in the MAIN checkout, even when this script is run
# from a git worktree, so every session sees the same rows.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
COMMON="$(git -C "$HERE" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
if [ -n "$COMMON" ]; then ROOT="$(dirname "$COMMON")"; else ROOT="$(dirname "$HERE")"; fi
FILE="$ROOT/TRACKER.md"
LOCK="$ROOT/.tracker.lock"

usage() {
  cat >&2 <<'EOF'
Usage (run from anywhere in the repo or a worktree):
  scripts/tracker.sh list [status]                         every row (optionally only one status)
  scripts/tracker.sh next <who>                            claim the highest-priority pending row
  scripts/tracker.sh claim <id> <who>                      pending -> working
  scripts/tracker.sh set <id> <status> <who> [--commit sha] [--note "text"] [--force]
  scripts/tracker.sh release <id> <who> [--note "text"] [--force]     working -> pending
  scripts/tracker.sh verify <id> <who> <pass|fail> [--note "what was checked"]
  scripts/tracker.sh log <id> <who> --note "text"          add a Log line without changing the row
  scripts/tracker.sh show <id>                             the row + its plan path + its Log lines
  scripts/tracker.sh add <id> <priority> "<title>" [plan-path] [--client "#26"]
Statuses: pending, working, worked, committed, deployed, blocked, no-issue
Priorities: High, Normal, Low
EOF
  exit 1
}

die() { echo "tracker: $*" >&2; exit 1; }

[ -f "$FILE" ] || die "no board at $FILE"

norm_status() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    pending) echo "pending" ;;
    working) echo "working" ;;
    worked) echo "worked" ;;
    committed|commit) echo "committed" ;;
    deployed) echo "deployed" ;;
    blocked) echo "blocked" ;;
    no-issue|no_issue|"no issue") echo "no-issue" ;;
    *) die "unknown status '$1' (pending, working, worked, committed, deployed, blocked, no-issue)" ;;
  esac
}

lock() {
  local tries=0
  until mkdir "$LOCK" 2>/dev/null; do
    # A lock older than a minute is left over from a crashed run.
    if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +1 2>/dev/null)" ]; then
      rmdir "$LOCK" 2>/dev/null || true
      continue
    fi
    tries=$((tries + 1))
    [ "$tries" -gt 100 ] && die "board is locked ($LOCK). Try again."
    sleep 0.1
  done
  trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT
}

# Rows are lines starting with "| T<digits> |". Columns are found by their header name.
ROW_RE='^\| *T[0-9]+ *\|'
AWK_COLS='
  function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
  /^\| *ID *\|/ { for (i = 2; i < NF; i++) col[trim($i)] = i }
'

norm_id() {
  local id; id="$(echo "$1" | tr '[:lower:]' '[:upper:]')"
  case "$id" in T*) ;; *) id="T$id" ;; esac
  # T1 -> T01
  local n="${id#T}"; [ "${#n}" -eq 1 ] && id="T0$n"
  echo "$id"
}

field() {
  ID="$1" COL="$2" RE="$ROW_RE" awk -F'|' "$AWK_COLS"'
    $0 ~ ENVIRON["RE"] && trim($2) == ENVIRON["ID"] {
      if (ENVIRON["COL"] in col) print trim($(col[ENVIRON["COL"]])); exit
    }
  ' "$FILE"
}

exists() { [ -n "$(field "$1" Status)" ]; }

now() { TZ="${TRACKER_TZ:-Asia/Karachi}" date '+%Y-%m-%d %H:%M'; }

# set_cells <id> NAME=value ...: rewrites the named cells of one row and stamps Updated.
set_cells() {
  local id="$1" tmp; shift
  tmp="$(mktemp "$ROOT/.tracker.XXXXXX")"
  ID="$id" UP="$(now)" RE="$ROW_RE" PAIRS="$(printf '%s\n' "$@")" awk -F'|' -v OFS='|' "$AWK_COLS"'
    BEGIN { n = split(ENVIRON["PAIRS"], kv, "\n")
            for (k = 1; k <= n; k++) { p = index(kv[k], "="); if (p) want[substr(kv[k], 1, p - 1)] = substr(kv[k], p + 1) } }
    $0 ~ ENVIRON["RE"] && trim($2) == ENVIRON["ID"] {
      for (name in want) if (name in col) $(col[name]) = " " want[name] " "
      if ("Updated" in col) $(col["Updated"]) = " " ENVIRON["UP"] " "
    }
    { print }
  ' "$FILE" > "$tmp"
  mv "$tmp" "$FILE"
}

log() { printf -- '- %s · %s\n' "$(now)" "$*" >> "$FILE"; }

parse_opts() {
  COMMIT_OPT="" NOTE_OPT="" FORCE=0 CLIENT_OPT=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --commit) COMMIT_OPT="${2:-}"; shift 2 ;;
      --note) NOTE_OPT="${2:-}"; shift 2 ;;
      --client) CLIENT_OPT="${2:-}"; shift 2 ;;
      --force) FORCE=1; shift ;;
      *) die "unknown option '$1'" ;;
    esac
  done
  case "$NOTE_OPT$COMMIT_OPT$CLIENT_OPT" in *"|"*) die "notes cannot contain '|'" ;; esac
  case "$NOTE_OPT" in *$'\n'*) die "notes must be one line" ;; esac
}

# transition <id> <new-status> <who>: checks ownership, writes, logs.
transition() {
  local id="$1" new="$2" who="$3" cur owner note=""
  cur="$(field "$id" Status)"
  owner="$(field "$id" Owner)"
  if [ "$cur" = "working" ] && [ "$owner" != "$who" ] && [ "$FORCE" -ne 1 ]; then
    die "$id is being worked on by '$owner' (since $(field "$id" Updated)). Pick another, or use --force if it is abandoned (read the Log first)."
  fi
  local new_owner="$who"
  [ "$new" = "pending" ] && new_owner="—"
  if [ -n "$COMMIT_OPT" ]; then set_cells "$id" "Status=$new" "Owner=$new_owner" "Commit=$COMMIT_OPT"
  else set_cells "$id" "Status=$new" "Owner=$new_owner"; fi
  [ -n "$COMMIT_OPT" ] && note=" · commit $COMMIT_OPT"
  [ -n "$NOTE_OPT" ] && note="$note · $NOTE_OPT"
  [ "$FORCE" -eq 1 ] && [ "$cur" = "working" ] && [ "$owner" != "$who" ] && note="$note · forced (was $owner)"
  log "$id · $cur → $new · by $who$note"
  echo "$id: $cur → $new ($who)"
}

claim() {
  local id="$1" who="$2" cur
  cur="$(field "$id" Status)"
  [ "$cur" = "pending" ] || die "$id is '$cur' (owner: $(field "$id" Owner)). Only pending rows can be claimed."
  transition "$id" "working" "$who"
  echo "Plan: $(field "$id" Plan)"
}

cmd="${1:-}"; [ -n "$cmd" ] || usage; shift

case "$cmd" in
  list)
    want=""
    [ $# -gt 0 ] && want="$(norm_status "$1")"
    WANT="$want" RE="$ROW_RE" awk -F'|' "$AWK_COLS"'
      function c(name) { return (name in col) ? trim($(col[name])) : "" }
      $0 ~ ENVIRON["RE"] {
        if (ENVIRON["WANT"] != "" && c("Status") != ENVIRON["WANT"]) next
        printf "%-4s %-7s %-10s %-14s %-17s %-10s %-14s %s\n", c("ID"), c("Priority"), c("Status"), c("Owner"), c("Updated"), c("Commit"), c("Verified"), c("Title")
      }
    ' "$FILE"
    ;;
  show)
    [ $# -ge 1 ] || usage
    id="$(norm_id "$1")"; exists "$id" || die "no row $id"
    grep -E "^\| *$id *\|" "$FILE"
    echo "Plan: $(field "$id" Plan)"
    echo "Log:"; grep -E "^- .* · $id · " "$FILE" || echo "  (none)"
    ;;
  claim)
    [ $# -ge 2 ] || usage
    id="$(norm_id "$1")" who="$2"; shift 2; parse_opts "$@"
    lock; exists "$id" || die "no row $id"; claim "$id" "$who"
    ;;
  next)
    [ $# -ge 1 ] || usage
    who="$1"; shift; parse_opts "$@"
    lock
    id="$(RE="$ROW_RE" awk -F'|' "$AWK_COLS"'
      $0 ~ ENVIRON["RE"] && trim($(col["Status"])) == "pending" {
        p = tolower(trim($(col["Priority"]))); r = (p == "high") ? 1 : (p == "normal") ? 2 : 3
        printf "%d %06d %s\n", r, NR, trim($2)
      }' "$FILE" | sort | head -1 | awk '{print $3}')"
    [ -n "$id" ] || die "nothing is pending"
    claim "$id" "$who"
    ;;
  set)
    [ $# -ge 3 ] || usage
    id="$(norm_id "$1")" st="$(norm_status "$2")" who="$3"; shift 3; parse_opts "$@"
    lock; exists "$id" || die "no row $id"
    if [ "$st" = "working" ] && [ "$(field "$id" Status)" = "pending" ]; then claim "$id" "$who"
    else transition "$id" "$st" "$who"; fi
    ;;
  release)
    [ $# -ge 2 ] || usage
    id="$(norm_id "$1")" who="$2"; shift 2; parse_opts "$@"
    lock; exists "$id" || die "no row $id"; transition "$id" "pending" "$who"
    ;;
  verify)
    [ $# -ge 3 ] || usage
    id="$(norm_id "$1")" who="$2" result="$(echo "$3" | tr '[:upper:]' '[:lower:]')"; shift 3; parse_opts "$@"
    case "$result" in pass|fail) ;; *) die "verify result must be pass or fail" ;; esac
    lock; exists "$id" || die "no row $id"
    set_cells "$id" "Verified=$result $(TZ="${TRACKER_TZ:-Asia/Karachi}" date '+%m-%d %H:%M')"
    log "$id · verify $result · by $who${NOTE_OPT:+ · $NOTE_OPT}"
    echo "$id: verify $result ($who)"
    ;;
  log)
    [ $# -ge 2 ] || usage
    id="$(norm_id "$1")" who="$2"; shift 2; parse_opts "$@"
    [ -n "$NOTE_OPT" ] || die "log needs --note"
    lock; exists "$id" || die "no row $id"
    log "$id · note · by $who · $NOTE_OPT"
    echo "$id: logged"
    ;;
  add)
    [ $# -ge 3 ] || usage
    id="$(norm_id "$1")" pri="$2" title="$3"; shift 3
    plan="—"; if [ $# -gt 0 ] && [ "${1#--}" = "$1" ]; then plan="$1"; shift; fi
    parse_opts "$@"
    case "$title$plan" in *"|"*) die "title and plan cannot contain '|'" ;; esac
    lock
    exists "$id" && die "$id is already on the board"
    tmp="$(mktemp "$ROOT/.tracker.XXXXXX")"
    ID="$id" PRI="$pri" TITLE="$title" PLAN="$plan" CLIENT="${CLIENT_OPT:-—}" UP="$(now)" RE="$ROW_RE" awk -F'|' '
      function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
      { lines[NR] = $0 }
      /^\| *ID *\|/ { header = NR; row = "|"
        for (i = 2; i < NF; i++) {
          name = trim($i)
          v = (name == "ID") ? ENVIRON["ID"] : (name == "Priority") ? ENVIRON["PRI"] : (name == "Status") ? "pending" : \
              (name == "Updated") ? ENVIRON["UP"] : (name == "Title") ? ENVIRON["TITLE"] : (name == "Plan") ? ENVIRON["PLAN"] : \
              (name == "Client #") ? ENVIRON["CLIENT"] : "—"
          row = row " " v " |"
        } }
      $0 ~ ENVIRON["RE"] { last = NR }
      END {
        if (!last) last = header + 1
        for (i = 1; i <= NR; i++) { print lines[i]; if (i == last) print row }
      }
    ' "$FILE" > "$tmp"
    mv "$tmp" "$FILE"
    log "$id · added as pending ($pri) · $title"
    echo "$id added"
    ;;
  *) usage ;;
esac
