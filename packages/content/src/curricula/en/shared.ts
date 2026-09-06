import type { AuthoredCulture, AuthoredGrammar, AuthoredMedia, AuthoredScenario, AuthoredVocabulary } from '../../dsl/types';

/**
 * English for speakers of other languages.
 *
 * The largest learner group in the US market is immigrants learning English,
 * so this curriculum is built around the situations that matter first:
 * introducing yourself, work, appointments, housing and school.
 */

const v = (
  key: string,
  term: string,
  translation: string,
  cefr: AuthoredVocabulary['cefr'],
  categories: string[],
  extra: Partial<AuthoredVocabulary> = {},
): AuthoredVocabulary => ({ key, term, translation, cefr, categories, audio: `en/vocab/${key}`, ...extra });

export const EN_VOCABULARY: AuthoredVocabulary[] = [
  v('hello', 'hello', 'a greeting used at any time', 'PRE_A1', ['greetings']),
  v('goodbye', 'goodbye', 'said when leaving', 'PRE_A1', ['greetings']),
  v('please', 'please', 'added to a request', 'PRE_A1', ['greetings']),
  v('thank-you', 'thank you', 'said to show gratitude', 'PRE_A1', ['greetings']),
  v('sorry', 'sorry', 'an apology, or "excuse me"', 'PRE_A1', ['greetings']),
  v('yes', 'yes', 'agreement', 'PRE_A1', ['greetings']),
  v('no', 'no', 'refusal', 'PRE_A1', ['greetings']),
  v('my-name-is', 'my name is', 'used to introduce yourself', 'PRE_A1', ['greetings']),
  v('nice-to-meet-you', 'nice to meet you', 'said when meeting someone', 'A1', ['greetings']),
  v('how-are-you', 'how are you?', 'asking about someone’s wellbeing', 'A1', ['greetings']),
  v('excuse-me', 'excuse me', 'used to get attention politely', 'A1', ['greetings']),
  v('water', 'water', 'the drink', 'PRE_A1', ['drinks']),
  v('bread', 'bread', 'a basic food', 'PRE_A1', ['food']),
  v('one', 'one', 'the number 1', 'PRE_A1', ['numbers']),
  v('two', 'two', 'the number 2', 'PRE_A1', ['numbers']),
  v('three', 'three', 'the number 3', 'PRE_A1', ['numbers']),
  v('ten', 'ten', 'the number 10', 'PRE_A1', ['numbers']),
  v('twenty', 'twenty', 'the number 20', 'A1', ['numbers']),
  v('family', 'family', 'the people you are related to', 'A1', ['family']),
  v('mother', 'mother', 'a female parent', 'A1', ['family']),
  v('father', 'father', 'a male parent', 'A1', ['family']),
  v('brother', 'brother', 'a male sibling', 'A1', ['family']),
  v('sister', 'sister', 'a female sibling', 'A1', ['family']),
  v('work', 'work', 'a job, or to do a job', 'A1', ['work']),
  v('job', 'job', 'paid employment', 'A1', ['work']),
  v('manager', 'manager', 'the person who leads a team', 'A1', ['work']),
  v('shift', 'shift', 'a period of work', 'A1', ['work'], { example: 'My shift starts at seven.' }),
  v('schedule', 'schedule', 'a plan of times', 'A1', ['work', 'time'], { variantOverrides: { 'en-GB': 'timetable' } }),
  v('appointment', 'appointment', 'an arranged meeting at a set time', 'A1', ['health', 'work']),
  v('landlord', 'landlord', 'the person who owns a rented home', 'A2', ['home']),
  v('rent', 'rent', 'money paid for a home', 'A2', ['home']),
  v('lease', 'lease', 'the rental agreement', 'A2', ['home']),
  v('deposit', 'deposit', 'money held as security', 'A2', ['home', 'shopping']),
  v('bill', 'bill', 'a request for payment', 'A2', ['home', 'shopping'], { variantOverrides: { 'en-US': 'check (restaurant) / bill (utilities)' } }),
  v('prescription', 'prescription', 'a doctor’s written order for medicine', 'A2', ['health']),
  v('symptom', 'symptom', 'a sign of illness', 'A2', ['health']),
  v('insurance', 'insurance', 'cover that pays costs', 'A2', ['health', 'work']),
  v('deadline', 'deadline', 'the latest time something can be done', 'A2', ['work']),
  v('overtime', 'overtime', 'work beyond normal hours', 'A2', ['work']),
  v('paycheck', 'paycheck', 'payment for work', 'A2', ['work'], { variantOverrides: { 'en-GB': 'payslip' } }),
];

export const EN_GRAMMAR: AuthoredGrammar[] = [
  {
    key: 'en-be',
    title: 'The verb "to be"',
    cefr: 'PRE_A1',
    summary: 'am, is, are — the most common verb in English, and irregular.',
    explanation:
      'I am, you are, he/she/it is, we are, they are. English needs the verb even when other languages drop it: "I am tired", never "I tired". Contractions are normal in speech: I\'m, you\'re, he\'s.',
    examples: [
      { target: 'I am from Mexico.', native: 'Origin' },
      { target: 'She is a nurse.', native: 'Profession' },
      { target: 'They are at work.', native: 'Location' },
    ],
    commonMistakes: [
      { wrong: 'I tired.', right: "I'm tired.", why: 'English always needs the verb "to be" here.' },
      { wrong: 'She have 25 years.', right: 'She is 25 years old.', why: 'English expresses age with "be", not "have".' },
    ],
  },
  {
    key: 'en-articles',
    title: 'a, an and the',
    cefr: 'A1',
    summary: 'a/an for something new or unspecified, the for something already known.',
    explanation:
      'Use a/an the first time you mention a countable thing, and the once the listener knows which one. "An" comes before a vowel sound, not just a vowel letter: an hour, a university. Many languages have no articles, which makes this one of the longest-running English errors.',
    examples: [
      { target: 'I need a doctor.', native: 'Any doctor' },
      { target: 'The doctor said to rest.', native: 'The specific one I saw' },
      { target: 'I waited an hour.', native: '"Hour" starts with a vowel sound' },
    ],
    commonMistakes: [
      { wrong: 'I am nurse.', right: 'I am a nurse.', why: 'A countable profession needs an article in English.' },
      { wrong: 'I have a information.', right: 'I have some information.', why: '"Information" is uncountable and takes no article.' },
    ],
  },
  {
    key: 'en-present-simple',
    title: 'Present simple',
    cefr: 'A1',
    summary: 'For habits and facts — and do not forget the -s in he/she/it.',
    explanation:
      'I work, you work, he works. The third person -s is small but very noticeable to a native listener. Questions and negatives use do/does: "Do you work here?", "She doesn\'t work Fridays".',
    examples: [
      { target: 'I start at eight.', native: 'A regular habit' },
      { target: 'He works nights.', native: 'Third person -s' },
      { target: 'Do you speak Spanish?', native: 'Question with do' },
    ],
    commonMistakes: [
      { wrong: 'He work at the hospital.', right: 'He works at the hospital.', why: 'Third person singular takes -s.' },
      { wrong: 'You speak Spanish?', right: 'Do you speak Spanish?', why: 'English questions need the auxiliary "do".' },
    ],
  },
  {
    key: 'en-past-simple',
    title: 'Past simple',
    cefr: 'A2',
    summary: '-ed for regular verbs, and a list of irregulars worth learning.',
    explanation:
      'Regular verbs add -ed: worked, called, arrived. Many common verbs are irregular: go→went, have→had, see→saw, take→took. Negatives and questions use "did" plus the base form: "I didn\'t go", "Did you call?" — never "didn\'t went".',
    examples: [
      { target: 'I worked late yesterday.', native: 'Regular' },
      { target: 'She went to the clinic.', native: 'Irregular' },
      { target: "I didn't see the message.", native: 'Negative with did' },
    ],
    commonMistakes: [
      { wrong: "I didn't went.", right: "I didn't go.", why: 'After "did", the verb returns to its base form.' },
      { wrong: 'Yesterday I go to work.', right: 'Yesterday I went to work.', why: '"Yesterday" requires the past tense.' },
    ],
  },
  {
    key: 'en-modals-requests',
    title: 'Polite requests',
    cefr: 'A2',
    summary: 'can, could, would — the difference between direct and polite.',
    explanation:
      '"Can you…?" is neutral. "Could you…?" and "Would you mind…?" are politer and safer with a stranger, a manager or an official. Adding "please" helps, but the modal does most of the work. A bare imperative ("Give me the form") sounds rude in almost every English-speaking workplace.',
    examples: [
      { target: 'Could you repeat that, please?', native: 'Polite request' },
      { target: 'Would you mind checking?', native: 'Very polite' },
      { target: 'Can I have the form?', native: 'Neutral' },
    ],
    commonMistakes: [
      { wrong: 'Repeat that.', right: 'Could you repeat that, please?', why: 'The bare imperative reads as an order rather than a request.' },
    ],
  },
];

export const EN_CULTURE: AuthoredCulture[] = [
  {
    key: 'en-small-talk',
    title: '"How are you?" is not always a question',
    cefr: 'A1',
    topic: 'social norms',
    variantCodes: ['en-US'],
    body:
      'In the United States, "How are you?" and "How\'s it going?" often function as greetings rather than genuine questions. A short "Good, thanks — you?" is the expected reply, even from someone who does not know you. A detailed answer about your health can be surprising in a shop or a corridor, though it is welcome from a friend.',
  },
  {
    key: 'en-workplace-directness',
    title: 'Directness at work',
    cefr: 'A2',
    topic: 'work culture',
    variantCodes: ['en-US'],
    body:
      'American workplaces tend to value saying what you need clearly and early, but wrapped in polite framing: "I wanted to check whether…" or "Would it be possible to…". Being indirect to the point of vagueness can be read as evasive; being blunt without the framing can be read as rude. The framing, not the content, is where the politeness lives.',
  },
  {
    key: 'en-appointments',
    title: 'Appointments and punctuality',
    cefr: 'A1',
    topic: 'social norms',
    variantCodes: ['en-US'],
    body:
      'For medical, official and professional appointments in the US, arrive five to ten minutes early; being late by more than a few minutes may mean losing the slot. For a social invitation to someone\'s home, arriving exactly on time is fine and ten minutes late is normal.',
  },
  {
    key: 'en-us-uk-vocabulary',
    title: 'The same thing, different words',
    cefr: 'A1',
    topic: 'regional differences',
    variantCodes: [],
    body:
      'US and UK English differ in everyday words: apartment/flat, elevator/lift, line/queue, check/bill (in a restaurant), vacation/holiday, schedule/timetable, résumé/CV. Both are understood almost everywhere, but picking one consistently makes you easier to follow.',
  },
];

export const EN_SCENARIOS: AuthoredScenario[] = [
  {
    key: 'en-first-day-introductions',
    title: 'Meeting a new colleague',
    setting: 'Your first day at a new job. Someone stops by your desk.',
    partnerRole: 'A friendly colleague making small talk',
    learnerRole: 'A new employee',
    cefr: 'A1',
    goals: ['Greet them', 'Say your name and role', 'Ask a question back'],
    openingLine: "Hi! You must be new — I'm Sam. How's your first day going?",
    vocabulary: ['hello', 'my-name-is', 'nice-to-meet-you', 'work'],
  },
  {
    key: 'en-doctor-appointment',
    title: 'Booking a medical appointment',
    setting: 'You are calling a clinic to book an appointment.',
    partnerRole: 'A receptionist who asks for details',
    learnerRole: 'A patient',
    cefr: 'A2',
    goals: ['Say why you are calling', 'Describe the symptom', 'Agree a date and time', 'Confirm what to bring'],
    openingLine: 'Good morning, Riverside Clinic. How can I help you?',
    complications: ['The first time offered does not work for the learner'],
    vocabulary: ['appointment', 'symptom', 'prescription', 'insurance'],
  },
  {
    key: 'en-landlord-repair',
    title: 'Reporting a repair to a landlord',
    setting: 'The heating in your apartment has stopped working.',
    partnerRole: 'A landlord who is slow to commit to a date',
    learnerRole: 'A tenant',
    cefr: 'A2',
    goals: ['Explain the problem', 'Say how long it has been happening', 'Ask when it will be fixed', 'Agree a time'],
    openingLine: 'Hello? Yes, this is the landlord.',
    complications: ['The landlord suggests a time when the learner is at work'],
    vocabulary: ['landlord', 'rent', 'lease'],
  },
  {
    key: 'en-shift-change',
    title: 'Asking to change a shift',
    setting: 'You need to swap a shift with a colleague and clear it with your manager.',
    partnerRole: 'A manager who needs a reason and a replacement',
    learnerRole: 'An employee',
    cefr: 'A2',
    goals: ['Make a polite request', 'Give a reason', 'Propose a solution', 'Confirm the outcome'],
    openingLine: 'Sure, what did you need?',
    complications: ['The manager asks who will cover the shift'],
    vocabulary: ['shift', 'schedule', 'manager', 'overtime'],
  },
];

const TTS_SOURCE = 'lingonest-tts-pipeline';
const TTS_LICENCE = 'proprietary-generated';

const vocabularyAudio: AuthoredMedia[] = EN_VOCABULARY.filter((item) => item.audio).map((item) => ({
  key: item.audio!,
  kind: 'audio',
  path: `audio/${item.audio}.m4a`,
  source: TTS_SOURCE,
  licence: TTS_LICENCE,
  voice: 'en-US-female-1',
  speed: 'slow',
  transcript: item.term,
}));

const DIALOGUES: { key: string; transcript: string; speeds?: ('slow' | 'normal' | 'natural')[] }[] = [
  { key: 'en/pre-a1/u1/greetings', transcript: '— Hello. — Hi, good morning. — Goodbye. — See you later.' },
  { key: 'en/pre-a1/u1/courtesy', transcript: '— Thank you. — You’re welcome. — Please. — Sorry.' },
  { key: 'en/a1/u1/introductions', transcript: '— Hi, I’m Ana. — Nice to meet you, Ana. I’m Chris. — Nice to meet you too.', speeds: ['slow', 'normal'] },
  { key: 'en/a1/u2/workplace', transcript: '— What do you do? — I’m a nurse. I work nights at the hospital. — That’s a hard schedule.', speeds: ['slow', 'normal'] },
  { key: 'en/a1/u3/appointment', transcript: '— I’d like to make an appointment. — Sure. Is Tuesday at ten all right? — Could we do the afternoon instead?', speeds: ['slow', 'normal'] },
  { key: 'en/a2/u1/repair', transcript: '— The heating hasn’t worked since Friday. — I’ll send someone Thursday morning. — I’m at work then. Could it be after five?', speeds: ['normal', 'natural'] },
  { key: 'en/a2/u2/shift', transcript: '— Could I swap Saturday with Maria? — Does she agree? — Yes, she already said she can cover it.', speeds: ['normal', 'natural'] },
];

const dialogueAudio: AuthoredMedia[] = DIALOGUES.flatMap((d) =>
  (d.speeds ?? ['normal']).map((speed) => ({
    key: speed === 'normal' ? d.key : `${d.key}-${speed}`,
    kind: 'audio' as const,
    path: `audio/${d.key}${speed === 'normal' ? '' : `-${speed}`}.m4a`,
    source: TTS_SOURCE,
    licence: TTS_LICENCE,
    voice: 'en-US-multi',
    speed,
    transcript: d.transcript,
  })),
);

export const EN_MEDIA: AuthoredMedia[] = [
  ...vocabularyAudio,
  ...dialogueAudio,
  ...['en/img/water', 'en/img/bread', 'en/img/family', 'en/img/work'].map((key) => ({
    key,
    kind: 'image' as const,
    path: `images/${key}.webp`,
    source: 'lingonest-illustration-set',
    licence: 'proprietary-commissioned',
  })),
];
