import { describe, expect, it } from "vitest";
import { dealBird, emptyDeck, type DeckState } from "../src";
import { birds, mulberry32 } from "./helpers";

function dealMany(n: number, lib: string[], blocked = new Set<string>(), seed = 1) {
  const rng = mulberry32(seed);
  let deck: DeckState = emptyDeck();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = dealBird(deck, lib, blocked, rng);
    deck = r.deck;
    out.push(r.birdId);
  }
  return { out, deck };
}

describe("dealBird", () => {
  it("plays every bird once before any repeats", () => {
    const lib = birds(60);
    const { out } = dealMany(180, lib);
    for (let d = 0; d < 3; d++) {
      expect(new Set(out.slice(d * 60, d * 60 + 60)).size).toBe(60);
    }
  });

  it("never plays the same bird two mornings in a row across reshuffles", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { out } = dealMany(30, birds(3), new Set(), seed);
      for (let i = 1; i < out.length; i++) expect(out[i]).not.toBe(out[i - 1]);
    }
  });

  it("skips blocked birds, including ones already in the current deck", () => {
    const lib = birds(5);
    const rng = mulberry32(7);
    let { deck } = dealBird(emptyDeck(), lib, new Set(), rng);
    const blocked = new Set(deck.order.slice(1, 3));
    const dealt: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = dealBird(deck, lib, blocked, rng);
      deck = r.deck;
      dealt.push(r.birdId);
    }
    for (const b of dealt) expect(blocked.has(b)).toBe(false);
  });

  it("skips birds removed from the library", () => {
    const rng = mulberry32(3);
    let { deck } = dealBird(emptyDeck(), birds(10), new Set(), rng);
    const smaller = birds(10).filter((b) => b !== deck.order[1]);
    const r = dealBird(deck, smaller, new Set(), rng);
    expect(r.birdId).not.toBe(deck.order[1]);
  });

  it("works with a single-bird library", () => {
    expect(dealMany(3, ["only"]).out).toEqual(["only", "only", "only"]);
  });

  it("throws when every bird is blocked", () => {
    expect(() => dealBird(emptyDeck(), ["a"], new Set(["a"]), Math.random)).toThrow();
  });
});
