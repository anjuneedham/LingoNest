# 5. Navigation Map

Expo Router, file-based. `(group)` folders do not appear in the URL.

```
app/
├── _layout.tsx                     root: providers, session gate, deep links
├── index.tsx                       splash → routes by session + onboarding state
│
├── (auth)/
│   ├── sign-in           ├── sign-up          ├── forgot-password
│   └── verify-email
│
├── (onboarding)/
│   ├── welcome           what LingoNest is, the Learn→Practice→Apply→Connect loop
│   ├── language          pick target language
│   ├── variant           pick regional variant (es-MX vs es-ES …)
│   ├── reason            travel / work / family / exam / culture
│   ├── level             "I'm new" | "I know some" → placement, or skip
│   ├── placement         adaptive placement assessment
│   ├── results           estimated level + per-skill estimates
│   └── goal              daily minutes, reminder time, notification permission
│
├── (tabs)/                         bottom tab bar
│   ├── index             HOME      today's plan, continue, review due, next tutor lesson
│   ├── learn             LEARN     level → course → unit → lesson tree
│   ├── practice          PRACTICE  AI conversation, review, speaking, writing, mistakes
│   ├── teachers          TEACHERS  marketplace search + filters
│   └── profile           PROFILE   levels, skills, achievements, subscription, settings
│
├── lesson/[lessonId]/
│   ├── index             lesson intro (objective, vocabulary preview, duration)
│   ├── play              the activity player (stage machine, one activity at a time)
│   └── summary           score, mistakes, what improved, next step
│
├── practice/
│   ├── conversation/[scenarioId]   AI roleplay (text + voice)
│   ├── review                      SRS session for due vocabulary
│   ├── speaking                    pronunciation + speech response drills
│   ├── writing                     guided writing with AI feedback
│   ├── listening                   graded listening at chosen speed
│   ├── grammar/[topicId]
│   ├── mistakes                    replay of user_mistakes
│   └── quick                       5-minute adaptive mix
│
├── assessment/[assessmentId]       checkpoint runner + result
│
├── teacher/[teacherId]/
│   ├── index             profile, video, reviews, packages
│   ├── availability      calendar in the learner's timezone
│   └── book              slot → package/single → payment → confirmation
│
├── bookings/
│   ├── index             upcoming + past
│   └── [bookingId]       detail, reschedule, cancel (shows refund policy outcome)
│
├── room/[bookingId]      live lesson room (video, chat, shared notes, timer)
│
├── messages/
│   ├── index             conversation list
│   └── [conversationId]
│
├── community/
│   ├── index             groups
│   ├── [groupId]         feed
│   └── post/[postId]     thread + report/block
│
├── teaching/                       visible only with the `teacher` role
│   ├── index             dashboard: today, earnings, rating, messages
│   ├── apply             teacher application wizard
│   ├── schedule          availability editor
│   ├── students/[id]     learner progress + skill breakdown + assign homework
│   ├── earnings          balance, payouts, commission tier
│   └── settings          rates, packages, specialties, payout account
│
├── (admin)/                        role-gated; primary target is web
│   ├── index             KPI dashboard
│   ├── content/…         languages, courses, units, lessons, activity builder, preview
│   ├── users  ├── teachers  ├── applications  ├── moderation
│   ├── bookings ├── payments ├── subscriptions ├── refunds ├── payouts
│   ├── promotions ├── referrals
│   └── config            remote config: prices, commission tiers, AI limits, flags
│
├── paywall               plan comparison + purchase
├── settings/…            account, notifications, accessibility, privacy, language of UI
└── +not-found
```

## Navigation rules

- **Tab bar is always five items** (§55). Community is reachable from Home and Learn, not a
  sixth tab.
- **The lesson player is a modal-style stack** with a progress bar and an explicit exit
  confirmation; it never lets the learner get lost mid-lesson (§96).
- **Role-gated groups** (`teaching/`, `(admin)/`) are removed from the router tree when the
  role is absent — not merely hidden — and the server enforces the same via RLS.
- **Deep links**: `lingonest://lesson/<id>`, `lingonest://room/<bookingId>`,
  `lingonest://review`, `lingonest://invite/<code>`. Notification taps resolve here.
- **Every route defines loading / empty / error / retry states** (§89) through the shared
  `<Screen>` wrapper, which requires them as props.
