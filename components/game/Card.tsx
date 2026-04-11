"use client";

import { memo } from "react";
import { colorOf } from "@/lib/game/constants";
import type { Rank, Suit } from "@/lib/game/types";

const SUIT_GLYPH: Record<Suit, string> = {
  spades: "\u2660", // ♠
  hearts: "\u2665", // ♥
  diamonds: "\u2666", // ♦
  clubs: "\u2663", // ♣
};

const RANK_LABEL: Record<Rank, string> = {
  1: "A",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
};

interface CardProps {
  suit: Suit;
  rank: Rank;
  /** Render the back side of the card. */
  back?: boolean;
  /** Visually indicate that this card is being dragged. */
  dragging?: boolean;
  /** Visually indicate that this card is selected (click-to-move). */
  selected?: boolean;
}

// Pip layout map: positions on a normalized grid for 2..10 cards.
const PIP_LAYOUTS: Record<number, Array<[number, number]>> = {
  2: [
    [0.5, 0.18],
    [0.5, 0.82],
  ],
  3: [
    [0.5, 0.18],
    [0.5, 0.5],
    [0.5, 0.82],
  ],
  4: [
    [0.25, 0.2],
    [0.75, 0.2],
    [0.25, 0.8],
    [0.75, 0.8],
  ],
  5: [
    [0.25, 0.2],
    [0.75, 0.2],
    [0.5, 0.5],
    [0.25, 0.8],
    [0.75, 0.8],
  ],
  6: [
    [0.25, 0.2],
    [0.75, 0.2],
    [0.25, 0.5],
    [0.75, 0.5],
    [0.25, 0.8],
    [0.75, 0.8],
  ],
  7: [
    [0.25, 0.18],
    [0.75, 0.18],
    [0.5, 0.34],
    [0.25, 0.5],
    [0.75, 0.5],
    [0.25, 0.82],
    [0.75, 0.82],
  ],
  8: [
    [0.25, 0.18],
    [0.75, 0.18],
    [0.5, 0.34],
    [0.25, 0.5],
    [0.75, 0.5],
    [0.5, 0.66],
    [0.25, 0.82],
    [0.75, 0.82],
  ],
  9: [
    [0.25, 0.18],
    [0.75, 0.18],
    [0.25, 0.36],
    [0.75, 0.36],
    [0.5, 0.5],
    [0.25, 0.64],
    [0.75, 0.64],
    [0.25, 0.82],
    [0.75, 0.82],
  ],
  10: [
    [0.25, 0.18],
    [0.75, 0.18],
    [0.5, 0.28],
    [0.25, 0.4],
    [0.75, 0.4],
    [0.25, 0.6],
    [0.75, 0.6],
    [0.5, 0.72],
    [0.25, 0.82],
    [0.75, 0.82],
  ],
};

// Font sizes computed from --card-w via inline style.
const CORNER_FONT = "calc(var(--card-w) * 0.21)";
const CENTER_FONT = "calc(var(--card-w) * 0.62)";
const FACE_FONT = "calc(var(--card-w) * 0.42)";
const FACE_GLYPH_FONT = "calc(var(--card-w) * 0.24)";
const PIP_FONT = "calc(var(--card-w) * 0.24)";

export const Card = memo(function Card({
  suit,
  rank,
  back = false,
  dragging = false,
  selected = false,
}: CardProps) {
  if (back) {
    return (
      <div
        className={`absolute inset-0 rounded-[6%] bg-gradient-to-br from-sky-700 to-sky-900 shadow-md ring-1 ring-black/20 overflow-hidden ${dragging ? "opacity-30" : ""} ${selected ? "outline outline-2 outline-amber-300" : ""}`}
        aria-hidden
      >
        <div
          className="absolute inset-1 rounded-[4%]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.16) 0 4px, transparent 4px 10px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.12) 0 4px, transparent 4px 10px)",
          }}
        />
        <div className="absolute inset-1 rounded-[4%] ring-1 ring-white/30" />
      </div>
    );
  }

  const color = colorOf(suit);
  const glyph = SUIT_GLYPH[suit];
  const label = RANK_LABEL[rank];
  const isFace = rank >= 11;
  const isAce = rank === 1;
  const colorClass = color === "red" ? "text-rose-600" : "text-zinc-900";

  return (
    <div
      className={`absolute inset-0 rounded-[6%] bg-white shadow-md ring-1 ring-black/15 overflow-hidden select-none ${dragging ? "opacity-30" : ""} ${selected ? "outline outline-2 outline-amber-400" : ""}`}
    >
      {/* Top-left corner index */}
      <div
        className={`absolute left-[6%] top-[4%] flex flex-col items-center leading-none ${colorClass}`}
        style={{ fontSize: CORNER_FONT }}
      >
        <div className="font-bold tracking-tight">{label}</div>
        <div>{glyph}</div>
      </div>
      {/* Bottom-right corner index, rotated 180° */}
      <div
        className={`absolute right-[6%] bottom-[4%] flex flex-col items-center leading-none rotate-180 ${colorClass}`}
        style={{ fontSize: CORNER_FONT }}
      >
        <div className="font-bold tracking-tight">{label}</div>
        <div>{glyph}</div>
      </div>

      {/* Center artwork */}
      {isAce && (
        <div
          className={`absolute inset-0 flex items-center justify-center ${colorClass}`}
          style={{ fontSize: CENTER_FONT }}
        >
          <span>{glyph}</span>
        </div>
      )}

      {isFace && (
        <div
          className={`absolute inset-[18%] flex flex-col items-center justify-center rounded ring-1 ring-black/10 bg-gradient-to-br from-zinc-50 to-zinc-200 ${colorClass}`}
        >
          <span
            className="font-serif font-semibold"
            style={{ fontSize: FACE_FONT }}
          >
            {label}
          </span>
          <span style={{ fontSize: FACE_GLYPH_FONT }}>{glyph}</span>
        </div>
      )}

      {!isAce && !isFace && (
        <div className={`absolute inset-[14%] ${colorClass}`}>
          {PIP_LAYOUTS[rank].map(([cx, cy], i) => {
            const flipped = cy > 0.5;
            return (
              <span
                key={i}
                className="absolute leading-none"
                style={{
                  left: `${cx * 100}%`,
                  top: `${cy * 100}%`,
                  transform: `translate(-50%, -50%) ${flipped ? "rotate(180deg)" : ""}`,
                  fontSize: PIP_FONT,
                }}
              >
                {glyph}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
});
