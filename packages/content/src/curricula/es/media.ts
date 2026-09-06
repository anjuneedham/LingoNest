import type { AuthoredMedia } from '../../dsl/types';
import { ES_VOCABULARY } from './vocabulary';

/**
 * Media manifest for Spanish.
 *
 * Every asset declares its provenance and licence, because the validator (and a
 * database trigger) refuse to publish a lesson that references media with an
 * unknown licence. Nothing here points at a third-party recording: word and
 * dialogue audio is produced by the project's own TTS pipeline
 * (`scripts/generate-audio.ts`, see docs/SETUP.md) with commercially licensed
 * voices, and the manifest records which voice produced each file.
 */

const TTS_SOURCE = 'lingonest-tts-pipeline';
const TTS_LICENCE = 'proprietary-generated';

/** One audio file per vocabulary item, spoken slowly for beginners. */
const vocabularyAudio: AuthoredMedia[] = ES_VOCABULARY.filter((v) => v.audio).map((v) => ({
  key: v.audio!,
  kind: 'audio',
  path: `audio/${v.audio}.m4a`,
  source: TTS_SOURCE,
  licence: TTS_LICENCE,
  voice: 'es-419-female-1',
  speed: 'slow',
  transcript: v.term,
}));

interface DialogueSpec {
  readonly key: string;
  readonly transcript: string;
  readonly speeds?: readonly ('slow' | 'normal' | 'natural')[];
  readonly voice?: string;
  readonly variantCode?: string;
}

/**
 * Listening material. Each dialogue is rendered at more than one speed so the
 * same content serves a beginner and a B2 learner (brief §23).
 */
const DIALOGUES: DialogueSpec[] = [
  { key: 'es/pre-a1/u1/greetings', transcript: '— ¡Hola! — Hola, buenos días. — Adiós. — Hasta luego.' },
  { key: 'es/pre-a1/u1/courtesy', transcript: '— Gracias. — De nada. — Por favor. — Perdón.' },
  { key: 'es/pre-a1/u2/alphabet-vowels', transcript: 'a, e, i, o, u' },
  { key: 'es/pre-a1/u2/rr-sound', transcript: 'perro, carro, arroz, correr' },
  { key: 'es/pre-a1/u3/numbers-1-10', transcript: 'uno, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez' },
  { key: 'es/pre-a1/u4/classroom', transcript: '— No entiendo. — Repite, por favor. — ¿Cómo se dice "book" en español? — Se dice "libro".' },

  { key: 'es/a1/u1/introductions', transcript: '— Hola, me llamo María. ¿Y tú? — Me llamo Daniel. Mucho gusto. — Encantada.', speeds: ['slow', 'normal'] },
  { key: 'es/a1/u1/where-from', transcript: '— ¿De dónde eres? — Soy de Colombia. ¿Y tú? — Yo soy de México.', speeds: ['slow', 'normal'] },
  { key: 'es/a1/u1/how-are-you', transcript: '— ¿Cómo estás? — Muy bien, gracias. ¿Y tú? — Más o menos.' },
  { key: 'es/a1/u2/family', transcript: '— ¿Tienes hermanos? — Sí, tengo dos hermanas y un hermano. — ¿Cuántos años tienen? — Mi hermana mayor tiene treinta años.', speeds: ['slow', 'normal'] },
  { key: 'es/a1/u3/daily-routine', transcript: 'Me levanto a las siete. Trabajo en una oficina. Como a la una y estudio español por la noche.', speeds: ['slow', 'normal'] },
  { key: 'es/a1/u4/cafe', transcript: '— Buenos días. ¿Qué le pongo? — Quisiera un café con leche, por favor. — ¿Algo más? — No, gracias. ¿Cuánto es? — Son dos euros cincuenta.', speeds: ['slow', 'normal'] },
  { key: 'es/a1/u5/market', transcript: '— ¿Cuánto cuesta el kilo de fruta? — Tres euros. — Es un poco caro. ¿Tiene algo más barato? — Sí, estas están a dos.', speeds: ['slow', 'normal'] },
  { key: 'es/a1/u6/directions', transcript: '— Perdón, ¿dónde está la estación? — Todo recto y luego a la izquierda. Está muy cerca.', speeds: ['slow', 'normal'] },
  { key: 'es/a1/u7/home', transcript: 'Vivo en un apartamento pequeño. Tiene dos habitaciones, una cocina y un baño.', speeds: ['slow', 'normal'] },
  { key: 'es/a1/u8/work', transcript: '— ¿En qué trabajas? — Soy ingeniera. Trabajo en una oficina en el centro. — ¿Y estudias? — Sí, estudio inglés los martes.', speeds: ['slow', 'normal'] },
  { key: 'es/a1/u9/time', transcript: '— ¿Qué hora es? — Son las cuatro y media. — ¿La clase es el lunes? — No, es el miércoles a las seis.', speeds: ['slow', 'normal'] },
  { key: 'es/a1/u10/review-dialogue', transcript: '— Hola, buenas tardes. Quisiera una habitación para dos noches. — ¿A nombre de quién? — De Ana Ruiz. — Muy bien. Son cien euros.', speeds: ['slow', 'normal'] },

  { key: 'es/a2/u1/restaurant-order', transcript: '— Buenas tardes. ¿Ya sabe qué va a pedir? — Sí, de primero una ensalada y de segundo el pollo con arroz. — ¿Y para beber? — Agua, por favor.', speeds: ['normal', 'natural'] },
  { key: 'es/a2/u1/restaurant-question', transcript: '— ¿Qué lleva la ensalada de la casa? — Lleva tomate, cebolla y queso. — Perfecto, entonces esa.', speeds: ['normal'] },
  { key: 'es/a2/u2/weekend-past', transcript: '— ¿Qué hiciste el fin de semana? — Fui a la playa con mi familia. Comimos en un restaurante y volvimos el domingo por la noche.', speeds: ['normal', 'natural'] },
  { key: 'es/a2/u3/travel-problem', transcript: '— Mi vuelo tuvo un retraso de tres horas y perdí la conexión. — Lo siento. Le puedo poner en el vuelo de mañana a las ocho.', speeds: ['normal', 'natural'] },
  { key: 'es/a2/u4/doctor', transcript: '— ¿Qué le pasa? — Me duele la cabeza desde ayer y no dormí bien. — ¿Tiene fiebre? — No, creo que no.', speeds: ['normal'] },
  { key: 'es/a2/u5/appointment', transcript: '— ¿Quedamos el jueves a las siete? — El jueves no puedo. ¿Te va bien el viernes? — Sí, perfecto.', speeds: ['normal'] },
];

const dialogueAudio: AuthoredMedia[] = DIALOGUES.flatMap((d) =>
  (d.speeds ?? ['normal']).map((speed) => ({
    key: speed === 'normal' ? d.key : `${d.key}-${speed}`,
    kind: 'audio' as const,
    path: `audio/${d.key}${speed === 'normal' ? '' : `-${speed}`}.m4a`,
    source: TTS_SOURCE,
    licence: TTS_LICENCE,
    voice: d.voice ?? 'es-419-multi',
    speed,
    transcript: d.transcript,
    ...(d.variantCode ? { variantCode: d.variantCode } : {}),
  })),
);

/** Illustrations used by image-matching activities. */
const IMAGE_KEYS = [
  'es/img/agua', 'es/img/pan', 'es/img/casa', 'es/img/libro', 'es/img/cafe',
  'es/img/leche', 'es/img/pollo', 'es/img/arroz', 'es/img/ensalada', 'es/img/fruta',
  'es/img/mesa', 'es/img/silla', 'es/img/puerta', 'es/img/ventana', 'es/img/cocina',
  'es/img/familia', 'es/img/hermana', 'es/img/abuelo', 'es/img/coche', 'es/img/autobus',
];

const imageAssets: AuthoredMedia[] = IMAGE_KEYS.map((key) => ({
  key,
  kind: 'image' as const,
  path: `images/${key}.webp`,
  source: 'lingonest-illustration-set',
  licence: 'proprietary-commissioned',
  attribution: 'Commissioned illustration set, all rights held by the platform',
}));

export const ES_MEDIA: AuthoredMedia[] = [...vocabularyAudio, ...dialogueAudio, ...imageAssets];
