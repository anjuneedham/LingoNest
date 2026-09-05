# 8. Interactive Activity Architecture

## 8.1 The registry

An activity type is a triple: **schema** (what the data looks like) + **evaluator** (how an
answer is graded) + **renderer** (how it is played). The first two live in
`@lingonest/core`; only the renderer is React.

```ts
// packages/core/src/activities/registry.ts
export interface ActivityTypeDef<P, A> {
  type: ActivityType;
  skill: Skill;                 // default skill this activity trains
  stage: LessonStage;           // default lesson stage
  promptSchema: ZodType<P>;
  answerSchema: ZodType<A>;
  evaluation: 'deterministic' | 'assisted' | 'ai';
  evaluate?(activity, answer): Verdict;   // required when not 'ai'
  supportsHints: boolean;
  defaultPoints: number;
}
```

`ACTIVITY_TYPES` is a `Record<ActivityType, ActivityTypeDef>` covering all 26 types from
§13. The app builds its renderer map from the same keys, so a missing renderer is a
compile error, not a blank screen.

| # | type | evaluation | primary skill |
|---|---|---|---|
| 1 | `multiple_choice` | deterministic | varies |
| 2 | `multiple_answer` | deterministic (set equality, partial credit) | varies |
| 3 | `tap_translation` | deterministic | reading |
| 4 | `fill_blank` | deterministic + accepted variants | grammar |
| 5 | `drag_drop` | deterministic | grammar |
| 6 | `sentence_order` | deterministic (token sequence) | grammar |
| 7 | `word_match` | deterministic (pair set) | vocabulary |
| 8 | `image_match` | deterministic | vocabulary |
| 9 | `audio_recognition` | deterministic | listening |
| 10 | `listening_comprehension` | deterministic / assisted | listening |
| 11 | `pronunciation_repeat` | assisted (ASR + phonetic distance) | pronunciation |
| 12 | `speech_response` | ai (semantic goal check) | speaking |
| 13 | `written_response` | ai (rubric) | writing |
| 14 | `translation` | assisted (accepted set → AI fallback) | mediation |
| 15 | `conversation` | ai (goal + rubric per turn) | interaction |
| 16 | `roleplay` | ai | interaction |
| 17 | `flashcard` | deterministic (self-graded → SRS) | vocabulary |
| 18 | `dictation` | deterministic (normalised edit distance) | listening |
| 19 | `spelling` | deterministic | writing |
| 20 | `grammar_correction` | deterministic + variants | grammar |
| 21 | `word_categorization` | deterministic | vocabulary |
| 22 | `story_completion` | assisted | reading |
| 23 | `dialogue_completion` | deterministic / assisted | interaction |
| 24 | `scenario_simulation` | ai | interaction |
| 25 | `timed_challenge` | deterministic + time weighting | mixed |
| 26 | `review_challenge` | deterministic (drawn from SRS queue) | mixed |

## 8.2 Answer evaluation policy (§52)

Grading is a pipeline, and **AI is the last resort, never the first**:

```
answer
 ├─1. exact match against correct_answer            → correct
 ├─2. match against acceptable_answers[]            → correct
 ├─3. normalised match (case, punctuation, spacing,
 │      optional accent-insensitive per language,
 │      contraction expansion, articles when the
 │      activity marks them optional)                → correct (may flag "watch accents")
 ├─4. near-miss (edit distance ≤ threshold scaled by
 │      target length)                               → incorrect + targeted hint
 └─5. only if evaluation === 'ai' or the activity is
      free-form: Edge fn ai-evaluate with a strict
      rubric and a forced JSON verdict               → verdict + feedback
```

Guard rails on step 5: the model is asked for a structured verdict
(`{correct: boolean, score: 0..1, errors: [...], better: string, why: string}`), the
response is schema-validated, and a `correct: true` verdict is rejected when the answer is
empty, is in the wrong language, or shares no content words with the target — the AI is
not permitted to mark everything correct.

Accent handling is a *language* property: Spanish grades accent errors as "correct with a
note" at A1–A2 and as incorrect from B1; Japanese kana/kanji answers accept both
scripts where the lesson has not yet taught kanji. These live in
`core/evaluation/languageRules.ts`, keyed by language code.

## 8.3 Hints (§17)

Hints are an ordered array on the activity. The player reveals one level at a time:

1. context clue → 2. vocabulary clue → 3. grammar clue → 4. partial answer → 5. answer.

`hints_used` is recorded on the attempt and reduces the score contribution to mastery
(but not the XP for showing up — engagement and mastery are separate, §53). Revealing the
final answer scores 0 for mastery and forces the item back into the SRS `learning` state.

## 8.4 Error correction (§18)

The verdict object always carries enough to render the three-part correction panel:

```
Your answer:  "Yo soy 25 años."
Better:       "Tengo 25 años."
Why:          Spanish expresses age with tener (to have), not ser (to be).
```

Deterministic activities get this from the authored `explanation` plus a diff of the
learner's answer against the target; AI-evaluated activities get it from the rubric
response. Retry is always offered, and the retry is recorded as a separate attempt so the
adaptive engine can see "wrong first, right second".

## 8.5 Adaptivity (§19)

Every incorrect attempt writes a `user_mistakes` row tagged with the grammar topic,
vocabulary id or phoneme involved. `core/adaptive/recommend.ts` turns the mistake profile,
SRS due counts and skill gaps into a ranked list of recommendations
(`{kind, target, reason, estimatedMinutes}`), which is what Home and Practice render —
including the human-readable *reason*, so the learner always knows why (§96).

## 8.6 Speaking and listening

- **Listening** activities carry three audio renditions (`slow`, `normal`, `natural`) or a
  playback-rate hint, chosen by the learner's level; C2 material uses natural-speed audio
  with regional variation.
- **Speaking** uses on-device speech recognition where available, sends the transcript
  (not the raw audio, unless the learner opts in) for evaluation, and reports
  pronunciation feedback as *guidance*. The UI states plainly that AI feedback is an aid,
  not a clinical assessment (§24). If ASR is unavailable on the device, the activity
  degrades to record-and-self-compare against the model audio and is not scored.
- **Audio licensing**: `media_assets` requires `source`, `licence` and `attribution`
  before an asset may be attached to a published activity. The validator rejects a
  published lesson referencing an asset with `licence = 'unknown'` (§23).
