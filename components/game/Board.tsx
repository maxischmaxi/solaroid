"use client";

import { Foundation } from "./Foundation";
import { Stock } from "./Stock";
import { Tableau } from "./Tableau";
import { Waste } from "./Waste";
import type { FoundationIndex, TableauIndex } from "@/lib/game/types";

const TABLEAU_INDICES: TableauIndex[] = [0, 1, 2, 3, 4, 5, 6];
const FOUNDATION_INDICES: FoundationIndex[] = [0, 1, 2, 3];

export function Board() {
  return (
    <div className="board flex-1 px-[var(--pile-gap)] py-[var(--pile-gap)]">
      <div className="grid grid-cols-7 gap-[var(--pile-gap)] justify-items-center mb-[calc(var(--pile-gap)*1.5)]">
        <div className="justify-self-start">
          <Stock />
        </div>
        <div className="justify-self-start">
          <Waste />
        </div>
        <div /> {/* spacer */}
        {FOUNDATION_INDICES.map((i) => (
          <div key={i} className="justify-self-start">
            <Foundation index={i} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[var(--pile-gap)] justify-items-center">
        {TABLEAU_INDICES.map((i) => (
          <div key={i} className="justify-self-start">
            <Tableau index={i} />
          </div>
        ))}
      </div>
    </div>
  );
}
