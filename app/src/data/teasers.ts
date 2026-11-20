/**
 * Evening lines for the widget, hyping up tomorrow's mystery bird. One per date, picked by the
 * date alone, so everyone sees the same line on the same evening.
 */
export const TEASERS = [
  "Someone is warming up for tomorrow's dawn.",
  'A mystery bird is choosing its branch.',
  "Tomorrow's singer is practicing in the dark.",
  'Guess who wakes you tomorrow.',
  'Somewhere out there, tomorrow’s bird is asleep.',
  'The dawn chorus has picked its soloist.',
  "Tomorrow's voice is a secret until sunrise.",
  'A new song is on its way.',
  'Feathers ruffled. Throat cleared. Waiting for you.',
  "You'll meet tomorrow's bird at first light.",
  'Who will it be? Even the owls aren’t telling.',
  'Tomorrow’s bird has never sung for you before.',
  "The night is quiet. Tomorrow won't be.",
  'Rest up. Someone has a song for you.',
  'A small surprise is roosting nearby.',
  "Tomorrow's alarm has wings.",
  'The sky is setting the stage.',
  'One bird. One song. One morning.',
  "Listen closely tomorrow. You'll want to remember this one.",
  'Something is singing in your future.',
  'The dawn has a guest list. You’re on it.',
];

/** A clue about the bird without giving it away: its size one day, its family the next. */
export function hintFor(day: number, bird: { size?: string; family?: string }): string {
  if (day % 2 === 0 && bird.size) return `Hint: ${bird.size.charAt(0).toLowerCase()}${bird.size.slice(1)}`;
  if (bird.family) return `Hint: from the ${bird.family.toLowerCase()} family`;
  return bird.size ? `Hint: ${bird.size.toLowerCase()}` : '';
}

export const teaserFor = (day: number) => TEASERS[((day % TEASERS.length) + TEASERS.length) % TEASERS.length]!;
