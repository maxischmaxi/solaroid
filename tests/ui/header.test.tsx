// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Header } from "@/components/game/Header";
import { dealKlondike } from "@/lib/game/deal";
import { defaultSettings, defaultStats } from "@/lib/persistence/storage";
import { useGameStore } from "@/lib/store/gameStore";

function resetStore(): void {
  useGameStore.setState({
    game: dealKlondike("test-seed", 1),
    history: [],
    settings: { ...defaultSettings },
    stats: { ...defaultStats },
    hydrated: true,
    autoCompleteRunning: false,
    autoCompleteFailed: false,
    winFinalePlaying: false,
    hint: null,
    gameOverOpen: false,
  });
}

beforeEach(() => {
  localStorage.clear();
  resetStore();
});

afterEach(() => {
  cleanup();
});

describe("Header", () => {
  it("disables Undo when the history is empty", () => {
    render(<Header onOpenStats={() => {}} />);
    const btn = screen.getByRole("button", { name: "Undo" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables Undo after a move and the click pops history", () => {
    useGameStore.getState().drawFromStock();
    expect(useGameStore.getState().history).toHaveLength(1);

    render(<Header onOpenStats={() => {}} />);
    const btn = screen.getByRole("button", { name: "Undo" });
    expect((btn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(btn);
    expect(useGameStore.getState().history).toHaveLength(0);
  });

  it("Tipp button dispatches a hint request", () => {
    render(<Header onOpenStats={() => {}} />);
    const btn = screen.getByRole("button", { name: "Tipp" });
    fireEvent.click(btn);
    // Either a hint was found or the game-over flag was set — both are legal
    // outcomes of requestHint. What matters is that _something_ changed.
    const state = useGameStore.getState();
    expect(state.hint !== null || state.gameOverOpen).toBe(true);
  });

  it("stats button triggers the onOpenStats callback", () => {
    const onOpenStats = vi.fn();
    render(<Header onOpenStats={onOpenStats} />);
    fireEvent.click(screen.getByRole("button", { name: "Statistik" }));
    expect(onOpenStats).toHaveBeenCalledTimes(1);
  });
});
