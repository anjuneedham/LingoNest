-- ---------------------------------------------------------------------------
-- Baseline configuration. These are operational defaults, not curriculum:
-- plans, commission tiers, achievements, vocabulary categories and the remote
-- config bundle the client falls back on. All of it is editable from the admin
-- CMS at runtime.
-- ---------------------------------------------------------------------------

insert into public.subscription_plans (code, name_key, description_key, tier, prices, entitlements, trial_days, active)
values
  (
    'free', 'plan.free.name', 'plan.free.description', 0,
    '{"USD": {"month": 0, "year": 0}}'::jsonb,
    '{
      "dailyLessonLimit": 3,
      "aiConversationsPerMonth": 5,
      "aiEvaluationsPerMonth": 10,
      "speakingPractice": false,
      "advancedReview": false,
      "personalizedLearning": false,
      "offlineDownloads": false,
      "adFree": false,
      "aiStudyCoach": false,
      "learningReports": false,
      "tutorDiscountBps": 0,
      "immersionMode": false
    }'::jsonb,
    0, true
  ),
  (
    'premium', 'plan.premium.name', 'plan.premium.description', 1,
    '{
      "USD": {"month": 999, "year": 7999},
      "CAD": {"month": 1399, "year": 10999},
      "GBP": {"month": 899, "year": 6999},
      "EUR": {"month": 999, "year": 7999},
      "AUD": {"month": 1599, "year": 11999},
      "JPY": {"month": 1500, "year": 12000},
      "MXN": {"month": 19900, "year": 159900},
      "BRL": {"month": 4990, "year": 39900}
    }'::jsonb,
    '{
      "dailyLessonLimit": null,
      "aiConversationsPerMonth": 40,
      "aiEvaluationsPerMonth": 200,
      "speakingPractice": true,
      "advancedReview": true,
      "personalizedLearning": true,
      "offlineDownloads": true,
      "adFree": true,
      "aiStudyCoach": false,
      "learningReports": false,
      "tutorDiscountBps": 0,
      "immersionMode": true
    }'::jsonb,
    7, true
  ),
  (
    'premium_plus', 'plan.premium_plus.name', 'plan.premium_plus.description', 2,
    '{
      "USD": {"month": 1999, "year": 15999},
      "CAD": {"month": 2699, "year": 21999},
      "GBP": {"month": 1799, "year": 13999},
      "EUR": {"month": 1999, "year": 15999},
      "AUD": {"month": 2999, "year": 23999},
      "JPY": {"month": 2900, "year": 23000},
      "MXN": {"month": 39900, "year": 319900},
      "BRL": {"month": 9990, "year": 79900}
    }'::jsonb,
    '{
      "dailyLessonLimit": null,
      "aiConversationsPerMonth": null,
      "aiEvaluationsPerMonth": null,
      "speakingPractice": true,
      "advancedReview": true,
      "personalizedLearning": true,
      "offlineDownloads": true,
      "adFree": true,
      "aiStudyCoach": true,
      "learningReports": true,
      "tutorDiscountBps": 1000,
      "immersionMode": true
    }'::jsonb,
    7, true
  )
on conflict (code) do nothing;

insert into public.commission_tiers (min_lessons, max_lessons, bps, active) values
  (0, 10, 2500, true),
  (11, 50, 2000, true),
  (51, 150, 1800, true),
  (151, null, 1500, true)
on conflict do nothing;

insert into public.achievements (code, label_key, description_key, ordinal) values
  ('first_lesson', 'achievement.first_lesson', 'achievement.first_lesson.desc', 1),
  ('ten_lessons', 'achievement.ten_lessons', 'achievement.ten_lessons.desc', 2),
  ('fifty_lessons', 'achievement.fifty_lessons', 'achievement.fifty_lessons.desc', 3),
  ('hundred_words', 'achievement.hundred_words', 'achievement.hundred_words.desc', 4),
  ('five_hundred_words', 'achievement.five_hundred_words', 'achievement.five_hundred_words.desc', 5),
  ('week_streak', 'achievement.week_streak', 'achievement.week_streak.desc', 6),
  ('month_streak', 'achievement.month_streak', 'achievement.month_streak.desc', 7),
  ('first_conversation', 'achievement.first_conversation', 'achievement.first_conversation.desc', 8),
  ('first_tutor_lesson', 'achievement.first_tutor_lesson', 'achievement.first_tutor_lesson.desc', 9),
  ('level_complete', 'achievement.level_complete', 'achievement.level_complete.desc', 10),
  ('speaker', 'achievement.speaker', 'achievement.speaker.desc', 11),
  ('perfectionist', 'achievement.perfectionist', 'achievement.perfectionist.desc', 12)
on conflict (code) do nothing;

insert into public.vocabulary_categories (code, label, ordinal) values
  ('greetings', 'Greetings', 1), ('family', 'Family', 2), ('food', 'Food', 3),
  ('drinks', 'Drinks', 4), ('travel', 'Travel', 5), ('business', 'Business', 6),
  ('school', 'School', 7), ('home', 'Home', 8), ('health', 'Health', 9),
  ('technology', 'Technology', 10), ('relationships', 'Relationships', 11),
  ('sports', 'Sports', 12), ('entertainment', 'Entertainment', 13),
  ('nature', 'Nature', 14), ('shopping', 'Shopping', 15),
  ('transportation', 'Transportation', 16), ('emergency', 'Emergency', 17),
  ('culture', 'Culture', 18), ('numbers', 'Numbers', 19), ('time', 'Time', 20),
  ('weather', 'Weather', 21), ('clothing', 'Clothing', 22), ('work', 'Work', 23),
  ('directions', 'Directions', 24), ('hobbies', 'Hobbies', 25), ('body', 'Body', 26),
  ('colors', 'Colours', 27), ('animals', 'Animals', 28)
on conflict (code) do nothing;

insert into public.remote_config (key, value, is_public) values
  ('booking', '{"slotMinutes": 30, "bufferMinutes": 10, "leadTimeMinutes": 120, "maxPerDay": 10, "payoutHoldHours": 24}'::jsonb, true),
  ('refundPolicy', '{
      "learnerCancellation": [
        {"minHoursBefore": 24, "learnerRefundBps": 10000, "teacherCompensationBps": 0},
        {"minHoursBefore": 12, "learnerRefundBps": 5000, "teacherCompensationBps": 5000},
        {"minHoursBefore": 0, "learnerRefundBps": 0, "teacherCompensationBps": 10000}
      ],
      "teacherCancellationRefundBps": 10000,
      "teacherCancellationCreditBps": 1000,
      "learnerNoShowRefundBps": 0,
      "teacherNoShowRefundBps": 10000,
      "technicalFailureRefundBps": 10000
    }'::jsonb, true),
  ('referral', '{"refereeTrialDays": 7, "referrerRewardDays": 7, "qualifyingLessons": 3, "qualifyingDistinctDays": 2, "monthlyRewardCap": 10, "sameDeviceLimit": 2}'::jsonb, true),
  ('ranking', '{"rating": 0.32, "reliability": 0.18, "responsiveness": 0.12, "availability": 0.18, "priceFit": 0.1, "newTeacherBoost": 0.05, "specialtyMatch": 0.05}'::jsonb, false),
  ('badgeThresholds', '{"experiencedMinLessons": 100, "experiencedMinRating": 4.6, "experiencedMinReviews": 20}'::jsonb, true),
  ('srs', '{"learningStepsMinutes": [1, 10, 60, 1440], "graduatingIntervalDays": 1, "easyIntervalDays": 4, "masteredIntervalDays": 60, "leechThreshold": 6, "maxIntervalDays": 365}'::jsonb, true),
  ('ai', '{"conversationModel": "claude-sonnet-5", "evaluationModel": "claude-sonnet-5", "maxTurnsPerSession": 40, "rateLimitPerMinute": 20}'::jsonb, false)
on conflict (key) do nothing;

insert into public.feature_flags (key, enabled) values
  ('community', true),
  ('offlineDownloads', true),
  ('immersionMode', true),
  ('leaderboards', false),
  ('liveVideo', true)
on conflict (key) do nothing;
