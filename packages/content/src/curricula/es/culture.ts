import type { AuthoredCulture } from '../../dsl/types';

/**
 * Cultural notes for Spanish.
 *
 * Every note declares which variants it applies to. Presenting one country's
 * usage as "Spanish" is exactly what the brief rules out (§27), so a note about
 * vosotros is tagged es-ES and a note about "ahorita" is tagged es-MX.
 */
export const ES_CULTURE: AuthoredCulture[] = [
  {
    key: 'es-greeting-customs',
    title: 'Greeting people',
    cefr: 'PRE_A1',
    topic: 'etiquette',
    variantCodes: [],
    body:
      'A greeting is expected before anything else — walking into a small shop and starting with your request, without "buenos días", reads as brusque across the Spanish-speaking world. How people greet physically varies: one kiss on the cheek is common between women and between a woman and a man in much of Latin America, two kisses in Spain, and a handshake in most professional settings anywhere. When in doubt, follow the other person.',
  },
  {
    key: 'es-tu-usted',
    title: 'tú or usted?',
    cefr: 'A1',
    topic: 'register',
    variantCodes: [],
    body:
      'Tú is informal, usted is formal. The line sits in different places by country: Colombia and much of Central America use usted widely, even between friends and family; Spain and Argentina lean informal quickly, and in Argentina tú is largely replaced by vos with its own verb forms (vos hablás, vos tenés). The safe default with someone older, in a shop, or in any professional context is usted, and let them invite you to switch.',
  },
  {
    key: 'es-vosotros',
    title: 'vosotros, and where it is not used',
    cefr: 'A1',
    topic: 'register',
    variantCodes: ['es-ES'],
    body:
      'Spain uses vosotros for an informal group ("¿vosotros venís?"). Latin America does not: ustedes covers both formal and informal plural everywhere else. Neither is more correct — but a learner who only knows vosotros will sound out of place in Mexico City, and one who never encounters it will be confused in Madrid.',
  },
  {
    key: 'es-meal-times',
    title: 'When people eat',
    cefr: 'A1',
    topic: 'food',
    variantCodes: [],
    body:
      'Meal times shift what "lunch" and "dinner" mean. In Spain the main meal is around 14:00–15:00 and dinner rarely starts before 21:00. In Mexico the comida is usually 14:00–16:00. In much of the Andes and the Southern Cone dinner is earlier. Arriving at a Madrid restaurant at 19:00 expecting dinner usually means an empty dining room.',
  },
  {
    key: 'es-restaurant-bill',
    title: 'Asking for the bill',
    cefr: 'A1',
    topic: 'food',
    variantCodes: [],
    body:
      'A server will not bring the bill until you ask — leaving it on the table would be rushing you out. "La cuenta, por favor" is the standard phrase. Tipping expectations differ sharply: around 10% is normal in Mexico and much of Latin America, while in Spain rounding up or leaving small change is common and 10% is generous.',
  },
  {
    key: 'es-ahorita',
    title: '"Ahorita" does not mean "right now"',
    cefr: 'A2',
    topic: 'slang',
    variantCodes: ['es-MX', 'es-419'],
    body:
      'In Mexico and much of Central America, ahorita can mean "in a moment", "later today", or politely "no". "¿Quieres más?" — "Ahorita no, gracias." Reading it as a literal "right now" leads to a lot of waiting. In the Caribbean, ahorita can even mean "a while ago".',
  },
  {
    key: 'es-punctuality',
    title: 'Time and punctuality',
    cefr: 'A2',
    topic: 'social norms',
    variantCodes: [],
    body:
      'For a professional appointment, be on time everywhere. For a social invitation, arriving exactly on time can be early: in much of Latin America and Spain, 15–30 minutes after the stated time is normal for a dinner at someone\'s home. If the host says "a las nueve", they usually do not mean 21:00 sharp.',
  },
  {
    key: 'es-formal-email',
    title: 'Writing a formal message',
    cefr: 'A2',
    topic: 'work culture',
    variantCodes: [],
    body:
      'Formal Spanish correspondence is more elaborate than its English equivalent. "Estimado/a [name]" opens; "Un cordial saludo", "Saludos cordiales" or "Atentamente" closes. Jumping straight to the request without a courtesy line reads as abrupt, and using someone\'s first name without invitation can be too familiar in Mexico or Colombia.',
  },
  {
    key: 'es-false-friends',
    title: 'Words that look familiar but are not',
    cefr: 'A2',
    topic: 'vocabulary',
    variantCodes: [],
    body:
      'Some words look like English and mean something else: embarazada is pregnant, not embarrassed; actualmente is currently, not actually; realizar is to carry out, not to realise; molestar is to bother, not to molest; éxito is success, not exit; sensible means sensitive. These are worth learning deliberately, because they are the mistakes that land hardest in conversation.',
  },
  {
    key: 'es-regional-vocabulary',
    title: 'The same thing, different words',
    cefr: 'A1',
    topic: 'regional differences',
    variantCodes: [],
    body:
      'Everyday objects change name across regions: coche (Spain) / carro (Mexico, much of Latin America) / auto (Southern Cone); autobús / camión (Mexico) / colectivo (Argentina) / guagua (Caribbean, Canary Islands); zumo (Spain) / jugo (Latin America); billete (Spain) / boleto (Latin America). Everyone will understand you either way; picking your variant just means sounding like you learned somewhere in particular.',
  },
  {
    key: 'es-diminutives',
    title: 'Diminutives do more than mean "small"',
    cefr: 'B1',
    topic: 'register',
    variantCodes: [],
    body:
      'The -ito/-ita ending softens rather than shrinks. "Un momentito" is not a smaller moment, it is a politer one; "¿Me das un cafecito?" is warmer than "un café". Overusing it in a formal or professional register sounds unserious, but in everyday conversation its absence can sound curt.',
  },
];
