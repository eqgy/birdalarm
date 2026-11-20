/**
 * Evening lines for the widget, hyping up tomorrow's mystery bird. One per date, picked by the
 * date alone, so everyone sees the same line on the same evening.
 */
export const TEASERS = [
  "Tomorrow's bird is picked. You'll hear it when your alarm goes off.",
  "There's a different bird waiting for tomorrow morning.",
  "Can you guess tomorrow's bird from the hint?",
  "Everyone gets the same bird tomorrow. See if you can name it first.",
  "Get some sleep. Tomorrow's bird sings early.",
  "Tomorrow's bird stays a secret until morning.",
  "Listen for it before you open your eyes.",
  "The hint below is all you get until morning.",
  "Tomorrow starts with a new song.",
  "Most birds start singing a little before sunrise. Yours will too.",
  "Try to name tomorrow's bird before the app tells you.",
  "Good night. Tomorrow's bird is ready.",
  "You might know this one. You might not.",
  "One more sleep until you find out.",
  "Here's a clue for tomorrow.",
  "Tomorrow's bird is out there somewhere tonight.",
];

/** A clue about the bird without giving it away: its size one day, its family the next. */
export function hintFor(day: number, bird: { size?: string; family?: string }): string {
  if (day % 2 === 0 && bird.size) return `Hint: ${bird.size.charAt(0).toLowerCase()}${bird.size.slice(1)}`;
  // Family names are plural ("Thrushes", "New World sparrows"), so: "one of the thrushes".
  if (bird.family) return `Hint: one of the ${/^(New|Old) World/.test(bird.family) ? bird.family : bird.family.toLowerCase()}`;
  return bird.size ? `Hint: ${bird.size.toLowerCase()}` : '';
}

export const teaserFor = (day: number) => TEASERS[((day % TEASERS.length) + TEASERS.length) % TEASERS.length]!;
