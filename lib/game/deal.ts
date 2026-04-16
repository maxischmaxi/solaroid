import { createDeck, shuffle } from "./deck";
import { mulberry32, randomSeed, seedFromString } from "./rng";
import type {
  Card,
  DrawMode,
  GameState,
  Pile,
  TableauIndex,
} from "./types";

function makePile(id: Pile["id"], kind: Pile["kind"], cards: Card[]): Pile {
  return { id, kind, cards };
}

export function dealKlondike(
  seed: string = randomSeed(),
  drawMode: DrawMode = 1,
  redealLimit: number | null = null,
): GameState {
  const rand = mulberry32(seedFromString(seed));
  const shuffled = shuffle(createDeck(), rand);

  // Deal 7 tableau piles: pile i (0-indexed) gets i+1 cards; top card face-up.
  const tableauPiles: Pile[] = [];
  let cursor = 0;
  for (let i = 0 as TableauIndex; i < 7; i = (i + 1) as TableauIndex) {
    const count = i + 1;
    const slice = shuffled.slice(cursor, cursor + count).map((c, idx) => ({
      ...c,
      faceUp: idx === count - 1, // only the topmost is face-up
    }));
    cursor += count;
    tableauPiles.push(makePile(`tableau-${i}`, "tableau", slice));
  }

  const stockCards = shuffled.slice(cursor).map((c) => ({ ...c, faceUp: false }));

  return {
    tableau: tableauPiles as unknown as GameState["tableau"],
    foundations: [
      makePile("foundation-0", "foundation", []),
      makePile("foundation-1", "foundation", []),
      makePile("foundation-2", "foundation", []),
      makePile("foundation-3", "foundation", []),
    ],
    stock: makePile("stock", "stock", stockCards),
    waste: makePile("waste", "waste", []),
    drawMode,
    stockCycles: 0,
    moveCount: 0,
    score: 0,
    startedAt: null,
    accumulatedMs: 0,
    status: "idle",
    seed,
    redealLimit,
  };
}
