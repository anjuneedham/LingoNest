# 6. Screen Map

Each screen answers the five UX questions from §96: *Where am I? What am I learning?
Why? What next? How am I improving?*

## Home (`(tabs)/index`)
- Greeting + current language/variant switcher.
- **Level card**: `Spanish · A2 · working toward B1` with the skill radar (9 skills).
- **Today's goal ring**: minutes done / target, streak flame.
- **Continue**: the next lesson with its objective, not just a title.
- **Review due**: `12 words due` → SRS session.
- **Practice suggestion**: chosen by the adaptive engine from `user_mistakes`.
- **Next tutor lesson**: teacher, local time, join button when within 10 minutes.
- States: loading skeleton · empty ("pick a language") · error with retry.

## Learn (`(tabs)/learn`)
- Vertical level ladder Pre-A1 → C2 with per-level progress bars and the current level
  marked. Locked levels show *why* ("Complete the A1 checkpoint to unlock A2"), with the
  unmet criteria listed — never a bare padlock.
- Expanding a level shows courses → units → lessons; each lesson chip carries its
  primary skill icon, duration and mastery state.
- Unit header shows the unit's can-do objective and its real-world task.

## Practice (`(tabs)/practice`)
Cards: AI Conversation · Speaking · Vocabulary Review · Listening · Writing · Grammar ·
Quick Practice (5 min) · Mistake Review. Each card shows *why it is being suggested*
(e.g. "3 recent errors with the preterite").

## Teachers (`(tabs)/teachers`)
- Search + filters: language, variant/region, price range, rating, availability window,
  specialty, native speaker, certified, exam prep, business, children, adults, travel.
- Teacher card: photo, name, country flag, rating + count, price from, specialties,
  next available slot, verification badges (only when actually verified).
- Empty state offers to widen filters; error state retries.

## Profile (`(tabs)/profile`)
Languages and levels, skill breakdown with evidence ("why this level?"), streak, XP,
achievements, lessons completed, tutor bookings, subscription and manage-plan,
referral code, settings.

## Lesson player (`lesson/[id]/play`)
Header: unit → lesson breadcrumb, progress dots, stage label
(Introduce · Discover · Listen · Understand · Practice · Speak · Build · Converse ·
Apply · Review). Body: the activity renderer for the current activity type. Footer:
check/continue, hint button (progressive, cost tracked), skip-with-reason.
On a wrong answer the feedback panel shows *your answer → better answer → why*, then
offers a retry (§18).

## Lesson summary
Accuracy, time, XP, words moved to `review`, mistakes grouped by grammar/vocabulary tag,
skills touched, and one concrete next step.

## AI conversation (`practice/conversation/[scenarioId]`)
Scenario brief ("You are at a café in Mexico City; order breakfast and ask for the bill"),
character persona, difficulty control (slow/natural/fast), mic + text input, live
transcript with tappable words, and a post-session report: goal achieved?, strengths,
grammar corrections, vocabulary upgrades, natural alternatives, pronunciation notes.

## Teacher profile & booking
Profile → availability in the learner's timezone → single lesson or package → server-priced
checkout → confirmation with calendar add and cancellation policy stated up front.

## Live lesson room (`room/[bookingId]`)
Video tiles, mic/camera controls, chat, shared notes, timer, end lesson → review prompt.
Provider is injected; the screen talks to `VideoProvider`, not to a vendor SDK.

## Teacher dashboard (`teaching/index`)
Today's schedule, upcoming lessons, students, monthly + pending earnings, available
payout, rating, unread messages, availability gaps warning.

## Teacher → student detail (`teaching/students/[id]`)
Estimated level, nine-skill breakdown, recent mistakes, completed lessons, vocabulary in
review, learner goals, and an **assign** action (lesson / review / vocabulary / speaking /
writing / conversation) that writes `booking_assignments`.

## Admin CMS (`(admin)/…`)
Dashboard KPIs; content tree with drag-order; the **activity builder** (pick type → fill
prompt, answers, acceptable variants, hints, explanation, media, CEFR, skill, points,
time limit) with live preview using the real renderer; workflow buttons
Draft → Review → Approve → Publish → Archive; AI content assistant that proposes a unit
and requires human approval before anything can be published.
