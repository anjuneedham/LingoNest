/**
 * The Field Guide's cast.
 *
 * Each entry keeps two kinds of claim separate on purpose: `naturalHistory`
 * is what you could cite, `legend` is folklore explicitly framed as such.
 * Nothing here is invented to sound authoritative — where a species'
 * "national" status is genuinely official (Doctor Bird, Quetzal) it says so;
 * where it isn't (the crane, the ibex), the status line says what's actually
 * true instead (sacred to a people, a conservation icon) rather than
 * overclaiming.
 */

export type SpeciesId = 'doctor-bird' | 'quetzal' | 'red-crowned-crane' | 'alpine-ibex';

export interface Species {
  readonly id: SpeciesId;
  /** The language whose first lesson unlocks this species. `null` = always unlocked. */
  readonly languageCode: string | null;
  readonly commonName: string;
  readonly scientificName: string;
  readonly status: string;
  readonly range: string;
  readonly naturalHistory: readonly string[];
  readonly legend: string;
}

export const SPECIES: readonly Species[] = [
  {
    id: 'doctor-bird',
    languageCode: null,
    commonName: 'Doctor Bird',
    scientificName: 'Trochilus polytmus',
    status: 'National bird of Jamaica',
    range: 'Endemic — found nowhere else on Earth',
    naturalHistory: [
      'Also called the Red-billed Streamertail — males trail a pair of long black tail feathers up to three times their body length, which whir audibly in flight.',
      'The name "Doctor Bird" is old Jamaican slang: those twin streamers were said to look like the black tailcoats 19th-century physicians wore on their rounds.',
      'Fiercely territorial for a bird the size of a thumb — it will chase off hummingbirds, and even much larger birds, from a single hibiscus bush.',
      "Appears on Jamaica's coins and stamps, and is protected under Jamaican law.",
    ],
    legend:
      "Jamaican folk tradition holds that the Doctor Bird carries the spirit of someone who has passed on — which is why it's considered very bad luck to harm one. The belief echoes back to the Taíno, Jamaica's first people, who held hummingbirds sacred as messengers between the living world and the spirit world.",
  },
  {
    id: 'quetzal',
    languageCode: 'es',
    commonName: 'Resplendent Quetzal',
    scientificName: 'Pharomachrus mocinno',
    status: 'National bird of Guatemala',
    range: 'Cloud forests, southern Mexico to Panama',
    naturalHistory: [
      'Males grow iridescent emerald tail coverts that can trail up to a metre — three times the length of the bird itself.',
      'Feeds mainly on wild avocados, swallowing them whole and coughing up the pit — making it one of the forest’s main seed-dispersers for trees few other animals can plant.',
      "Guatemala's currency is named after it, and it appears on the country's coat of arms.",
      'Listed as near-threatened: it needs old-growth cloud forest to nest, so it disappears fast when that forest is logged.',
    ],
    legend:
      'Revered by the Maya and Aztec as a divine bird — the Aztec god Quetzalcoatl, the "feathered serpent," takes his name from it. Maya nobility wore its tail feathers as a mark of rank, but killing one was forbidden; only feathers the bird had already shed could be collected. A Guatemalan legend says its breast turned blood-red after it was mortally wounded defending the warrior-prince Tecún Umán, and that its haunting call still carries that grief.',
  },
  {
    id: 'red-crowned-crane',
    languageCode: 'ja',
    commonName: 'Red-Crowned Crane',
    scientificName: 'Grus japonensis',
    status: 'Sacred to the Ainu people',
    range: 'Hokkaido, Japan — a non-migratory population',
    naturalHistory: [
      'Stands about 1.5 metres tall, among the tallest flying birds alive, with snow-white plumage, black wingtips, and a bare patch of red skin on the crown.',
      'Famous for an elaborate, synchronised mating dance — leaping, bowing, and calling in duet — and mates for life.',
      'Nearly extinct by the 1920s; a small surviving flock was found in a Hokkaido marsh, and winter feeding stations begun in the 1950s brought the population back from the brink.',
      'Its Japanese name, Tanchō, literally means "red crown."',
    ],
    legend:
      'Long believed in Japan to live a thousand years, which is why folding a thousand paper cranes — senbazuru — is a traditional wish for luck, healing, or long life. The Ainu, the indigenous people of Hokkaido, hold the crane sacred as "sarurun kamuy" — guardian spirit of the marshland it calls home.',
  },
  {
    id: 'alpine-ibex',
    languageCode: 'fr',
    commonName: 'Alpine Ibex',
    scientificName: 'Capra ibex',
    status: 'Alpine conservation icon',
    range: 'French & Italian Alps',
    naturalHistory: [
      "A wild mountain goat whose ridged, backward-curving horns can grow past a metre on older males — used mainly to settle rank in head-butting duels, not for defence.",
      'An extraordinary climber, able to scale near-vertical rock faces and dam walls that few other large animals could attempt.',
      "Hunted to the edge of extinction across the Alps by the early 1800s — the entire species survived as one small, protected herd in Italy's Gran Paradiso royal reserve.",
      "Reintroduced across the French Alps through 20th-century conservation work, including in Vanoise National Park, founded partly to give it a home again.",
    ],
    legend:
      'For centuries, Alpine folk medicine held that nearly every part of the ibex — horn, blood, even stomach stones — could cure poison or paralysis. The belief was so persistent it drove hunters to near-extinguish the species chasing it. Some mountain communities also told of the ibex as an otherworldly guide, said to lead lost travellers safely off the peaks.',
  },
] as const;

export function getSpecies(id: SpeciesId): Species {
  const found = SPECIES.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown species: ${id}`);
  return found;
}

export function speciesForLanguage(languageCode: string): Species | null {
  return SPECIES.find((s) => s.languageCode === languageCode) ?? null;
}
