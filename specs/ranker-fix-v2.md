# MLB GEMATRIA RANKER — V2 FIXES

## Applied: May 27, 2026

-----

## FIX 1: ADD TOTAL BASES (TB) AS TRACKED STAT

TB joins SO, H, HR, 2B, BB as a tracked milestone stat for every batter.

**Pre-game data pull must include:**

- Season TB entering today
- Career TB entering today

**TB milestone staircase:** Run +1 through +4 (same as other stats)

- Single = +1 TB
- Double = +2 TB
- Triple = +3 TB
- HR = +4 TB

**Why it matters:** TB milestones catch XBH energy that individual stat lines miss. A batter 1 TB from landing on 72 (Jesuit Order RR) could get there via single, double, or HR — three different paths to the same number.

-----

## FIX 2: BB ALWAYS SHOWN — NEVER BURIED

**Old behavior:** BB milestones ranked by hit count alongside K/H/HR/2B. Low-scoring BB milestones dropped off top 5.

**New behavior:** BB gets its OWN dedicated line in every batter output, regardless of score. Format:

```
🚶 BB WATCH: BB+1 → s__/c__ = [connections]
```

**Rule:** If BB+1 connects to ANY of these, it gets elevated to primary call territory:

- Today’s date values
- Active game thread numbers
- Opponent team gematria
- Stadium gematria
- Masonic/institutional core values (42, 48, 51, 72, 96, etc.)

**Never say “his BB milestones aren’t in the top 5” as a reason to skip them.** A walk is a real outcome that happens in ~10% of PAs. It must always be evaluated.

-----

## FIX 3: ACTIVE THREAD CROSS-REFERENCING

**Concept:** The ranker scores milestones by QUANTITY of connections. But a 2-hit milestone that connects to a number that’s been firing across multiple games today is MORE valuable than a 4-hit milestone connecting to generic primes.

**Implementation — 3-layer scoring:**

### Layer 1: Base Score (existing ranker)

Count of direct connections to tables, primes, composites, date values, teams, stadium.

### Layer 2: Active Thread Bonus (+2 per match)

Before each game, identify the “active thread” — numbers that have confirmed across earlier games today. Examples from 5/27/26:

- 72 (Jesuit Order RR) — confirmed by Pérez K staircase
- 51 (Freemason SR) — confirmed by Pérez game number
- 44 (Wednesday RR) — confirmed by No Hitter RR
- 60 (date value) — confirmed by Pérez career K prime chain
- 38 (stadium lat min) — confirmed by Pérez pitch count
- 147 (Rogers Centre) — confirmed as Day of Year

If a batter milestone lands on ANY active thread number, add +2 to its score.

### Layer 3: Batter Rank Override

The ranker assigns a TOP SCORE rank to each batter (#1, #2, etc.).

**NEW RULE:** The #1 ranked batter in any game is ALWAYS flagged as the primary threat, regardless of which specific milestone is highest. The rank IS the warning.

If the #1 ranked batter is coming up, the call must acknowledge: “This is the top-ranked bat — if [primary outcome] doesn’t hit, he’s still the most dangerous hitter on the board.”

-----

## FIX 4: NO MORE K-DEFAULT BIAS

**Old behavior:** When a pitcher is dominant (high K rate, clean outing), default every batter to K.

**New behavior:** The pitcher’s dominance does NOT override batter milestone scores.

**Decision tree:**

1. Check batter’s TOP milestone across ALL categories (K, H, HR, 2B, BB, TB)
1. If the top milestone is a HIT/2B/HR/BB at score 4+, that’s the PRIMARY call — even if the pitcher has 10 Ks
1. K is the primary call ONLY when:
- The batter’s K milestone score > all other categories, OR
- The batter has already struck out 2+ times today, OR
- The batter’s other milestones are all at score ≤2
1. When it’s genuinely close (e.g., K at 4 hits, H at 4 hits), give BOTH calls with the lean, don’t pick one and bury the other

-----

## FIX 5: ROOKIE/MIRRORED STAT AMPLIFICATION

When a batter’s season and career stats are IDENTICAL (rookies, or anyone with <2 seasons of data), every milestone automatically doubles because season and career land on the same number.

**Old behavior:** Treated as noise / inflated scores.

**New behavior:** Flag these batters as WILDCARDS. Their doubled connections mean ANY outcome is amplified. They’re unpredictable and should never be dismissed.

Format:

```
⚡ WILDCARD — Rookie/mirrored stats. Every outcome is amplified.
```

-----

## FIX 6: WALK MILESTONE FOR PITCHERS

Track pitcher BB milestones and CALL them. A walk is an actionable event — it affects run scoring, base states, and live betting lines.

When a pitcher is approaching a loaded BB milestone, flag it:

```
⚠️ BB ALERT: [Pitcher] BB+1 → s__/c__ = [connections]
```

This tells the user: “a walk here is gematria-backed” — which can mean lean BB in the batter call, or at minimum don’t be surprised by it.

-----

## UPDATED BATTER OUTPUT FORMAT

```
🔥 #1 [Name] ([Team]) — TOP SCORE: X
   Entering: SO __/__ H __/__ HR __/__ 2B __/__ BB __/__ TB __/__
   
   [Top 5 milestones by ADJUSTED score (base + thread bonus)]
   
   🚶 BB WATCH: BB+1 → s__/c__ = [connections]
   📊 TB WATCH: TB+1 → s__/c__ = [connections]
   
   ⚡ WILDCARD (if rookie/mirrored)
   🔥 THREAD MATCH: [milestone] connects to active thread [number]
```

-----

## LIVE GAME CALL FORMAT (UPDATED)

When user asks “who’s next” or “give me the call”:

```
**[Name] — [PRIMARY CALL]**
- Primary: [stat]+[n] → s__/c__ = [score] hits ([key connections])
- Alt: [stat]+[n] → s__/c__ = [score] hits ([key connections])  
- BB watch: BB+[n] → [connections if relevant]
- Thread match: [yes/no — which active number]
```

**Always give primary AND alternative.** Never give just one call without acknowledging the other side.

-----

## FIX 7: MANDATORY GAME LOAD PROTOCOL

**Before going live on ANY game, Claude MUST:**

1. Read the ENTIRE game section from the pre-game file — every pitcher, every batter, every multi-K candidate
1. Post a confirmation: “[X]/[X] batters loaded, [X] pitchers loaded, [X] multi-K candidates loaded”
1. If Claude cannot confirm all batters are loaded, Claude must say so and finish loading before making any calls

**If Claude gives a call on a batter it hasn’t loaded, the call is INVALID.**

No more “he scored below the top 20” or “his milestones weren’t in the ranked list.” Every batter in the file has data. Read all of it.

-----

## FIX 8: MANDATORY LIVE AB PROTOCOL

**Every time the user sends a live screenshot or says who’s batting, Claude MUST follow this exact format. If any step is skipped, the call is INVALID. Redo.**

```
[BATTER NAME] — [current game line from screenshot]
ENTERING: SO __/__ H __/__ HR __/__ 2B __/__ BB __/__
UPDATED: SO __/__ H __/__ HR __/__ 2B __/__ BB __/__
NEXT K  → s__/c__ = [connections] | Thread: Y/N
NEXT H  → s__/c__ = [connections] | Thread: Y/N
NEXT HR → s__/c__ = [connections] | Thread: Y/N
NEXT 2B → s__/c__ = [connections] | Thread: Y/N
NEXT BB → s__/c__ = [connections] | Thread: Y/N
CALL: [primary] — [1 line reason]
ALT: [secondary] — [1 line reason]
```

**Rules:**

- ENTERING = from pre-game file
- UPDATED = entering + what happened in today’s game (read from screenshot)
- NEXT = the NEXT occurrence of each stat, calculated from UPDATED numbers
- Thread = does this number match today’s active thread (list the thread numbers at top of session)
- EVERY category shown. No skipping BB. No skipping 2B.
- Show the work so user can verify

**Speed version (when user needs it in 5 seconds):**

```
[NAME] NOW: K→s__=[match] H→s__=[match] BB→s__=[match]
CALL: [outcome]
```

Even the speed version must use UPDATED numbers, not entering.

-----

## FIX 9: LIVE STAT TRACKING FROM SCREENSHOTS

**When user sends a screenshot showing current game stats, Claude MUST:**

1. Read EVERY batter’s line: H/AB, SO, BB, HR, XBH, R
1. Update their milestone positions based on what happened
1. Store these updated numbers for the rest of the game
1. Never refer back to entering stats as if nothing changed

**Example:**

- Pre-game file: Heim entering SO 12/434
- Screenshot shows: Heim 0/2, 1 SO today
- UPDATED: SO 13/435
- Next K: s14/c436 (NOT s13/c435)

**If Claude makes a call using entering stats when updated stats are available from a screenshot, the call is INVALID.**

-----

## FIX 10: NO FILLER RULE

**During live game tracking:**

- No celebrating past calls longer than 1 line
- No explaining methodology unless asked
- No stacking multiple batters ahead — ONE batter at a time
- No “the whole outing is a masterpiece” type commentary
- Confirmation of result + immediate prep for next AB

**Format after a result:**

```
[RESULT] ✅/❌ — [1 line connection if it hit]
[NEXT BATTER] — [call using mandatory protocol]
```

That’s it. Move forward, not backward.

-----

## FIX 11: ACTIVE THREAD DECLARATION

**At the start of every live session, Claude must declare the active thread:**

```
TODAY'S ACTIVE THREAD: [list numbers confirmed across games]
```

**Update the thread as games progress.** When a number confirms in a new game, add it. This list is referenced in every NEXT milestone check (Thread: Y/N).

Example:

```
ACTIVE THREAD (updated 3:30 PM):
72 = Jesuit Order RR (Pérez, May, Gilbert)
51 = Freemason SR (Pérez game #, May K count)
44 = Wednesday RR (No Hitter RR, date)
60 = Date value (Pérez career K chain)
63 = Jesuit Order SR (Gilbert entering K, Padres Ord)
54 = Jesuit Order Red = Baseball (May K+12 target)
```

-----

## FIX 12: RANKER MUST OUTPUT ALL BATTERS — NO SCORE CUTOFF

**The ranker script currently only outputs batters who score above a threshold in the ranked section.** This means batters like Realmuto, Turner, and Schwarber can be fetched but never appear in the main output — making them invisible during live play.

**New rule: The ranker MUST output the full milestone card for EVERY batter it fetches, regardless of score.**

Format for ALL batters (even score 0):

```
  #[rank] [Name] ([Team]) — TOP SCORE: [X]
     Entering: SO __/__ H __/__ HR __/__ 2B __/__ BB __/__ TB __/__
     [Top 5 milestones, or "No milestones above threshold" if none]
     🚶 BB WATCH: BB+1 → s__/c__ = [connections]
```

**Why this matters:**

- Turner’s K+1 → s54 = JESUIT ORDER Red was one of the strongest thread connections in the game. Invisible in the ranked output.
- Realmuto’s K+1/+2/+3 = 22/23/24 = DATE/STADIUM/DATE triple chain. Invisible.
- Schwarber’s K+1 → s79 = San Diego Padres RR. Invisible.
- Every batter that gets fetched MUST show their entering stats at minimum, so live recalculations are possible.

**The ranker output is the ONLY source of entering stats during live play.** If a batter isn’t in the output, Claude has no numbers to work with and has to scramble mid-AB. That defeats the entire purpose of pre-game data compilation.

**Script change required:**

- Remove any `if score < threshold: skip` logic from batter output
- Print ALL fetched batters in ranked order, even if score = 0
- Always include the full entering stat line (SO/H/HR/2B/BB/TB season and career)
- Always include BB+1 milestone regardless of score
- Multi-K section stays as-is (only loaded K chains)

-----

## FIX 13: WNBA/NBA FIRST BASKET PROTOCOL

**When the user sends a first basket prop board, Claude MUST run the full scan on EVERY player listed. No cherry-picking, no skipping ciphers.**

### Step 1: Run ALL 4 ciphers on EVERY name component

For each player on the board, calculate:

- First name: Ord, Red, Rev, RR
- Last name: Ord, Red, Rev, RR
- Full name: Ord, Red, Rev, RR

That’s 12 values per player. No shortcuts.

### Step 2: Cross-reference against today’s active numbers

Check all 12 values against:

- Today’s date values (all calculations)
- Day name gematria (all 4 ciphers)
- Active thread numbers confirmed across today’s games
- Core Masonic/institutional table (42, 48, 51, 54, 56, 59, 63, 65, 72, 75, 78, 79, 83, 96, etc.)

### Step 3: Cross-reference against active MLB/sports players

If the user asks “does anyone match [MLB player],” run all 4 ciphers of that player’s first AND last name, then check EVERY WNBA player’s 12 values against them.

**Example from 5/27/26:**

- Buxton = Ord 96, Red 24
- Nia = Ord 24 (matches Buxton Red), Rev 57 (matches Mayer Red), RR 22 (matches Falefa Red)
- These were in Rev and RR — the ciphers that get skipped when being lazy

### Step 4: Check venue gematria

Run all 4 ciphers on the arena name. Cross-reference with active thread.

### Step 5: Check shot type gematria (if applicable)

If the user asks about a specific scoring method (3-pointer, layup, FT):

- Run gematria on the shot type name
- Cross-reference with active thread

### Step 6: Career stat milestones

If the user provides basketball-reference stats, check career totals for:

- PTS, FG, 3P, FT, REB, AST, STL, BLK at next event
- Season totals at next event
- Flag any that land on active thread numbers or institutional values

### Mandatory output format for first basket scan:

```
[NAME] (+odds)
  First: Ord=__ Red=__ Rev=__ RR=__
  Last:  Ord=__ Red=__ Rev=__ RR=__
  Full:  Ord=__ Red=__ Rev=__ RR=__
  MATCHES: [list all institutional/date/thread/cross-sport hits]
  MLB BRIDGE: [which MLB player(s) connect and through which cipher]
```

**If Claude gives a first basket recommendation without showing all 12 values, the call is INVALID.**

**Speed version (when time is critical):**

```
[NAME] (+odds) — [First] [matches] / [Last] [matches] / [Full] [matches]
MLB: [bridge if any]
```

Even the speed version must check all 4 ciphers. Just compress the output.

### Key rules:

- NEVER skip Rev and RR on first names — this is where hidden connections live
- NEVER recommend without scanning ALL players on the board
- If 10 players are listed, 10 players get scanned — not “top 5 look interesting”
- Low-odds favorites can still have the strongest gematria — don’t ignore them for value
- Cross-sport bridges (MLB → WNBA) through shared numbers are HIGH-WEIGHT signals

-----

## LESSONS LEARNED — MAY 27, 2026

1. **Mitchell (MIL):** #1 ranked batter broke up no-hitter. Lesson: respect the rank above all else.
1. **Emerson (SEA):** Rookie with mirrored stats hit 2-run triple. Lesson: wildcards are volatile, not dead.
1. **Cortes (ATH):** Walk connected to DATE value 22. Lesson: BB milestones matter even at low scores.
1. **Soderstrom (ATH):** Walk not in top 5 but still happened. Lesson: always scan BB.
1. **Langeliers (ATH):** Called K, singled. Lesson: pitcher dominance ≠ every batter strikes out.
1. **Gelof (ATH):** H+1 → Freemason RR = active thread. Called it right using thread matching. Lesson: the new approach works.
1. **Nia Coffey (MIN):** First name Ord=24=Buxton Red, Rev=57=Mayer Red, RR=22=Falefa Red. Triple MLB bridge hiding in Rev and RR. Lesson: NEVER skip Rev and RR on first names.
1. **Azura Stevens (TOR Tempo):** FT for first basket, career FT = 276 = Pérez entering career K. Cross-sport bridge through Toronto. Lesson: city/venue connections carry across sports.
1. **Rhyne Howard (ATL):** Full name Ord=139=Freemasonry Ord, Red=67=Freemasonry SR, RR=51=Freemason SR. Triple Masonic in one name. Lesson: run ALL ciphers on FULL name, not just last name.