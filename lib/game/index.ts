// Public surface of the pure game module. Anything the UI needs lives here.
export * from "./types";
export * from "./constants";
export { dealKlondike } from "./deal";
export { createDeck, shuffle } from "./deck";
export {
  canPlaceOnFoundation,
  canPlaceOnTableau,
  isValidTableauRun,
  runStartingAt,
  topCardOf,
} from "./rules";
export { flipTopIfNeeded } from "./flip";
export { drawFromStock, recycleWaste } from "./stock";
export {
  tryApplyMove,
  findBestDestination,
  isLegalMove,
} from "./moves";
export { isWon, allTableauFaceUp, canAutoComplete } from "./win";
export {
  moveScoreDelta,
  recyclePenalty,
  flipReveal,
  timeBonus,
  finalScore,
} from "./scoring";
export { pickNextAutoMove, planAutoComplete } from "./autoComplete";
export { mulberry32, seedFromString, randomSeed } from "./rng";
