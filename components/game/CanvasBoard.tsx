"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { Animator, easeOutCubic } from "@/lib/canvas/animator";
import { attachInput } from "@/lib/canvas/input";
import { computeLayout } from "@/lib/canvas/layout";
import { reducedMotion } from "@/lib/canvas/reducedMotion";
import { renderScene } from "@/lib/canvas/renderer";
import type { DragFromOverrides } from "@/lib/canvas/scheduler";
import { createScheduler } from "@/lib/canvas/scheduler";
import {
  ensureSpriteCache,
  spriteLogicalSize,
  spriteMargin,
  type SpriteCache,
} from "@/lib/canvas/sprites";
import type { WinFinaleParticle } from "@/lib/canvas/winFinale";
import type { DragState, HintScene, Layout, Rect } from "@/lib/canvas/types";
import { WinFinale } from "@/lib/canvas/winFinale";
import type { CardId, GameState, PileId, ThemeId } from "@/lib/game/types";
import { setActiveTheme } from "@/lib/theme/activeTheme";
import { THEMES } from "@/lib/theme/themes";
import type { ActiveHint } from "@/lib/store/gameStore";
import { CanvasBoardA11y } from "./CanvasBoardA11y";

/**
 * Canvas-based Solitaire board. Mounts once, drives all rendering imperatively
 * via an rAF loop, and routes pointer events through the input state machine
 * into the existing zustand store actions.
 */
export function CanvasBoard() {
  const hydrated = useGameStore((s) => s.hydrated);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!hydrated) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!container || !canvas || !overlayCanvas) return;

    const ctx = canvas.getContext("2d");
    const overlayCtx = overlayCanvas.getContext("2d");
    if (!ctx || !overlayCtx) return;

    const animator = new Animator();
    animator.setReducedMotion(reducedMotion());
    const scheduler = createScheduler({
      animator,
      getBoardSize: () => ({
        w: container.clientWidth,
        h: container.clientHeight,
      }),
    });
    const winFinale = new WinFinale();
    // Offset of the gameplay canvas inside the viewport, captured at finale
    // start so the overlay can paint particles in viewport coordinates.
    let overlayOffset: { x: number; y: number } = { x: 0, y: 0 };
    let overlayDpr = 1;

    let layout: Layout | null = null;
    let sprites: SpriteCache | null = null;
    // Keyed by themeId so toggling between themes doesn't rebuild 56 sprites
    // on every switch. Geometry changes (cardW, dpr) invalidate the whole map.
    const spriteCache = new Map<ThemeId, SpriteCache>();
    let drag: DragState | null = null;
    let hovered: PileId | null = null;
    let loopRunning = false;
    let dpr = window.devicePixelRatio || 1;
    // Set in onDrop right before dispatchMove, consumed by the store
    // subscription so the generic-move tweens start from where each card
    // was released (pointer position) instead of the source pile.
    let pendingDragOverrides: DragFromOverrides | null = null;

    const showOverlay = (): void => {
      overlayDpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      overlayCanvas.width = Math.floor(w * overlayDpr);
      overlayCanvas.height = Math.floor(h * overlayDpr);
      overlayCanvas.style.width = `${w}px`;
      overlayCanvas.style.height = `${h}px`;
      overlayCanvas.style.display = "block";
      overlayCtx.setTransform(overlayDpr, 0, 0, overlayDpr, 0, 0);
    };

    const hideOverlay = (): void => {
      overlayCtx.clearRect(
        0,
        0,
        overlayCanvas.width / Math.max(1, overlayDpr),
        overlayCanvas.height / Math.max(1, overlayDpr),
      );
      overlayCanvas.style.display = "none";
    };

    const recomputeSize = (): void => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const state = useGameStore.getState();
      const game = state.game;
      const themeId = state.settings.theme;
      setActiveTheme(THEMES[themeId]);
      layout = computeLayout(game, w, h, game.drawMode);
      sprites = ensureSpriteCache(
        spriteCache,
        layout.cardW,
        layout.cardH,
        dpr,
        themeId,
      );
      requestDraw();
    };

    const renderOnce = (): void => {
      if (!layout || !sprites) return;
      const now = performance.now();
      const snap = animator.tick(now);
      const finaleParticles = winFinale.isActive
        ? winFinale.tick(now)
        : winFinale.getParticles();
      const finaleJustEnded =
        !winFinale.isActive && useGameStore.getState().winFinalePlaying;
      // Auto-clear the store flag the first frame the finale finishes so the
      // GameShell win modal pops without an extra rAF callback round-trip.
      if (finaleJustEnded) {
        useGameStore.getState().finishWinFinale();
        hideOverlay();
      }
      const launchedIds = winFinale.getLaunchedIds();

      // Hint overlay: pull the active hint from the store, compute pixel
      // coords from the live layout, and self-clear when it expires.
      const storeHint = useGameStore.getState().hint;
      let hintScene: HintScene | undefined;
      if (storeHint) {
        if (Date.now() >= storeHint.expiresAt) {
          useGameStore.getState().clearHint();
        } else {
          hintScene = computeHintScene(layout, storeHint, reducedMotion());
        }
      }

      // Gameplay canvas. We do NOT pass particles to it — those are drawn
      // on the full-viewport overlay so they can leave the 776px gameplay
      // bounds. We DO pass launchedIds so foundation cards correctly
      // disappear from the static layer once they've been launched.
      renderScene(ctx, {
        layout,
        sprites,
        anims: snap,
        drag,
        hoveredPile: hovered,
        reducedMotion: reducedMotion(),
        winFinale:
          launchedIds.size > 0
            ? { particles: [], launchedIds }
            : undefined,
        hint: hintScene,
      });

      // Overlay canvas: only used while particles exist.
      if (finaleParticles.length > 0 && sprites) {
        renderFinaleOverlay(
          overlayCtx,
          sprites,
          finaleParticles,
          overlayOffset,
          overlayCanvas.width / Math.max(1, overlayDpr),
          overlayCanvas.height / Math.max(1, overlayDpr),
        );
      }
    };

    const loop = (): void => {
      if (!layout || !sprites) {
        loopRunning = false;
        return;
      }
      renderOnce();
      const hintActive = useGameStore.getState().hint !== null;
      if (
        animator.isIdle &&
        !drag &&
        !winFinale.isActive &&
        !hintActive
      ) {
        loopRunning = false;
        return;
      }
      requestAnimationFrame(loop);
    };

    const requestDraw = (): void => {
      if (loopRunning) return;
      loopRunning = true;
      requestAnimationFrame(loop);
    };

    // ----- Initial layout, sprites, deal cascade -----
    recomputeSize();
    const initialGame = useGameStore.getState().game;
    const wantsDeal =
      isFreshDeal(initialGame) &&
      useGameStore.getState().history.length === 0;
    scheduler.reset();
    if (wantsDeal) {
      scheduler.reconcile(initialGame, "deal");
    } else {
      scheduler.reconcile(initialGame);
    }
    requestDraw();

    // ----- Subscribe to store changes -----
    const unsubGame = useGameStore.subscribe((s, prev) => {
      if (s.game === prev.game) return;
      // Recompute layout from the current container size in case nothing
      // else triggered a resize between events.
      const w = container.clientWidth;
      const h = container.clientHeight;
      layout = computeLayout(s.game, w, h, s.game.drawMode);
      scheduler.reconcile(s.game, undefined, pendingDragOverrides);
      pendingDragOverrides = null;
      requestDraw();
    });

    const unsubHint = useGameStore.subscribe((s, prev) => {
      if (s.hint === prev.hint) return;
      requestDraw();
    });

    const unsubFinale = useGameStore.subscribe((s, prev) => {
      if (s.winFinalePlaying === prev.winFinalePlaying) return;
      if (s.winFinalePlaying) {
        if (reducedMotion() || !layout) {
          // Skip the cascade entirely; let the WinModal pop immediately.
          useGameStore.getState().finishWinFinale();
          return;
        }
        // Cancel any in-flight tweens (e.g. the last auto-complete step) so
        // foundation cards visibly snap into place before launching.
        animator.skipToEnd();

        // Capture the gameplay canvas's position inside the viewport so we
        // can translate every foundation slot from local coords into the
        // overlay canvas's full-viewport coordinate system.
        const rect = canvas.getBoundingClientRect();
        overlayOffset = { x: rect.left, y: rect.top };
        showOverlay();

        winFinale.start({
          foundations: layout.piles["foundation-0"]
            ? [
                "foundation-0",
                "foundation-1",
                "foundation-2",
                "foundation-3",
              ].map((id) => {
                const pile = layout!.piles[id as PileId];
                return {
                  // Translate into viewport coords — that's the coordinate
                  // system the overlay canvas uses.
                  x: pile.x + overlayOffset.x,
                  y: pile.y + overlayOffset.y,
                  cards: pile.cards.map((c) => c.cardId),
                };
              })
            : [],
          // Use the full viewport as the bounce arena.
          boardW: window.innerWidth,
          boardH: window.innerHeight,
          cardW: layout.cardW,
          cardH: layout.cardH,
        });
        requestDraw();
      } else {
        // Flag was cleared externally (e.g. newGame during finale) — stop.
        winFinale.stop();
        hideOverlay();
        requestDraw();
      }
    });

    // ----- Theme changes -----
    const unsubTheme = useGameStore.subscribe((s, prev) => {
      if (s.settings.theme === prev.settings.theme) return;
      setActiveTheme(THEMES[s.settings.theme]);
      if (layout) {
        sprites = ensureSpriteCache(
          spriteCache,
          layout.cardW,
          layout.cardH,
          dpr,
          s.settings.theme,
        );
      }
      requestDraw();
    });

    // ----- Pointer events -----
    const detachInput = attachInput(canvas, {
      getLayout: () => layout,
      getGame: () => useGameStore.getState().game,
      onClickStock: () => {
        const g = useGameStore.getState();
        if (g.game.stock.cards.length > 0) {
          g.drawFromStock();
        } else if (g.game.waste.cards.length > 0) {
          g.recycleWaste();
        }
      },
      onClickCard: (source, cardId) => {
        const s = useGameStore.getState();
        const target = s.findBestDestination(source.pileId, cardId);
        if (!target) return;
        s.dispatchMove({
          kind: "move",
          from: source.pileId,
          to: target,
          cardId,
        });
      },
      onDoubleClickCard: (source) => {
        // Force the pile's top card to its foundation, bypassing the
        // single-click heuristic that prefers tableau moves for runs. A
        // no-op if the top isn't a legal foundation play.
        useGameStore.getState().dispatchMove({
          kind: "autoMoveToFoundation",
          from: source.pileId,
        });
      },
      onDrop: (source, target, cardId, dragSnapshot) => {
        // Capture each dragged card's on-screen position at release time so
        // the scheduler starts their move tweens from the pointer instead of
        // the source pile — avoids a visible "teleport back" on drop.
        if (layout) {
          const baseX = dragSnapshot.pt.x - dragSnapshot.grabOffset.x;
          const baseY = dragSnapshot.pt.y - dragSnapshot.grabOffset.y;
          const overrides = new Map<CardId, { x: number; y: number }>();
          for (let i = 0; i < dragSnapshot.cards.length; i++) {
            overrides.set(dragSnapshot.cards[i].id, {
              x: baseX,
              y: baseY + i * layout.fanDown,
            });
          }
          pendingDragOverrides = overrides;
        }
        useGameStore.getState().dispatchMove({
          kind: "move",
          from: source.pileId,
          to: target,
          cardId,
        });
        // If dispatchMove was a no-op (e.g. rejected by the reducer), the
        // subscription never fired. Clear to avoid applying stale overrides
        // to a later unrelated reconcile.
        pendingDragOverrides = null;
      },
      onDragCancel: (dragSnapshot) => {
        // Invalid drop: animate the dragged cards back to their source pile
        // instead of letting them teleport. The game state didn't change, so
        // the layout still reflects the pre-drag positions.
        if (!layout) return;
        const pile = layout.piles[dragSnapshot.source.pileId];
        if (!pile) return;
        const baseX = dragSnapshot.pt.x - dragSnapshot.grabOffset.x;
        const baseY = dragSnapshot.pt.y - dragSnapshot.grabOffset.y;
        for (let i = 0; i < dragSnapshot.cards.length; i++) {
          const card = dragSnapshot.cards[i];
          const home = pile.cards.find((c) => c.cardId === card.id);
          if (!home) continue;
          animator.add({
            id: card.id,
            cardId: card.id,
            kind: "snapback",
            from: {
              x: baseX,
              y: baseY + i * layout.fanDown,
              face: home.faceUp ? "up" : "down",
            },
            to: {
              x: home.x,
              y: home.y,
              face: home.faceUp ? "up" : "down",
            },
            duration: 180,
            easing: easeOutCubic,
          });
        }
        requestDraw();
      },
      onDragStateChange: (next) => {
        drag = next;
        requestDraw();
      },
      onHoverChange: (pile) => {
        hovered = pile;
        requestDraw();
      },
      isAnimating: () => {
        const s = useGameStore.getState();
        return s.autoCompleteRunning || s.winFinalePlaying;
      },
    });

    // ----- ResizeObserver -----
    let resizeTimer: number | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(recomputeSize, 80);
    });
    ro.observe(container);

    // ----- Visibility: snap mid-tween cards on tab return -----
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") {
        animator.skipToEnd();
        requestDraw();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // ----- Reduced-motion change -----
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = (): void => {
      animator.setReducedMotion(motionMq.matches);
    };
    motionMq.addEventListener?.("change", onMotionChange);

    return () => {
      detachInput();
      unsubGame();
      unsubFinale();
      unsubHint();
      unsubTheme();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      motionMq.removeEventListener?.("change", onMotionChange);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      animator.clear();
      winFinale.stop();
    };
  }, [hydrated]);

  return (
    <>
      <div
        ref={containerRef}
        className="flex-1 w-full"
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-full"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="Solitaire-Brett. Tab zur Stapel-Navigation."
        />
        <CanvasBoardA11y />
      </div>
      {/*
        Win-finale overlay: a separate fixed-positioned canvas that covers
        the full viewport. Hidden in normal play, mounted into view only
        while the WinFinale particles are bouncing — so cards can fly off
        the actual screen edges instead of hitting the gameplay canvas's
        776px right boundary.
      */}
      <canvas
        ref={overlayCanvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-40"
        style={{ display: "none" }}
      />
    </>
  );
}

/**
 * Paint the win-finale particles on the full-viewport overlay canvas. Clears
 * the entire overlay each frame and blits one card sprite per particle. The
 * particles already carry viewport-space coordinates (set up at finale start
 * via overlayOffset) so no further translation is needed here.
 */
function renderFinaleOverlay(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteCache,
  particles: readonly WinFinaleParticle[],
  _offset: { x: number; y: number },
  logicalW: number,
  logicalH: number,
): void {
  ctx.clearRect(0, 0, logicalW, logicalH);
  for (const p of particles) {
    const sprite = sprites.faces.get(p.cardId) ?? sprites.back;
    const margin = spriteMargin(sprite);
    const { w, h } = spriteLogicalSize(sprite);
    ctx.drawImage(sprite, p.x - margin, p.y - margin, w, h);
  }
}

/** A fresh deal has 1..7 cards in tableaus, 24 in stock, nothing else. */
function isFreshDeal(game: GameState): boolean {
  if (game.moveCount !== 0) return false;
  if (game.startedAt !== null) return false;
  if (game.waste.cards.length !== 0) return false;
  if (game.foundations.some((f) => f.cards.length !== 0)) return false;
  if (game.stock.cards.length !== 24) return false;
  for (let i = 0; i < 7; i++) {
    if (game.tableau[i].cards.length !== i + 1) return false;
  }
  return true;
}

/* ---------- Hint scene helpers ---------- */

const HINT_GHOST_PERIOD_MS = 1300;
const HINT_PULSE_PERIOD_MS = 800;

function pileBoxRect(layout: Layout, pileId: PileId): Rect | null {
  const pile = layout.piles[pileId];
  if (!pile) return null;
  return { x: pile.x, y: pile.y, w: pile.w, h: pile.h };
}

/** Where the next card placed onto `target` would land. */
function nextCardSlot(layout: Layout, targetId: PileId): Rect | null {
  const pile = layout.piles[targetId];
  if (!pile) return null;
  const w = pile.w;
  const h = pile.h;
  if (pile.cards.length === 0) {
    return { x: pile.x, y: pile.y, w, h };
  }
  if (pile.kind === "tableau") {
    const top = pile.cards[pile.cards.length - 1];
    return { x: top.x, y: top.y + layout.fanDown, w, h };
  }
  // Foundation / waste / stock: stack at the pile origin.
  return { x: pile.x, y: pile.y, w, h };
}

function computeHintScene(
  layout: Layout,
  active: ActiveHint,
  reduced: boolean,
): HintScene | undefined {
  const elapsed = Date.now() - active.startedAt;
  // Pulse 0..1 (sine) for both rings.
  const pulse =
    (Math.sin((elapsed / HINT_PULSE_PERIOD_MS) * Math.PI * 2) + 1) / 2;

  if (active.hint.kind === "stock") {
    const target = pileBoxRect(layout, "stock");
    if (!target) return undefined;
    return { kind: "stock", action: active.hint.action, target, pulse, draws: active.hint.draws };
  }

  // Move hint: the hinted card is the BOTTOM of a run. Walk up the source
  // pile to collect every face-up card on top, so tableau-run moves (e.g.
  // 8♠ 7♥ 6♣ dragged as a group) preview the full stack instead of just one.
  const idx = layout.cardIndex[active.hint.cardId];
  if (!idx) return undefined;
  const fromPile = layout.piles[idx.pileId];
  if (!fromPile) return undefined;
  const anchor = fromPile.cards[idx.indexInPile];
  if (!anchor) return undefined;

  const runCards: { cardId: CardId; x: number; y: number; w: number; h: number }[] = [];
  if (fromPile.kind === "tableau") {
    for (let i = idx.indexInPile; i < fromPile.cards.length; i++) {
      const c = fromPile.cards[i];
      if (!c.faceUp) break;
      runCards.push(c);
    }
  } else {
    runCards.push(anchor);
  }
  const last = runCards[runCards.length - 1];
  const from: Rect = {
    x: anchor.x,
    y: anchor.y,
    w: anchor.w,
    h: last.y + last.h - anchor.y,
  };

  const slot = nextCardSlot(layout, active.hint.to);
  if (!slot) return undefined;
  // Expand the destination rect downwards by the remaining run height so the
  // player sees where the entire stack will land, not just the bottom card.
  const extraStack = (runCards.length - 1) * layout.fanDown;
  const to: Rect = { x: slot.x, y: slot.y, w: slot.w, h: slot.h + extraStack };

  // Triangle wave 0..1..0 over HINT_GHOST_PERIOD_MS, eased.
  const phase = (elapsed % HINT_GHOST_PERIOD_MS) / HINT_GHOST_PERIOD_MS;
  const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  const eased = tri < 0.5 ? 2 * tri * tri : 1 - Math.pow(-2 * tri + 2, 2) / 2;
  const t = reduced ? 0.5 : eased; // reduced motion: park ghost in the middle

  return {
    kind: "move",
    cardIds: runCards.map((c) => c.cardId),
    from,
    to,
    ghostX: anchor.x + (slot.x - anchor.x) * t,
    ghostY: anchor.y + (slot.y - anchor.y) * t,
    pulse,
  };
}
