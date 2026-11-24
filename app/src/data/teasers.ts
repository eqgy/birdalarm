/**
 * The evening clue for tomorrow's bird, shown on the widget after sunset. It's a real detail
 * about the bird: one of its field marks, or its song or call as people write it down. Picked by the
 * date alone, so everyone gets the same clue on the same evening. Song quotes that contain
 * part of the bird's name ("chick-a-dee", "fee-bee" for the phoebe) are skipped.
 */
import type { LibraryBird } from './birds';

/** Quoted song phrases from the "Listen for" text that don't give the name away. */
function songPhrases(bird: LibraryBird): string[] {
  const listen = bird.listen ?? '';
  // "its own name", "named for its call": the song is the name, so it would give it away.
  if (/own name|named for/i.test(listen)) return [];
  const nameWords = bird.commonName.toLowerCase().split(/[\s-]+/).map((w) => w.replace(/[^a-z]/g, ''));
  const quotes = [...listen.matchAll(/"([^"]{4,60})"/g)].map((m) => m[1]!.replace(/[.,]$/, ''));
  return quotes.filter((q) => {
    const words = q.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3);
    const flat = q.toLowerCase().replace(/[^a-z]/g, '');
    // Skip it if a song word starts a name word ("veer" in Veery) or a name word is in the song.
    return !words.some((w) => nameWords.some((n) => n.startsWith(w))) &&
      !nameWords.some((n) => n.length > 3 && flat.includes(n.slice(0, 5)));
  });
}

export function clueFor(day: number, bird: LibraryBird): string {
  const clues: string[] = [];
  const songs = songPhrases(bird);
  // Leave out marks that use a word from the name ("Blue crest" for the Blue Jay).
  const nameWords = bird.commonName.toLowerCase().split(/[\s-]+/).filter((w) => w.length >= 4);
  const marks = (bird.marks ?? []).filter((m) => !nameWords.some((w) => m.toLowerCase().includes(w)));
  // Alternate: a field mark, then the song, then another mark...
  for (let i = 0; i < Math.max(marks.length, songs.length); i++) {
    if (marks[i]) clues.push(marks[i]!.replace(/\s*\((male|female|summer male|adults)\)/i, ''));
    if (songs[i]) clues.push(`Listen for "${songs[i]}"`);
  }
  if (!clues.length) return bird.size ?? '';
  return clues[((day % clues.length) + clues.length) % clues.length]!;
}
