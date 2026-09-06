import type { AuthoredGrammar } from '../../dsl/types';

/**
 * Spanish grammar topics.
 *
 * Each topic is a short explanation plus the mistakes learners actually make.
 * The explanation is never the lesson — it is the two minutes before the
 * learner starts producing the language (brief §22).
 */
export const ES_GRAMMAR: AuthoredGrammar[] = [
  {
    key: 'es-gender',
    title: 'Nouns have a gender',
    cefr: 'A1',
    summary: 'Every Spanish noun is masculine or feminine, and the article has to match.',
    explanation:
      'Spanish nouns carry a grammatical gender. Most nouns ending in -o are masculine (el libro) and most ending in -a are feminine (la casa), but the gender is a property of the word, not of the thing it names — la mesa is feminine, el día is masculine. Learn each noun together with its article rather than the noun alone.',
    examples: [
      { target: 'el libro', native: 'the book' },
      { target: 'la casa', native: 'the house' },
      { target: 'el día', native: 'the day' },
      { target: 'la mano', native: 'the hand' },
    ],
    commonMistakes: [
      { wrong: 'la libro', right: 'el libro', why: '"Libro" is masculine, so it takes "el".' },
      { wrong: 'el agua fría', right: 'el agua fría', why: '"Agua" is feminine but takes "el" in the singular for pronunciation; the adjective still agrees as feminine.' },
    ],
  },
  {
    key: 'es-ser-estar',
    title: 'ser and estar',
    cefr: 'A1',
    summary: 'Two verbs for "to be": ser for identity, estar for state and location.',
    explanation:
      'Use ser for who or what something is — name, origin, profession, permanent characteristics. Use estar for how or where something is — location, feelings, temporary conditions. "Soy alto" says I am a tall person; "estoy cansado" says I am tired right now.',
    examples: [
      { target: 'Soy de México.', native: "I'm from Mexico." },
      { target: 'Estoy en casa.', native: "I'm at home." },
      { target: 'Ella es profesora.', native: 'She is a teacher.' },
      { target: 'Estamos bien.', native: 'We are fine.' },
    ],
    commonMistakes: [
      { wrong: 'Soy cansado.', right: 'Estoy cansado.', why: 'Being tired is a temporary state, so it takes estar.' },
      { wrong: 'Estoy profesor.', right: 'Soy profesor.', why: 'A profession is identity, so it takes ser.' },
    ],
  },
  {
    key: 'es-present-ar',
    title: 'Present tense: -ar verbs',
    cefr: 'A1',
    summary: 'Drop -ar and add the ending that matches the person.',
    explanation:
      'Regular -ar verbs follow one pattern: hablo, hablas, habla, hablamos, habláis, hablan. Because the ending already says who is doing the action, Spanish usually drops the subject pronoun: "hablo español", not "yo hablo español", unless you want to emphasise the subject.',
    examples: [
      { target: 'Hablo español.', native: 'I speak Spanish.' },
      { target: '¿Trabajas aquí?', native: 'Do you work here?' },
      { target: 'Estudiamos por la noche.', native: 'We study in the evening.' },
    ],
    commonMistakes: [
      { wrong: 'Yo hablar español.', right: 'Hablo español.', why: 'The verb must be conjugated; the infinitive cannot be the main verb here.' },
      { wrong: 'Ellos habla español.', right: 'Ellos hablan español.', why: 'The third person plural ending is -an.' },
    ],
  },
  {
    key: 'es-present-er-ir',
    title: 'Present tense: -er and -ir verbs',
    cefr: 'A1',
    summary: 'Two more regular patterns, almost identical to each other.',
    explanation:
      '-er verbs: como, comes, come, comemos, coméis, comen. -ir verbs are the same except in the nosotros and vosotros forms: vivo, vives, vive, vivimos, vivís, viven.',
    examples: [
      { target: 'Como a la una.', native: 'I eat at one.' },
      { target: 'Vivimos en Madrid.', native: 'We live in Madrid.' },
      { target: '¿Dónde vives?', native: 'Where do you live?' },
    ],
    commonMistakes: [
      { wrong: 'Nosotros vivemos aquí.', right: 'Nosotros vivimos aquí.', why: '-ir verbs take -imos, not -emos, in the nosotros form.' },
    ],
  },
  {
    key: 'es-tener',
    title: 'tener and expressions with it',
    cefr: 'A1',
    summary: 'Spanish "has" age, hunger and cold rather than "being" them.',
    explanation:
      'Tener is irregular: tengo, tienes, tiene, tenemos, tenéis, tienen. It also carries several states that English expresses with "to be": tener años (age), tener hambre (hunger), tener sed (thirst), tener frío/calor (cold/hot), tener miedo (fear).',
    examples: [
      { target: 'Tengo veinticinco años.', native: "I'm twenty-five." },
      { target: 'Tenemos hambre.', native: "We're hungry." },
      { target: '¿Tienes frío?', native: 'Are you cold?' },
    ],
    commonMistakes: [
      { wrong: 'Soy veinticinco años.', right: 'Tengo veinticinco años.', why: 'Spanish expresses age with tener (to have), not ser (to be).' },
      { wrong: 'Estoy hambre.', right: 'Tengo hambre.', why: 'Hunger is something you have in Spanish.' },
    ],
  },
  {
    key: 'es-questions',
    title: 'Asking questions',
    cefr: 'A1',
    summary: 'No auxiliary "do"; question words carry an accent and questions open with ¿.',
    explanation:
      'Spanish forms questions by intonation or by starting with a question word: qué, quién, dónde, cuándo, cómo, por qué, cuánto. Written questions open with an inverted mark: ¿Dónde vives? There is no equivalent of English "do/does".',
    examples: [
      { target: '¿Dónde vives?', native: 'Where do you live?' },
      { target: '¿Cómo te llamas?', native: "What's your name?" },
      { target: '¿Cuánto cuesta?', native: 'How much does it cost?' },
    ],
    commonMistakes: [
      { wrong: '¿Haces tú hablar español?', right: '¿Hablas español?', why: 'Spanish has no auxiliary "do" in questions.' },
      { wrong: 'Donde vives?', right: '¿Dónde vives?', why: 'Question words take an accent, and the question opens with ¿.' },
    ],
  },
  {
    key: 'es-negation',
    title: 'Negation',
    cefr: 'A1',
    summary: 'Put "no" in front of the verb; double negatives are correct.',
    explanation:
      'Negate by placing no directly before the verb: No hablo francés. Unlike English, Spanish keeps the negative when another negative word is present: No tengo nada (literally "I don\'t have nothing" = I have nothing).',
    examples: [
      { target: 'No hablo francés.', native: "I don't speak French." },
      { target: 'No tengo nada.', native: 'I have nothing.' },
      { target: 'Nunca como carne.', native: 'I never eat meat.' },
    ],
    commonMistakes: [
      { wrong: 'Yo hablo no francés.', right: 'No hablo francés.', why: '"No" goes before the verb, not after it.' },
      { wrong: 'No tengo algo.', right: 'No tengo nada.', why: 'After a negative, Spanish uses the negative word nada.' },
    ],
  },
  {
    key: 'es-articles-plural',
    title: 'Articles and plurals',
    cefr: 'A1',
    summary: 'el/la/los/las and un/una/unos/unas, plus how to make a noun plural.',
    explanation:
      'Definite articles: el, la, los, las. Indefinite: un, una, unos, unas. Nouns ending in a vowel add -s (libro → libros); nouns ending in a consonant add -es (ciudad → ciudades). Words ending in -z change to -ces (lápiz → lápices).',
    examples: [
      { target: 'los libros', native: 'the books' },
      { target: 'unas ciudades', native: 'some cities' },
      { target: 'los lápices', native: 'the pencils' },
    ],
    commonMistakes: [
      { wrong: 'los ciudades', right: 'las ciudades', why: '"Ciudad" is feminine, so the plural article is "las".' },
    ],
  },
  {
    key: 'es-gustar',
    title: 'gustar and similar verbs',
    cefr: 'A1',
    summary: 'The thing you like is the subject: "me gusta el café" is "coffee pleases me".',
    explanation:
      'Gustar does not work like English "like". The thing being liked is the grammatical subject, and the person is an indirect object pronoun: me, te, le, nos, os, les. Singular thing → gusta; plural things → gustan.',
    examples: [
      { target: 'Me gusta el café.', native: 'I like coffee.' },
      { target: 'Nos gustan las películas.', native: 'We like films.' },
      { target: '¿Te gusta bailar?', native: 'Do you like dancing?' },
    ],
    commonMistakes: [
      { wrong: 'Yo gusto el café.', right: 'Me gusta el café.', why: 'The person is an indirect object (me), not the subject.' },
      { wrong: 'Me gusta las películas.', right: 'Me gustan las películas.', why: 'The verb agrees with the plural thing being liked.' },
    ],
  },
  {
    key: 'es-possessives',
    title: 'Possessive adjectives',
    cefr: 'A1',
    summary: 'mi, tu, su, nuestro — they agree with the thing owned, not the owner.',
    explanation:
      'mi/mis, tu/tus, su/sus, nuestro(a)(s), vuestro(a)(s), su/sus. They agree with what is owned: mis hermanos (my brothers) whether the speaker is one person or not. "Su" is ambiguous — his, her, their or your (formal) — so Spanish often clarifies with "de él", "de ella".',
    examples: [
      { target: 'mi hermana', native: 'my sister' },
      { target: 'nuestros amigos', native: 'our friends' },
      { target: 'su casa', native: 'his/her/their house' },
    ],
    commonMistakes: [
      { wrong: 'mis hermana', right: 'mi hermana', why: 'The possessive agrees in number with the noun: one sister, so "mi".' },
    ],
  },
  {
    key: 'es-preterite',
    title: 'The preterite: finished past actions',
    cefr: 'A2',
    summary: 'For completed events with a clear end: hablé, comí, viví.',
    explanation:
      'The preterite reports a finished action: -ar verbs take -é, -aste, -ó, -amos, -asteis, -aron; -er/-ir verbs take -í, -iste, -ió, -imos, -isteis, -ieron. Several very common verbs are irregular: ir and ser share fui, fuiste, fue; tener gives tuve; hacer gives hice; estar gives estuve.',
    examples: [
      { target: 'Ayer comí en un restaurante.', native: 'Yesterday I ate at a restaurant.' },
      { target: 'Fuimos al mercado.', native: 'We went to the market.' },
      { target: '¿Qué hiciste el fin de semana?', native: 'What did you do at the weekend?' },
    ],
    commonMistakes: [
      { wrong: 'Ayer como en un restaurante.', right: 'Ayer comí en un restaurante.', why: '"Ayer" marks a finished past action, so the verb must be in the preterite.' },
      { wrong: 'Yo fui muy cansado.', right: 'Yo estaba muy cansado.', why: 'A state in the past takes the imperfect, not the preterite.' },
    ],
  },
  {
    key: 'es-imperfect',
    title: 'The imperfect: background and habits',
    cefr: 'A2',
    summary: 'For what used to happen, or the scene around an event.',
    explanation:
      'The imperfect describes repeated past actions, ongoing background and states: -ar verbs take -aba endings, -er/-ir verbs take -ía endings. Only three verbs are irregular: ser (era), ir (iba), ver (veía). Contrast: "Comía cuando llamaste" — I was eating (imperfect) when you called (preterite).',
    examples: [
      { target: 'Cuando era niño, vivía en Lima.', native: 'When I was a child, I lived in Lima.' },
      { target: 'Siempre íbamos a la playa.', native: 'We always used to go to the beach.' },
    ],
    commonMistakes: [
      { wrong: 'Cuando fui niño, viví en Lima.', right: 'Cuando era niño, vivía en Lima.', why: 'Childhood is background, not a single finished event, so it takes the imperfect.' },
    ],
  },
  {
    key: 'es-future',
    title: 'Talking about the future',
    cefr: 'A2',
    summary: 'ir a + infinitive for plans; the simple future for predictions.',
    explanation:
      'The everyday way to talk about plans is ir a + infinitive: voy a viajar. The simple future adds endings to the whole infinitive (viajaré, viajarás…) and is used more for predictions, promises and formal writing.',
    examples: [
      { target: 'Voy a estudiar esta noche.', native: "I'm going to study tonight." },
      { target: 'Mañana lloverá.', native: 'It will rain tomorrow.' },
    ],
    commonMistakes: [
      { wrong: 'Voy estudiar esta noche.', right: 'Voy a estudiar esta noche.', why: 'The construction needs "a" between ir and the infinitive.' },
    ],
  },
  {
    key: 'es-object-pronouns',
    title: 'Direct and indirect object pronouns',
    cefr: 'A2',
    summary: 'lo, la, los, las for the thing; me, te, le, nos, les for the recipient.',
    explanation:
      'Object pronouns go before a conjugated verb (lo veo) or attach to an infinitive or gerund (voy a verlo, estoy viéndolo). When both appear, the indirect comes first: me lo das. "Le/les" become "se" before lo/la/los/las: se lo doy.',
    examples: [
      { target: 'Lo veo todos los días.', native: 'I see him every day.' },
      { target: 'Te lo explico.', native: "I'll explain it to you." },
    ],
    commonMistakes: [
      { wrong: 'Veo lo todos los días.', right: 'Lo veo todos los días.', why: 'The pronoun goes before the conjugated verb.' },
    ],
  },
  {
    key: 'es-comparatives',
    title: 'Comparatives and superlatives',
    cefr: 'A2',
    summary: 'más… que, menos… que, tan… como, and el/la más…',
    explanation:
      'Comparisons use más/menos + adjective + que, or tan + adjective + como for equality. Superlatives use the definite article: el más caro, la mejor opción. Mejor and peor replace "más bueno"/"más malo".',
    examples: [
      { target: 'Este hotel es más caro que el otro.', native: 'This hotel is more expensive than the other one.' },
      { target: 'Es tan alto como su padre.', native: "He's as tall as his father." },
    ],
    commonMistakes: [
      { wrong: 'Es más bueno que el otro.', right: 'Es mejor que el otro.', why: 'Spanish uses "mejor" rather than "más bueno".' },
    ],
  },
  {
    key: 'es-por-para',
    title: 'por and para',
    cefr: 'A2',
    summary: 'para for purpose and destination; por for cause, exchange and duration.',
    explanation:
      'Para points forward — a goal, a recipient, a deadline, a destination: "Es para ti", "Salgo para Madrid". Por looks at cause, means, exchange or duration: "Gracias por tu ayuda", "Pagué veinte euros por el libro", "Estudié por tres horas".',
    examples: [
      { target: 'Este regalo es para ti.', native: 'This present is for you.' },
      { target: 'Gracias por venir.', native: 'Thanks for coming.' },
    ],
    commonMistakes: [
      { wrong: 'Gracias para venir.', right: 'Gracias por venir.', why: 'Thanks is given for a cause, which takes "por".' },
    ],
  },
];
