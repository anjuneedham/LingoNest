# 7. CEFR Curriculum Architecture

## 7.1 Framework position

We use the Council of Europe's CEFR reference levels (A1–C2, plus a Pre-A1 preparatory
band) as an **instructional framework and a vocabulary for describing ability**. The app
reports *estimated* levels — "Your current estimated level: B1", "Working toward B2" —
and never claims official certification or accreditation. This is enforced in code: the
i18n keys for level display go through `cefr.estimatedLevelLabel`, and a lint rule
forbids the strings "certified", "certification" and "official level" in learner-facing
locale files under the progression namespace.

## 7.2 Level ladder

| Ordinal | Level | Plus level | Purpose |
|---|---|---|---|
| 0 | Pre-A1 | — | Sounds, script, survival words. No grammar load. |
| 1 | A1 | — | Survival communication. |
| 2 | A2 | A2+ | Routine everyday exchanges. |
| 3 | B1 | B1+ | Independent everyday communication. |
| 4 | B2 | B2+ | Comfortable independent + abstract topics. |
| 5 | C1 | — | Fluent, flexible, register-aware. |
| 6 | C2 | — | Highly proficient command (never "native"). |

Plus levels are a per-language configuration flag (`levels.plus_level`), so a language
team can ship `A2 → A2+ → B1` or `A2 → B1` without code changes. Ordering comes from
`packages/core/src/cefr` (`CEFR_ORDER`, `compareCefr`, `nextCefr`), used identically by
the app, the CMS and the Edge Functions.

## 7.3 Content hierarchy

```
LANGUAGE → LEVEL → COURSE → UNIT → LESSON → ACTIVITY → ASSESSMENT
```

Depth targets per launch language (English, Spanish, French, Japanese):

| Level | Units | Lessons/unit | Activities/lesson | Checkpoint |
|---|---|---|---|---|
| Pre-A1 | 4–6 | 4–5 | 8–14 | yes |
| A1 | 10 | 5 | 10–16 | yes |
| A2 | 10 | 5 | 10–16 | yes |
| B1 | 10 | 5 | 12–18 | yes |
| B2 | 10 | 5 | 12–18 | yes |
| C1 | 8–10 | 5 | 12–18 | yes |
| C2 | architected; units added progressively | | | |

Every unit ends with a **review lesson**; every level ends with a **checkpoint
assessment** covering reading, listening, vocabulary, grammar, speaking and writing.
Every level contains at least one **real-world task** (§78).

## 7.4 Lesson stage machine

A lesson is an ordered list of activities, each tagged with a `stage`. The player walks
the stages; a stage may contain several activities, and stages may be omitted when a
lesson type does not need them (a review lesson has no `discover`).

```
introduce → discover → listen → understand → practice → speak
          → build → converse → apply → review → feedback → next
```

`@lingonest/core/activities` exposes `LESSON_STAGES` and `defaultStageForType()`, so an
author who adds an activity without a stage still lands in a sane place, and the CMS can
warn when a lesson skips `speak` or `converse` at a level where the curriculum spec
requires them.

## 7.5 Authoring format

Authors work in `packages/content` with typed builders rather than raw JSON:

```ts
lesson({
  slug: 'a1-u1-l2-introducing-yourself',
  title: 'Introducing Yourself',
  objective: 'Say your name and ask someone else theirs.',
  canDo: 'I can introduce myself and ask what someone is called.',
  cefr: 'A1',
  minutes: 8,
  vocabulary: ['me-llamo', 'como-te-llamas', 'mucho-gusto', 'encantado'],
  grammar: ['es-a1-llamarse'],
  activities: [
    intro('Today you will introduce yourself in Spanish.'),
    discover('me-llamo'),
    listen({ audio: 'es/a1/u1/dialog-2', script: '…', question: … }),
    tapTranslation({ prompt: 'Me llamo Ana.', answer: 'My name is Ana.', options: […] }),
    buildSentence({ target: 'Hola, me llamo Ana.', tokens: ['Hola', 'me', 'llamo', 'Ana'] }),
    speak({ target: 'Hola, me llamo …', rubric: 'greeting + name' }),
    converse({ scenario: 'es-meeting-a-classmate' }),
    realWorldTask({ prompt: 'Introduce yourself to a new classmate.' }),
    review(['me-llamo', 'como-te-llamas']),
  ],
})
```

`npm run content:validate` type-checks and then runs semantic checks: every vocabulary id
referenced exists, every activity has an answer key and explanation, no activity is
ambiguous (multiple choice options must be mutually exclusive), CEFR of activities is
within one band of the lesson, audio references resolve to a licensed asset, and each
lesson declares an objective, CEFR level, skills, answer key, difficulty and duration
(§87). Validation failure fails CI.

## 7.6 Adding a new language

1. Add the language + variants to `packages/content/src/languages`.
2. Create `curricula/<code>/` with level files.
3. Provide vocabulary, grammar topics, culture notes and scenarios.
4. Generate/licence audio and register it in `media_assets` with attribution.
5. `npm run content:build && npm run db:seed`.

No application code changes. The renderer, the SRS, the scoring, the placement engine and
the AI prompts are all language-agnostic; language-specific behaviour (script direction,
whether a writing-system module is needed, tokenisation for Japanese/Chinese) is declared
as data on the `languages` row and read by generic code.

## 7.7 Regional variants

`language_variants` carries `es-ES`, `es-MX`, `es-419`, `pt-BR`, `pt-PT`, `en-US`,
`en-GB`, `fr-FR`, `fr-CA`… A vocabulary item or activity may declare `variants: ['es-MX']`
to be included only for that variant, or `variantOverrides` to swap a word
(`coche` / `carro`) while keeping one lesson. The default variant is a property of the
language, and the learner's choice lives on `user_languages.variant_id`. The UI never
presents one country's usage as *the* language (§27).
