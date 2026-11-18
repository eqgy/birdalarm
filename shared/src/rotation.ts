/**
 * Bird rotation: shuffle the library into a deck, deal one bird per alarm,
 * reshuffle when the deck runs out. No bird repeats until the deck is used up,
 * and a new deck never starts with the bird that ended the previous one.
 */

export interface DeckState {
  order: string[];
  pos: number;
  lastDealt?: string;
}

export type Rng = () => number; // returns [0, 1)

export const emptyDeck = (): DeckState => ({ order: [], pos: 0 });

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Deal the next bird. Blocked birds and birds removed from the library are skipped.
 * Birds added to the library mid-deck join at the next reshuffle.
 */
export function dealBird(
  deck: DeckState,
  libraryIds: readonly string[],
  blocked: ReadonlySet<string>,
  rng: Rng,
): { birdId: string; deck: DeckState } {
  const available = libraryIds.filter((id) => !blocked.has(id));
  if (available.length === 0) throw new Error("No birds available to deal");
  const availableSet = new Set(available);

  let { order, pos } = deck;
  while (pos < order.length && !availableSet.has(order[pos]!)) pos++;

  if (pos >= order.length) {
    order = shuffle(available, rng);
    pos = 0;
    if (order.length > 1 && order[0] === deck.lastDealt) {
      const swap = 1 + Math.floor(rng() * (order.length - 1));
      [order[0], order[swap]] = [order[swap]!, order[0]!];
    }
  }

  const birdId = order[pos]!;
  return { birdId, deck: { order, pos: pos + 1, lastDealt: birdId } };
}
