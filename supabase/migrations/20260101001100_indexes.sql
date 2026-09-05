-- ---------------------------------------------------------------------------
-- Indexes for the remaining foreign keys.
--
-- An unindexed foreign key turns a parent delete or update into a sequential
-- scan of the child table and holds locks while it runs. The schema assertions
-- warn about any that are missing; these close the gaps that matter.
-- ---------------------------------------------------------------------------

create index if not exists user_roles_granted_by_idx on public.user_roles (granted_by);
create index if not exists lessons_created_by_idx on public.lessons (created_by);
create index if not exists media_assets_language_idx on public.media_assets (language_id);
create index if not exists vocabulary_item_categories_category_idx on public.vocabulary_item_categories (category_id);
create index if not exists lesson_vocabulary_vocab_idx on public.lesson_vocabulary (vocabulary_id);
create index if not exists lesson_grammar_topic_idx on public.lesson_grammar (grammar_topic_id);
create index if not exists lesson_culture_note_idx on public.lesson_culture_notes (culture_note_id);
create index if not exists content_approvals_approver_idx on public.content_approvals (approved_by);

create index if not exists user_languages_language_idx on public.user_languages (language_id);
create index if not exists user_languages_variant_idx on public.user_languages (variant_id);
create index if not exists skill_profiles_language_idx on public.skill_profiles (language_id);
create index if not exists user_progress_lesson_idx on public.user_progress (lesson_id);
create index if not exists activity_attempts_activity_idx on public.activity_attempts (activity_id);
create index if not exists user_vocabulary_vocab_idx on public.user_vocabulary (vocabulary_id);
create index if not exists user_mistakes_language_idx on public.user_mistakes (language_id);
create index if not exists user_mistakes_activity_idx on public.user_mistakes (last_activity_id);
create index if not exists user_achievements_code_idx on public.user_achievements (achievement_code);
create index if not exists assessments_language_idx on public.assessments (language_id);
create index if not exists assessment_items_activity_idx on public.assessment_items (activity_id);
create index if not exists assessment_attempts_assessment_idx on public.assessment_attempts (assessment_id);
create index if not exists level_readiness_language_idx on public.level_readiness (language_id);

create index if not exists lesson_packages_teacher_idx on public.lesson_packages (teacher_id);
create index if not exists teacher_applications_user_idx on public.teacher_applications (user_id);
create index if not exists teacher_applications_reviewer_idx on public.teacher_applications (reviewer_id);
create index if not exists teacher_verifications_verifier_idx on public.teacher_verifications (verified_by);
create index if not exists package_purchases_package_idx on public.package_purchases (package_id);
create index if not exists package_purchases_teacher_idx on public.package_purchases (teacher_id);
create index if not exists bookings_language_idx on public.bookings (language_id);
create index if not exists bookings_package_idx on public.bookings (package_purchase_id);
create index if not exists bookings_cancelled_by_idx on public.bookings (cancelled_by);
create index if not exists booking_assignments_teacher_idx on public.booking_assignments (teacher_id);
create index if not exists booking_assignments_booking_idx on public.booking_assignments (booking_id);
create index if not exists reviews_learner_idx on public.reviews (learner_id);

create index if not exists subscriptions_plan_idx on public.subscriptions (plan_code);
create index if not exists payments_package_idx on public.payments (package_purchase_id);
create index if not exists payments_subscription_idx on public.payments (subscription_id);
create index if not exists refunds_payment_idx on public.refunds (payment_id);
create index if not exists refunds_booking_idx on public.refunds (booking_id);
create index if not exists refunds_resolver_idx on public.refunds (resolved_by);
create index if not exists disputes_booking_idx on public.disputes (booking_id);
create index if not exists disputes_payment_idx on public.disputes (payment_id);
create index if not exists disputes_opener_idx on public.disputes (opened_by);
create index if not exists disputes_resolver_idx on public.disputes (resolved_by);
create index if not exists learner_credits_user_idx on public.learner_credits (user_id);
create index if not exists promotions_creator_idx on public.promotions (created_by);
create index if not exists referrals_referee_idx on public.referrals (referee_id);
create index if not exists remote_config_updater_idx on public.remote_config (updated_by);
create index if not exists feature_flags_updater_idx on public.feature_flags (updated_by);

create index if not exists ai_sessions_language_idx on public.ai_sessions (language_id);
create index if not exists ai_sessions_scenario_idx on public.ai_sessions (scenario_id);
create index if not exists ai_sessions_lesson_idx on public.ai_sessions (lesson_id);
create index if not exists ai_usage_counters_user_idx on public.ai_usage_counters (user_id, period_start);

create index if not exists conversations_booking_idx on public.conversations (booking_id);
create index if not exists conversation_participants_user_idx on public.conversation_participants (user_id);
create index if not exists messages_sender_idx on public.messages (sender_id);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
create index if not exists mutes_muted_idx on public.mutes (muted_id);
create index if not exists community_groups_language_idx on public.community_groups (language_id);
create index if not exists community_posts_author_idx on public.community_posts (author_id);
create index if not exists community_comments_post_idx on public.community_comments (post_id, created_at);
create index if not exists community_comments_author_idx on public.community_comments (author_id);
create index if not exists post_reactions_user_idx on public.post_reactions (user_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists moderation_actions_report_idx on public.moderation_actions (report_id);
create index if not exists moderation_actions_moderator_idx on public.moderation_actions (moderator_id);
create index if not exists moderation_actions_target_idx on public.moderation_actions (target_user_id);
