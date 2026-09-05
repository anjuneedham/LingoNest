# 9. AI Architecture

## 9.1 Placement of the model

The client never holds an AI key and never calls the model provider. Every AI feature is
a Supabase Edge Function that:

1. verifies the caller's JWT and loads their profile, plan and language state;
2. enforces the plan's usage limit against `ai_usage_counters`;
3. builds a **server-side prompt** from database facts (level, weaknesses, recent
   mistakes, scenario definition) — the client sends intent and user text, never the
   system prompt;
4. calls Anthropic with a strict output contract;
5. validates the response against a Zod schema before returning it;
6. records `ai_sessions` / `ai_messages` and token usage.

```
app ──POST /functions/v1/ai-conversation {sessionId, text|transcript}
        │
        ▼
 auth → plan limit → context builder (skill_profiles, user_mistakes, scenario)
        │
        ▼  Anthropic Messages API (ANTHROPIC_API_KEY, server secret)
        │
        ◀── {reply, replyTranslation, evaluation, goalProgress, suggestedNextTurn}
        │  validated, persisted, counted
        ▼
 app renders turn + inline correction
```

## 9.2 The four AI surfaces

| Function | Purpose | Output contract |
|---|---|---|
| `ai-conversation` | In-character roleplay (waiter, receptionist, interviewer, friend…) at the learner's level. | `{reply, translation, correction?, goalProgress, difficultyHint}` |
| `ai-evaluate` | Grade free-form speaking/writing/translation against a rubric. | `{correct, score, errors[], better, why, strengths[], vocabularyUpgrades[]}` |
| `ai-coach` | Proactive study coach: reads the learner's weaknesses and proposes a session. | `{message, plan: [{kind, target, minutes, reason}]}` |
| `ai-content-assistant` | Admin-side: propose a unit (vocabulary, dialogue, exercises, grammar, listening script, tasks) for human review. | Draft `Unit` JSON matching the content DSL |

## 9.3 Level-adaptive conversation (§16)

The system prompt is assembled from a template plus a **difficulty profile** derived from
the learner's `speaking_level`/`interaction_level`:

| Band | Speech | Vocabulary | Behaviour |
|---|---|---|---|
| Pre-A1/A1 | short, slow, one idea per turn | ~500 most frequent | asks closed questions, offers choices, repeats |
| A2 | natural but simple | ~1500 | mild follow-ups, gentle recasts |
| B1 | natural | ~3000 | asks for opinions, introduces small complications |
| B2 | natural | broad | disagrees, argues, changes topic |
| C1 | fast, idiomatic | idioms, register shifts | interrupts, uses implicature |
| C2 | spontaneous | humour, irony, regional variation | nuance, sarcasm, cultural references |

Free-form learner responses are allowed everywhere (§15). The model judges whether the
**communicative goal** was achieved rather than matching a script, and returns
`goalProgress` so the UI can show "2 of 3 goals achieved: ordered a drink, asked the
price — still to do: ask for the bill".

## 9.4 Correction policy inside conversation

The character stays in character; corrections are returned in a *separate field* and
rendered as an unobtrusive inline note, so the conversation is not destroyed by
constant interruption. At A1–A2 only errors that block comprehension are surfaced; from
B1 the model also flags accuracy and naturalness. This threshold is part of the
difficulty profile, not a hardcoded prompt.

## 9.5 Content generation with mandatory review (§47, §86)

`ai-content-assistant` writes into `units`/`lessons`/`lesson_activities` with
`status = 'draft'` and `generated_by = 'ai'` plus the model id and prompt hash. The
publish transition is guarded by a Postgres trigger:

```sql
-- publishing AI-generated content requires an explicit human approval record
if new.status = 'published' and old.generated_by = 'ai'
   and not exists (select 1 from content_approvals
                   where entity_id = new.id and approved_by is not null)
then raise exception 'ai_content_requires_human_approval';
```

So "AI drafted, a human approved" is a database invariant, not a UI convention.

## 9.6 Cost, limits and abuse

- Per-plan monthly/daily AI turn limits in `subscription_plans.entitlements`, enforced
  server-side and surfaced honestly in the UI ("18 of 40 AI conversations left this month").
- Token usage and cost per session recorded for unit-economics reporting.
- Rate limiting per user and per IP in the shared Edge middleware.
- Prompt-injection posture: learner text is passed as user content inside delimiters, and
  the response schema is validated; the model cannot change the learner's level, grant
  entitlements or write to the database — those are separate authenticated code paths.

## 9.7 Degradation

If `ANTHROPIC_API_KEY` is unset the functions return `503 {code:'ai_not_configured'}`.
The app shows "AI practice isn't configured in this environment" rather than a fake
reply. Deterministic lesson activities continue to work unaffected.
