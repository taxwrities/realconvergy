# DECODE-CHAT.md — Per-Game AI Decode Chat

Status: DRAFT v1 — 2026-08-06. Do not build until open questions are answered.

## Purpose

A chat panel attached to each game card (convergence app + Lovable board) that reads the game's computed data and provides the creative layer the scanners can't: entity/history connections (Truman, Ford, Enola Gay class), span narratives, outcome-selection critique, and post-game grading conversation. Principle: the app computes, the model interprets. No cipher math in the model.

## Context bundle (assembled per game, client-side, sent via proxy)

Order matters — static blocks first for prompt caching:

1. `instructions` (static): house rules digest — landings-predict/parkings-decorate, hook model, skip-gate, card discipline, promotion ladder, no invented cipher values, cite which bundle field every claim comes from.
2. `hubbard_vocab` (static): top ~300 entries of patterns.json by frequency + span conventions (exclusive/inclusive), mirror pairs, prime/composite depth conventions.
3. `theme` (daily): theme JSON — Zach numbers labeled, date numerology, day/planet, active conditional layers.
4. `game` (per game): slice of slates/{date}-landings.json — both rosters with season+career counters, dob, debut, jersey, birthCity/State, drought fields; venue + venueState; probables.
5. `ciphers` (per game, precomputed by gematria-core): 4 core ciphers for every player full name, first name, last name, both team names, venue, city; plus prime/composite index of each value. Model NEVER computes ciphers.
6. `spans` (per game, precomputed): days-after/days-to birthday, days-of-life, career-days, career G+1 with its prime/comp index, for every player.
7. `board` (per game): that game's section of boards/{date}-themed.txt.
8. `convergence` (Lovable variant): serialized convergence objects exactly as rendered — value, hits, domains, source chain, flags. Serializer lives in the Lovable repo (GitHub-synced); JSON, not re-derived.
9. `live` (optional, refreshed): user-pasted plays or box score once available.

## What the model is asked to do

* Pregame: read the field narratively; name marked men; critique outcome selection (e.g. flag when the sibling phrase — Triple vs Double — carries stronger day stamps); propose entity hooks with explicit hook type (date span / geography / theme mention) per ENTITY-MULTIVERSE gating.
* Live: grade pasted plays against bundle counters; 3-line max responses.
* Postgame: honest hit/miss ledger; distinguish predictions from decorations; denominator notes (what didn't land).
* Always: separate verified numbers (from bundle) from narrative speculation, and label which is which.

## Model routing

* Default: `claude-sonnet-4-6`.
* "Deep Decode" button: same bundle → `claude-fable-5`. User-initiated only.
* Nightly graded report job (separate spec GRADED-REPORTS.md): `claude-haiku-4-5`.

## Transport & cost controls

* All calls through Netlify Function proxy (Phase 3 item). API key server-side only.
* Prompt caching ON: blocks 1–2 cached across all games/days; 3 cached across the day's games; 4–8 cached within a session.
* max_tokens cap: 1200 per response (Deep Decode 2500).
* Hard session cap: 30 turns, then require new session.
* Console budget alert recommended (user action).

## UI

* "Decode" button on each game card → slide-over chat. "Deep Decode" toggle inside.
* No ambient/auto calls. Chat fires only on user send.
* Session transcript savable to data/decode-logs/{date}-{gamePk}.md (optional, Q4).

## Non-goals

* No board/date-row/MLB-tool modifications. Additive only.
* No model-side cipher computation, ever.
* No autonomous betting advice framing; entertainment analysis per house framing.

## Open questions (answer before build)

1. One chat per game, or one day-level chat that can reference all games? (Day-level enables cross-game threads like the Masonic current, costs more context.)
2. Should the bundle include the previous day's graded ledger for staircase continuity (Lowe 37→39→40 class reads)? Adds tokens; high value.
3. Entity registry: wait for ENTITY-MULTIVERSE build, or let the model free-recall entities in v1 with hook-type labeling required?
4. Persist transcripts to repo (searchable history) or keep ephemeral?
5. Lovable serializer: expose as a "Copy context" button (manual, zero backend work) or auto-wire into the chat payload (needs Lovable-side code)?
6. Does the convergence app get the same Netlify proxy as the Lovable board, or separate functions per deployment?
