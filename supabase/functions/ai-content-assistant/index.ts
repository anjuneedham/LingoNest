import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticate, requireRole } from '../_shared/auth.ts';
import { fail, json, parseBody, preflight, rateLimit } from '../_shared/http.ts';
import { isAiConfigured } from '../_shared/env.ts';
import { AiNotConfiguredError, AiUnavailableError, complete, costMicros, extractJson } from '../_shared/anthropic.ts';
import { contentAssistantSystemPrompt, type Cefr } from '../_shared/prompts.ts';

/**
 * Drafts curriculum for a human editor (brief §86).
 *
 * Everything written here lands as `status = 'draft'` with
 * `generated_by = 'ai'`. A database trigger refuses to publish such a row
 * without a recorded human approval, so "AI drafted, a human approved" is an
 * invariant rather than a promise.
 */

const bodySchema = z.object({
  languageCode: z.string().min(2).max(5),
  cefr: z.string(),
  topic: z.string().min(2).max(200),
  courseId: z.string().uuid(),
  lessonCount: z.number().int().min(1).max(6).default(3),
});

const draftSchema = z.object({
  unit: z.object({
    title: z.string(),
    objective: z.string(),
    theme: z.string().default('general'),
    realWorldTask: z.string().default(''),
    lessons: z
      .array(
        z.object({
          title: z.string(),
          objective: z.string(),
          canDo: z.string(),
          minutes: z.number().int().positive().default(8),
          vocabulary: z
            .array(z.object({ term: z.string(), translation: z.string(), example: z.string().optional() }))
            .default([]),
          activities: z
            .array(
              z.object({
                type: z.string(),
                prompt: z.unknown(),
                correctAnswer: z.unknown().optional(),
                explanation: z.string().optional(),
                skill: z.string().default('vocabulary'),
              }),
            )
            .default([]),
        }),
      )
      .min(1),
  }),
  notes: z.string().default(''),
});

/** Types the CMS can render and the app can grade today. */
const SUPPORTED_TYPES = [
  'multiple_choice',
  'tap_translation',
  'fill_blank',
  'sentence_order',
  'word_match',
  'translation',
  'grammar_correction',
  'dialogue_completion',
  'written_response',
  'speech_response',
];

Deno.serve(async (request) => {
  const cors = preflight(request);
  if (cors) return cors;
  const origin = request.headers.get('origin');

  if (!isAiConfigured()) return fail('ai_not_configured', undefined, origin);

  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const { userId, asUser, asService } = auth.context;

  const isEditor =
    (await requireRole(auth.context, 'content_editor')) || (await requireRole(auth.context, 'admin'));
  if (!isEditor) return fail('forbidden', 'content editor role required', origin);

  if (!rateLimit(`content:${userId}`, 5)) return fail('rate_limited', undefined, origin);

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data: language } = await asUser
    .from('languages')
    .select('id, code, name')
    .eq('code', body.languageCode)
    .maybeSingle();
  if (!language) return fail('not_found', 'language not found', origin);

  const { data: course } = await asUser
    .from('courses')
    .select('id, title, language_id')
    .eq('id', body.courseId)
    .maybeSingle();
  if (!course || course.language_id !== language.id) {
    return fail('not_found', 'course not found for this language', origin);
  }

  const { data: existing } = await asUser
    .from('vocabulary_items')
    .select('term')
    .eq('language_id', language.id)
    .limit(200);

  const system = contentAssistantSystemPrompt({
    languageName: language.name,
    cefr: body.cefr as Cefr,
    topic: body.topic,
    existingVocabulary: (existing ?? []).map((v) => v.term),
    activityTypes: SUPPORTED_TYPES,
  });

  let result;
  try {
    result = await complete({
      system,
      messages: [
        {
          role: 'user',
          content: `Draft a unit of ${body.lessonCount} lessons on "${body.topic}" at ${body.cefr}.`,
        },
      ],
      maxTokens: 4000,
      temperature: 0.7,
      expectJson: true,
    });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) return fail('ai_not_configured', undefined, origin);
    if (error instanceof AiUnavailableError) return fail('ai_unavailable', undefined, origin);
    throw error;
  }

  let draft;
  try {
    draft = draftSchema.parse(extractJson(result.text));
  } catch (error) {
    return fail('ai_unavailable', `draft did not match the content format: ${String(error).slice(0, 120)}`, origin);
  }

  // Drop anything the renderer cannot show, rather than writing a unit the CMS
  // will fail to open.
  const rejected: string[] = [];
  const lessons = draft.unit.lessons.map((lesson) => ({
    ...lesson,
    activities: lesson.activities.filter((activity) => {
      const supported = SUPPORTED_TYPES.includes(activity.type);
      if (!supported) rejected.push(activity.type);
      return supported;
    }),
  }));

  // --- write as a draft ----------------------------------------------------
  const { data: lastUnit } = await asService
    .from('units')
    .select('ordinal')
    .eq('course_id', course.id)
    .order('ordinal', { ascending: false })
    .limit(1)
    .maybeSingle();

  const slugBase = `${body.languageCode}-ai-${Date.now().toString(36)}`;

  const { data: unitRow, error: unitError } = await asService
    .from('units')
    .insert({
      course_id: course.id,
      ordinal: (lastUnit?.ordinal ?? 0) + 1,
      slug: slugBase,
      title: draft.unit.title,
      objective: draft.unit.objective,
      theme: draft.unit.theme,
      cefr: body.cefr,
      real_world_task: draft.unit.realWorldTask || null,
      status: 'draft',
    })
    .select('id')
    .single();

  if (unitError || !unitRow) {
    return fail('unknown', `could not save the draft: ${unitError?.message}`, origin);
  }

  const lessonIds: string[] = [];
  for (const [index, lesson] of lessons.entries()) {
    const { data: lessonRow } = await asService
      .from('lessons')
      .insert({
        unit_id: unitRow.id,
        ordinal: index + 1,
        slug: `${slugBase}-l${index + 1}`,
        title: lesson.title,
        objective: lesson.objective,
        can_do: lesson.canDo,
        cefr: body.cefr,
        skills: [...new Set(lesson.activities.map((a) => a.skill))].filter(Boolean),
        estimated_minutes: lesson.minutes,
        status: 'draft',
        generated_by: 'ai',
        generation_meta: { model: result.model, topic: body.topic, requestedBy: userId },
        created_by: userId,
      })
      .select('id')
      .single();

    if (!lessonRow) continue;
    lessonIds.push(lessonRow.id);

    if (lesson.activities.length > 0) {
      await asService.from('lesson_activities').insert(
        lesson.activities.map((activity, activityIndex) => ({
          lesson_id: lessonRow.id,
          ordinal: activityIndex + 1,
          type: activity.type,
          stage: 'practice',
          skill: activity.skill,
          cefr: body.cefr,
          difficulty: 2,
          prompt: activity.prompt,
          correct_answer: activity.correctAnswer ?? null,
          explanation: activity.explanation ?? null,
          hints: [],
          media: [],
          points: 10,
          tags: [],
          variants: [],
        })),
      );
    }
  }

  await asService.from('ai_sessions').insert({
    user_id: userId,
    language_id: language.id,
    kind: 'content_assistant',
    cefr: body.cefr,
    status: 'completed',
    turns: 1,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    cost_micros: costMicros(result),
    model: result.model,
    ended_at: new Date().toISOString(),
  });

  return json(
    {
      unitId: unitRow.id,
      lessonIds,
      status: 'draft',
      notes: draft.notes,
      rejectedActivityTypes: [...new Set(rejected)],
      // Said plainly, because the CMS shows it to the editor.
      reviewRequired:
        'This unit is a draft generated by AI. It cannot be published until a human editor reviews and approves it — the database enforces this.',
    },
    {},
    origin,
  );
});
