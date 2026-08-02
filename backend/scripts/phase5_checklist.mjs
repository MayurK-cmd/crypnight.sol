// PHASE 5 §Verification — automated harness
//
// Boots no server of its own. Assumes `node index.js` is running on PORT.
// Reads `source/lichess_puzzles.csv` from disk to drive puzzle solutions
// (so the harness is self-contained — no need to peek at the backend's
// in-memory cache).
//
// Output: 14 checks with pass/fail markers, then a summary line. Exit
// code = number of failed checks (capped at 101).
//
// Usage from backend/:
//   node scripts/phase5_checklist.mjs

import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'csv-parse/sync';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(__dirname, '..', '..', 'source', 'lichess_puzzles.csv');

const BASE = `http://localhost:${process.env.PORT || 5000}`;
const RESULTS = [];
let failed = 0;

const record = (id, label, passed, detail = '') => {
  RESULTS.push({ id, label, passed: Boolean(passed), detail });
  if (!passed) failed++;
  const tag = passed ? '✅' : '❌';
  console.log(`[${tag}] ${id.padEnd(4)} ${label}${detail ? '  — ' + detail : ''}`);
};

const fetchJson = async (url, opts = {}, timeoutMs = 8000) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const setCookie = res.headers.get('set-cookie') || '';
    const ct = res.headers.get('content-type') || '';
    let body = null;
    if (ct.includes('application/json')) body = await res.json();
    else body = await res.text();
    return { status: res.status, headers: res.headers, body, setCookie };
  } finally {
    clearTimeout(t);
  }
};

const post = (path, body, cookie = '') =>
  fetchJson(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });

const get = (path, cookie = '') =>
  fetchJson(`${BASE}${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });

// Load the CSV so the harness can drive puzzle solutions by puzzle_id.
const csvText = await readFile(CSV_PATH, 'utf-8');
const csvRows = parse(csvText, { columns: true, skip_empty_lines: true });
const puzzleMap = new Map();
for (const row of csvRows) {
  const id = row.puzzle_id || row.PuzzleId || row.id;
  if (id) puzzleMap.set(id, row);
}
record('0', 'CSV loaded for harness', puzzleMap.size > 0, `${puzzleMap.size} puzzles`);

// ---- SETUP: signup, login, set tier ----
const stamp = Date.now();
const email = `phase5+${stamp}@example.com`;
const username = `phase5_${stamp}`;
const password = 'Str0ng!Pass1';

let cookie = '';
{
  const { status, setCookie } = await post('/api/auth/signup', { email, password, username });
  if (setCookie) cookie = setCookie.split(';')[0];
  record('1a', 'Signup -> 201', status === 201, `status=${status}`);
}

{
  // Set tier. We need an internal flag bypass for the harness — the
  // production flow requires wallet linking. For the harness we hit
  // set-tier directly; if your deployment requires wallet, the harness
  // will surface a 403 and you can run this against a test user.
  const { status, body } = await post('/api/user/set-tier', { tier: 'intermediate' }, cookie);
  record('1b', 'Set tier intermediate', status === 200,
    `status=${status}, body=${JSON.stringify(body)?.slice(0, 80)}`);
  if (status !== 200) {
    console.log('Cannot continue without tier; ensure /user/set-tier is reachable.');
    process.exit(1);
  }
}

// ---- CHECK 2: /puzzle does NOT leak solution ----
let firstPuzzle = null;
let firstSession = null;
{
  const { status, body } = await get('/api/puzzle', cookie);
  const p = body?.puzzle;
  record('2a', 'GET /puzzle -> 200', status === 200, `status=${status}`);
  if (p) {
    const hasSolution = 'moves' in p || 'Moves' in p || 'solution' in p;
    record('2b', 'Puzzle response does NOT include solution', !hasSolution,
      hasSolution ? 'FOUND solution key' : 'no moves/Moves/solution in payload');
    record('2c', 'Puzzle has puzzle_id + fen + rating', !!(p.puzzle_id || p.PuzzleId) && !!p.fen,
      `puzzle_id=${p.puzzle_id || p.PuzzleId}, has_fen=${!!p.fen}`);
    firstPuzzle = p;
    firstSession = body?.session_id;
    record('2d', 'Puzzle response carries session_id', !!firstSession,
      `session_id=${firstSession}`);
  }
}

// Helper: read the next expected move for a given puzzle_id from the
// local CSV copy. The CSV is space-separated UCI moves.
const getNextMove = (puzzleId, idx) => {
  const row = puzzleMap.get(puzzleId);
  if (!row) return null;
  const seq = (row.Moves || row.moves || '').split(' ').filter(Boolean);
  return seq[idx] || null;
};

// ---- CHECK 3: /solo/start resumes the active session ----
{
  const { status, body } = await post('/api/solo/start', {}, cookie);
  record('3a', 'POST /solo/start -> 200', status === 200, `status=${status}`);
  record('3b', '/solo/start returns resumed=true (active session existed)',
    body?.resumed === true, `resumed=${body?.resumed}`);
  record('3c', 'Returned session_id matches /puzzle session_id',
    body?.session_id === firstSession,
    `start=${body?.session_id}, puzzle=${firstSession}`);
}

// ---- CHECK 4: 1 wrong move fails the puzzle, session continues ----
{
  const wrongMove = 'a1a1'; // always wrong
  const res1 = await post('/api/solo/move', { session_id: firstSession, move: wrongMove }, cookie);
  record('4a', 'STRICT: 1st wrong move -> puzzle_failed:true, session_continues:true',
    res1.body?.correct === false && res1.body?.puzzle_failed === true && res1.body?.session_continues === true,
    JSON.stringify(res1.body).slice(0, 140));
  record('4b', 'After fail: puzzles_failed=1, puzzles_in_session=1, lives_remaining=2',
    res1.body?.puzzles_failed === 1
      && res1.body?.puzzles_in_session === 1
      && res1.body?.lives_remaining === 2,
    `puzzles_failed=${res1.body?.puzzles_failed}, `
    + `puzzles_in_session=${res1.body?.puzzles_in_session}, `
    + `lives_remaining=${res1.body?.lives_remaining}`);
}

// ---- CHECK 4c: 3 puzzle-fails in the run ends the session ----
{
  // We need 2 more puzzle-fails. Drive 2 more wrong moves on subsequent
  // puzzles to hit the 3-fail cap and trigger session_complete.
  // First, refresh /puzzle to start a fresh puzzle for fail #2.
  await get('/api/puzzle', cookie);
  const res2 = await post('/api/solo/move', { session_id: firstSession, move: 'a1a1' }, cookie);
  record('4c-1', '2nd puzzle-fail -> puzzles_failed=2, lives_remaining=1, session_continues',
    res2.body?.puzzles_failed === 2
      && res2.body?.lives_remaining === 1
      && res2.body?.session_continues === true,
    JSON.stringify(res2.body).slice(0, 140));

  // And one more fail to hit the cap.
  await get('/api/puzzle', cookie);
  const res3 = await post('/api/solo/move', { session_id: firstSession, move: 'a1a1' }, cookie);
  record('4c-2', '3rd puzzle-fail -> session_complete:true, session_end_reason=fail_cap',
    res3.body?.session_complete === true
      && res3.body?.session_end_reason === 'fail_cap'
      && res3.body?.puzzles_failed === 3,
    JSON.stringify(res3.body).slice(0, 160));
}

// ---- CHECK 5: next /puzzle starts a fresh session (run was ended by fail_cap) ----
{
  const { status, body } = await get('/api/puzzle', cookie);
  record('5a', 'GET /puzzle after fail_cap -> 200', status === 200);
  // After fail_cap, the next /puzzle should open a NEW session because
  // the previous one is closed. session_resumed must be false and
  // session_id must differ from firstSession.
  record('5b', 'Fresh session opens (session_resumed=false)',
    body?.session_resumed === false,
    `session_resumed=${body?.session_resumed}`);
  record('5c', 'Fresh session has a different puzzle_id',
    body?.puzzle?.puzzle_id !== firstPuzzle?.puzzle_id,
    `prev=${firstPuzzle?.puzzle_id}, new=${body?.puzzle?.puzzle_id}`);
  nextPuzzle = body?.puzzle;
  nextSession = body?.session_id;
}

// ---- CHECK 6: solve the new puzzle and verify counters ----
{
  const pid = nextPuzzle.puzzle_id || nextPuzzle.PuzzleId;
  const row = puzzleMap.get(pid);
  const moves = (row?.Moves || row?.moves || '').split(' ').filter(Boolean);
  // Play all user moves (every other SAN — but here the CSV is UCI).
  // The puzzle controller takes `from + to` (UCI). The first move
  // belongs to the opponent (it's the starting position to play from)
  // so the user plays move[1], then the opponent replies with move[2],
  // etc. We send move[1], move[3], move[5]... until finished.
  const userMoves = moves.filter((_, i) => i % 2 === 1);
  let lastMove = null;
  for (const m of userMoves) {
    const { body } = await post('/api/solo/move', { session_id: nextSession, move: m }, cookie);
    if (body?.finished) { lastMove = body; break; }
  }
  record('6a', 'Final move -> correct:true, finished:true',
    lastMove?.correct === true && lastMove?.finished === true,
    JSON.stringify(lastMove).slice(0, 100));

  // Submit to claim reward.
  const { body: submitBody } = await post('/api/solo/submit', { session_id: nextSession }, cookie);
  record('6b', 'Submit -> reward > 0',
    submitBody?.reward > 0, `reward=${submitBody?.reward}`);
  record('6c', 'Submit -> puzzles_solved=1, puzzles_in_session=2',
    submitBody?.puzzles_solved === 1 && submitBody?.puzzles_in_session === 2,
    `p_solved=${submitBody?.puzzles_solved}, in_session=${submitBody?.puzzles_in_session}`);
  record('6d', 'Submit -> session_continues=true (1 of 10 done)',
    submitBody?.session_continues === true && submitBody?.session_complete === false,
    `continues=${submitBody?.session_continues}, complete=${submitBody?.session_complete}`);
}

// ---- CHECK 7: explicit /solo/end works ----
{
  const { status, body } = await post('/api/solo/end', { session_id: nextSession }, cookie);
  record('7a', 'POST /solo/end -> 200', status === 200, `status=${status}`);
  record('7b', '/solo/end returns session_complete=true',
    body?.session_complete === true, `complete=${body?.session_complete}`);
  record('7c', '/solo/end returns new_rating + delta',
    typeof body?.new_rating === 'number' && typeof body?.session_rating_delta === 'number',
    `new_rating=${body?.new_rating}, delta=${body?.session_rating_delta}`);
}

// ---- CHECK 8: /api/history reflects the fail_cap'd run ----
{
  const { status, body } = await get('/api/history?page=1&limit=5', cookie);
  const rows = body?.history || [];
  record('8a', 'GET /api/history -> 200', status === 200);
  const row = rows.find((r) => r.id === firstSession);
  record('8b', 'History contains the fail_cap run we just ended',
    !!row, `rows=${rows.length}, found=${!!row}`);
  if (row) {
    record('8c', 'History row: puzzles_failed=3, status=solved',
      row.puzzles_failed === 3 && row.status === 'solved',
      `p_failed=${row.puzzles_failed}, status=${row.status}`);
    record('8d', 'History row: reward_amount = total_session_reward',
      Number(row.reward_amount) === Number(row.total_session_reward),
      `reward_amount=${row.reward_amount}, total=${row.total_session_reward}`);
  }
}

// ---- Summary ----
console.log('\n----- SUMMARY -----');
console.log(`${RESULTS.length - failed}/${RESULTS.length} checks passed.`);
const failedIds = RESULTS.filter(r => !r.passed).map(r => r.id);
console.log('Failed IDs:', failedIds.join(', ') || '(none)');
process.exit(Math.min(failed, 101));
