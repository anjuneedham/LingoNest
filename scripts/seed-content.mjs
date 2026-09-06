#!/usr/bin/env node
/**
 * Seeds the validated content bundles into Postgres.
 *
 * Reads packages/content/dist/*.json (produced by `npm run content:build`) and
 * upserts languages, variants, levels, courses, units, lessons, activities,
 * vocabulary, grammar, culture notes, scenarios and media assets.
 *
 * Idempotent: every write is an upsert keyed on a natural key (language code,
 * lesson slug, vocabulary key…), so re-running after a content change updates
 * in place rather than duplicating. Learner progress references lesson ids,
 * which are preserved across runs.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: seeding writes content
 * that RLS reserves for content editors, so it runs with the service role and
 * must never be executed from a client.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, '..', 'packages', 'content', 'dist');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n' +
      'For a local stack: supabase status shows both. See docs/SETUP.md.',
  );
  process.exit(1);
}

if (!existsSync(distDir)) {
  console.error('No content bundles found. Run `npm run content:build` first.');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

/** Publish content as it is seeded; the CMS can unpublish afterwards. */
const STATUS = process.env.SEED_STATUS ?? 'published';

async function upsert(table, rows, onConflict) {
  if (rows.length === 0) return [];
  const { data, error } = await db.from(table).upsert(rows, { onConflict }).select();
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
  return data ?? [];
}

async function seedLanguage(bundle) {
  const language = bundle.language;
  if (!language) throw new Error('bundle has no language record');

  const [languageRow] = await upsert(
    'languages',
    [
      {
        code: language.code,
        name: language.name,
        native_name: language.nativeName,
        writing_system: language.writingSystem,
        rtl: language.rtl,
        requires_script_module: language.requiresScriptModule,
        space_separated: language.spaceSeparated,
        plus_levels: language.plusLevels,
        status: STATUS,
      },
    ],
    'code',
  );
  const languageId = languageRow.id;

  await upsert(
    'language_variants',
    language.variants.map((variant) => ({
      language_id: languageId,
      code: variant.code,
      label: variant.label,
      region: variant.region,
      is_default: variant.isDefault,
    })),
    'language_id,code',
  );

  // --- media first: activities reference assets, and a published lesson
  // cannot reference an asset with an unknown licence.
  await upsert(
    'media_assets',
    bundle.media.map((asset) => ({
      key: asset.key,
      kind: asset.kind,
      storage_path: asset.path,
      source: asset.source,
      licence: asset.licence,
      attribution: asset.attribution ?? null,
      voice: asset.voice ?? null,
      speed: asset.speed ?? null,
      variant_code: asset.variantCode ?? null,
      language_id: languageId,
    })),
    'key',
  );

  const vocabularyRows = await upsert(
    'vocabulary_items',
    bundle.vocabulary.map((item) => ({
      language_id: languageId,
      key: item.key,
      term: item.term,
      translation: item.translation,
      part_of_speech: item.partOfSpeech ?? null,
      gender: item.gender ?? null,
      pronunciation: item.pronunciation ?? null,
      example_sentence: item.example ?? null,
      example_translation: item.exampleTranslation ?? null,
      audio_asset_key: item.audio ?? null,
      image_asset_key: item.image ?? null,
      cefr: item.cefr,
      difficulty: item.difficulty ?? 2,
      variant_overrides: item.variantOverrides ?? {},
      status: STATUS,
    })),
    'language_id,key',
  );
  const vocabularyByKey = new Map(vocabularyRows.map((row) => [row.key, row.id]));

  // Category links.
  const { data: categories } = await db.from('vocabulary_categories').select('id, code');
  const categoryByCode = new Map((categories ?? []).map((c) => [c.code, c.id]));
  const categoryLinks = [];
  for (const item of bundle.vocabulary) {
    for (const code of item.categories) {
      const categoryId = categoryByCode.get(code);
      const vocabularyId = vocabularyByKey.get(item.key);
      if (categoryId && vocabularyId) {
        categoryLinks.push({ vocabulary_id: vocabularyId, category_id: categoryId });
      }
    }
  }
  await upsert('vocabulary_item_categories', categoryLinks, 'vocabulary_id,category_id');

  const grammarRows = await upsert(
    'grammar_topics',
    bundle.grammar.map((topic) => ({
      language_id: languageId,
      key: topic.key,
      title: topic.title,
      cefr: topic.cefr,
      summary: topic.summary,
      explanation: topic.explanation,
      examples: topic.examples,
      common_mistakes: topic.commonMistakes ?? [],
      status: STATUS,
    })),
    'language_id,key',
  );
  const grammarByKey = new Map(grammarRows.map((row) => [row.key, row.id]));

  const cultureRows = await upsert(
    'culture_notes',
    bundle.culture.map((note) => ({
      language_id: languageId,
      key: note.key,
      variant_codes: note.variantCodes ?? [],
      title: note.title,
      body: note.body,
      topic: note.topic,
      cefr: note.cefr,
      status: STATUS,
    })),
    'language_id,key',
  );
  const cultureByKey = new Map(cultureRows.map((row) => [row.key, row.id]));

  await upsert(
    'conversation_scenarios',
    bundle.scenarios.map((scenario) => ({
      language_id: languageId,
      key: scenario.key,
      title: scenario.title,
      setting: scenario.setting,
      partner_role: scenario.partnerRole,
      learner_role: scenario.learnerRole,
      cefr: scenario.cefr,
      goals: scenario.goals,
      complications: scenario.complications ?? [],
      opening_line: scenario.openingLine,
      vocabulary_keys: scenario.vocabulary ?? [],
      status: STATUS,
    })),
    'language_id,key',
  );

  let lessonCount = 0;
  let activityCount = 0;

  for (const course of bundle.courses) {
    const [levelRow] = await upsert(
      'levels',
      [{ language_id: languageId, cefr: course.cefr, ordinal: course.ordinal, status: STATUS }],
      'language_id,cefr',
    );

    const [courseRow] = await upsert(
      'courses',
      [
        {
          language_id: languageId,
          level_id: levelRow.id,
          slug: course.slug,
          title: course.title,
          description: course.description,
          ordinal: course.ordinal,
          status: STATUS,
        },
      ],
      'language_id,slug',
    );

    for (const unit of course.units) {
      const [unitRow] = await upsert(
        'units',
        [
          {
            course_id: courseRow.id,
            ordinal: unit.ordinal,
            slug: unit.slug,
            title: unit.title,
            objective: unit.objective,
            theme: unit.theme,
            cefr: unit.cefr,
            real_world_task: unit.realWorldTask ?? null,
            status: STATUS,
          },
        ],
        'course_id,slug',
      );

      for (const [index, lesson] of unit.lessons.entries()) {
        // Insert the lesson as a draft first: the publish trigger requires the
        // activities and media to exist already.
        const [lessonRow] = await upsert(
          'lessons',
          [
            {
              unit_id: unitRow.id,
              ordinal: index + 1,
              slug: lesson.slug,
              title: lesson.title,
              objective: lesson.objective,
              can_do: lesson.canDo,
              cefr: lesson.cefr,
              skills: lesson.skills,
              estimated_minutes: lesson.minutes,
              is_review: lesson.isReview ?? false,
              is_checkpoint: lesson.isCheckpoint ?? false,
              status: 'draft',
              generated_by: 'human',
            },
          ],
          'slug',
        );
        lessonCount += 1;

        await upsert(
          'lesson_activities',
          lesson.activities.map((activity) => ({
            lesson_id: lessonRow.id,
            ordinal: activity.ordinal,
            type: activity.type,
            stage: activity.stage,
            skill: activity.skill,
            cefr: activity.cefr,
            difficulty: activity.difficulty,
            prompt: activity.prompt,
            correct_answer: activity.correctAnswer ?? null,
            acceptable_answers: activity.acceptableAnswers ?? null,
            hints: activity.hints,
            explanation: activity.explanation ?? null,
            media: activity.media,
            rubric: activity.rubric ?? null,
            points: activity.points,
            time_limit_seconds: activity.timeLimitSeconds ?? null,
            tags: activity.tags,
            variants: activity.variants,
          })),
          'lesson_id,ordinal',
        );
        activityCount += lesson.activities.length;

        const vocabularyLinks = (lesson.vocabulary ?? [])
          .map((key) => vocabularyByKey.get(key))
          .filter(Boolean)
          .map((vocabularyId) => ({ lesson_id: lessonRow.id, vocabulary_id: vocabularyId }));
        await upsert('lesson_vocabulary', vocabularyLinks, 'lesson_id,vocabulary_id');

        const grammarLinks = (lesson.grammar ?? [])
          .map((key) => grammarByKey.get(key))
          .filter(Boolean)
          .map((topicId) => ({ lesson_id: lessonRow.id, grammar_topic_id: topicId }));
        await upsert('lesson_grammar', grammarLinks, 'lesson_id,grammar_topic_id');

        const cultureLinks = (lesson.culture ?? [])
          .map((key) => cultureByKey.get(key))
          .filter(Boolean)
          .map((noteId) => ({ lesson_id: lessonRow.id, culture_note_id: noteId }));
        await upsert('lesson_culture_notes', cultureLinks, 'lesson_id,culture_note_id');

        // Now that the lesson is complete, publish it. The database trigger
        // re-checks the objective, skills, answer keys and media licences.
        const { error } = await db.from('lessons').update({ status: STATUS }).eq('id', lessonRow.id);
        if (error) {
          throw new Error(`publishing ${lesson.slug}: ${error.message}`);
        }
      }
    }
  }

  return { lessonCount, activityCount };
}

const bundles = readdirSync(distDir).filter((f) => f.endsWith('.json') && f !== 'manifest.json');
let totalLessons = 0;
let totalActivities = 0;

for (const file of bundles) {
  const bundle = JSON.parse(readFileSync(join(distDir, file), 'utf8'));
  process.stdout.write(`seeding ${bundle.language?.code ?? file}… `);
  try {
    const { lessonCount, activityCount } = await seedLanguage(bundle);
    totalLessons += lessonCount;
    totalActivities += activityCount;
    console.log(`${lessonCount} lessons, ${activityCount} activities`);
  } catch (error) {
    console.log('failed');
    console.error(`  ${error.message}`);
    process.exitCode = 1;
  }
}

console.log(`\nSeeded ${totalLessons} lessons and ${totalActivities} activities.`);
