import type { Cefr } from './levels';
import type { Skill } from '../skills/skills';

/**
 * Language-neutral "can-do" descriptors, phrased in the first person so they can
 * be shown directly to a learner ("I can …"). These are our own plain-language
 * summaries used to explain what a level means inside the product; they are not
 * a reproduction of any official descriptor set, and they never assert
 * certification.
 *
 * Language teams may override any entry via content (`levels.can_do` jsonb).
 */
export type CanDoMap = Partial<Record<Skill, string>>;

export const CAN_DO: Record<Cefr, { summary: string; skills: CanDoMap }> = {
  PRE_A1: {
    summary: 'I am starting out: I can recognise sounds, letters and a handful of everyday words.',
    skills: {
      listening: 'I can recognise familiar words when someone speaks slowly and clearly.',
      reading: 'I can recognise letters, numbers and a few written words.',
      speaking: 'I can say greetings and a few memorised words.',
      writing: 'I can write letters, numbers and my own name.',
      vocabulary: 'I know a small set of everyday words.',
      pronunciation: 'I can imitate basic sounds of the language.',
    },
  },
  A1: {
    summary: 'I can handle simple, everyday exchanges if the other person speaks slowly.',
    skills: {
      listening: 'I can understand slow, clear speech about myself, my family and my surroundings.',
      reading: 'I can understand short, simple texts such as signs, menus and messages.',
      speaking: 'I can introduce myself, ask and answer simple personal questions.',
      writing: 'I can write short messages and fill in personal details on a form.',
      grammar: 'I can use the present tense, basic questions and negation.',
      interaction: 'I can interact simply if the other person repeats or rephrases.',
    },
  },
  A2: {
    summary: 'I can deal with routine situations such as shopping, travel and simple work talk.',
    skills: {
      listening: 'I can catch the main point of short, clear messages and announcements.',
      reading: 'I can read short everyday texts and find specific information in them.',
      speaking: 'I can describe my background, routine and immediate needs.',
      writing: 'I can write short notes, messages and simple descriptions of past events.',
      grammar: 'I can talk about the past and near future.',
      mediation: 'I can pass on simple information from one person to another.',
    },
  },
  A2_PLUS: {
    summary: 'I handle routine situations comfortably and am starting to connect longer ideas.',
    skills: {
      speaking: 'I can keep a simple conversation going and give short reasons for my opinions.',
      writing: 'I can write a connected paragraph about familiar topics.',
    },
  },
  B1: {
    summary: 'I can cope independently with most situations that come up while travelling or working.',
    skills: {
      listening: 'I can follow the main points of clear standard speech on familiar matters.',
      reading: 'I can understand texts made up of everyday or job-related language.',
      speaking: 'I can enter unprepared conversations on familiar topics and explain my views.',
      writing: 'I can write connected text about topics I know or that interest me.',
      grammar: 'I can use conditionals, reported speech and more complex clauses.',
      interaction: 'I can deal with problems and complications that come up unexpectedly.',
    },
  },
  B1_PLUS: {
    summary: 'I manage unfamiliar situations and can argue a position with some confidence.',
    skills: {
      speaking: 'I can sustain a longer discussion and handle unexpected turns.',
    },
  },
  B2: {
    summary: 'I can interact with fluency and take an active part in discussion of abstract topics.',
    skills: {
      listening: 'I can follow extended speech, lectures and most media in standard language.',
      reading: 'I can read articles and reports on contemporary issues.',
      speaking: 'I can present clear, detailed arguments and defend a point of view.',
      writing: 'I can write clear, detailed text and structured argument.',
      interaction: 'I can take part in professional discussion without much strain on either side.',
    },
  },
  B2_PLUS: {
    summary: 'I communicate comfortably in professional settings and adapt my register.',
    skills: {
      speaking: 'I can adjust how I speak to the audience and the situation.',
    },
  },
  C1: {
    summary: 'I can use the language flexibly and effectively for social, academic and professional purposes.',
    skills: {
      listening: 'I can follow fast speech, implicit meaning and unfamiliar accents.',
      reading: 'I can understand long, demanding texts and appreciate style.',
      speaking: 'I can express myself fluently and precisely, including idiomatic usage.',
      writing: 'I can write clear, well-structured text on complex subjects.',
      mediation: 'I can rephrase demanding content for different audiences.',
    },
  },
  C2: {
    summary: 'I can express myself with a highly proficient command of nuance, register and implication.',
    skills: {
      listening: 'I can understand spontaneous, fast speech including humour, irony and regional variation.',
      reading: 'I can read virtually any written text, including literary and specialised writing.',
      speaking: 'I can convey finer shades of meaning precisely and persuasively.',
      writing: 'I can write with control of style appropriate to the reader.',
      interaction: 'I can negotiate, persuade and handle ambiguity with ease.',
    },
  },
};

export function canDoSummary(level: Cefr): string {
  return CAN_DO[level].summary;
}

export function canDoForSkill(level: Cefr, skill: Skill): string | undefined {
  return CAN_DO[level].skills[skill];
}
