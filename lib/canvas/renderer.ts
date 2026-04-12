// Renderer: paints a Scene into a CanvasRenderingContext2D.
//
// The renderer never reads from the store directly — it just consumes the
// Scene assembled by CanvasBoard each frame. All sizing comes from the Layout
// and SpriteCache; this module never measures DOM or queries window.

import { spriteLogicalSize, spriteMargin, type SpriteCache } from "./sprites";
import type { HintScene, Layout, Scene, WinFinaleScene } from "./types";
import type { CardId, PileId } from "@/lib/game/types";

const FELT_DARK = "#064d27";
const HOVER_RING = "rgba(110,231,183,0.85)"; // emerald-300/85
const HOVER_RING_GLOW = "rgba(110,231,183,0.18)";
const HINT_RING = "rgba(252,211,77,0.95)"; // amber-300
const HINT_GLOW = "rgba(252,211,77,0.25)";
const HINT_GHOST_ALPHA = 0.7;
const DRAG_GHOST_OPACITY = 0.30;

export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene<SpriteCache>,
): void {
  const { layout, sprites, anims, drag, hoveredPile, winFinale } = scene;

  // 1. Clear to felt-dark
  ctx.save();
  ctx.fillStyle = FELT_DARK;
  ctx.fillRect(0, 0, layout.boardW, layout.boardH);
  ctx.restore();

  // 2. Empty pile slots (background placeholders)
  drawEmptySlots(ctx, layout, sprites);

  // 3. Drop hover highlight
  if (drag && hoveredPile) {
    drawDropHighlight(ctx, layout, hoveredPile);
  }

  // Build a quick lookup for cards being dragged so we don't paint them in
  // the main pass (we paint them in the drag layer instead).
  const dragIds = drag ? drag.cardIds : null;
  const launchedIds = winFinale?.launchedIds ?? null;

  // 4. Cards: bottom-to-top per pile, skipping suppressed (animated),
  //    dragged, and finale-launched cards.
  drawAllCards(ctx, layout, sprites, anims.suppressIds, dragIds, launchedIds);

  // 5. Animation layer
  drawAnimationLayer(ctx, sprites, anims);

  // 5b. Win-finale particle layer (in front of everything except drag).
  if (winFinale && winFinale.particles.length > 0) {
    drawWinFinaleLayer(ctx, sprites, winFinale.particles);
  }

  // 5c. Hint overlay (above static cards, below drag).
  if (scene.hint) {
    drawHintLayer(ctx, sprites, layout, scene.hint);
  }

  // 6. Drag layer (always on top)
  if (drag) {
    drawDragLayer(ctx, sprites, drag, layout.fanDown);
  }
}

/* ---------- Layers ---------- */

function drawEmptySlots(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  sprites: SpriteCache,
): void {
  for (const pile of Object.values(layout.piles)) {
    if (pile.cards.length > 0) continue;
    let sprite: HTMLCanvasElement | null = null;
    if (pile.kind === "stock") {
      // The recycle hint is shown if waste has cards — but we don't know that
      // here. The renderer is given a flag in the Scene? Simpler: we always
      // draw the recycle variant; if we want to omit it the layout could
      // surface a hint. For now: show ↻ when stock is empty so the user
      // discovers the recycle action.
      sprite = sprites.emptyStockRecycle;
    } else if (pile.kind === "tableau") {
      sprite = sprites.emptyTableau;
    } else if (pile.kind === "foundation") {
      sprite = sprites.emptyFoundation;
    }
    // Waste has no empty placeholder; it's invisible when empty.
    if (sprite) {
      blitSprite(ctx, sprite, pile.x, pile.y);
    }
  }
}

function drawDropHighlight(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  hoveredPile: PileId,
): void {
  const pile = layout.piles[hoveredPile];
  if (!pile) return;
  const r = pile.dropRect;
  ctx.save();
  // Outer glow
  ctx.lineWidth = 6;
  ctx.strokeStyle = HOVER_RING_GLOW;
  strokeRoundRect(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, layout.cardW * 0.06);
  // Inner ring
  ctx.lineWidth = 2;
  ctx.strokeStyle = HOVER_RING;
  strokeRoundRect(ctx, r.x, r.y, r.w, r.h, layout.cardW * 0.06);
  ctx.restore();
}

function drawAllCards(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  sprites: SpriteCache,
  suppressIds: Set<CardId>,
  dragIds: Set<CardId> | null,
  launchedIds: ReadonlySet<CardId> | null,
): void {
  for (const pile of Object.values(layout.piles)) {
    // Stock and foundation only show the top card visually; tableau/waste
    // need every visible card painted bottom-up so the fan stacks correctly.
    if (pile.kind === "stock" || pile.kind === "foundation") {
      // For foundations during the win finale we walk top→bottom and skip
      // any card that's already been launched into the particle layer, so
      // the next card "underneath" is exposed naturally.
      let top: typeof pile.cards[number] | null = null;
      if (pile.kind === "foundation" && launchedIds && launchedIds.size > 0) {
        for (let i = pile.cards.length - 1; i >= 0; i--) {
          const c = pile.cards[i];
          if (!launchedIds.has(c.cardId)) {
            top = c;
            break;
          }
        }
      } else {
        top = pile.cards[pile.cards.length - 1] ?? null;
      }
      if (!top) continue;
      if (suppressIds.has(top.cardId) || dragIds?.has(top.cardId)) continue;
      const sprite = top.faceUp
        ? sprites.faces.get(top.cardId) ?? sprites.back
        : sprites.back;
      blitSprite(ctx, sprite, top.x, top.y);
      continue;
    }

    if (pile.kind === "waste") {
      // Render only the visible (last drawMode) cards in waste, in fan order.
      // For simplicity we render every card — the non-visible ones share the
      // base x with the bottom of the fan and end up overdrawn anyway.
      for (const c of pile.cards) {
        if (suppressIds.has(c.cardId) || dragIds?.has(c.cardId)) continue;
        const sprite = c.faceUp
          ? sprites.faces.get(c.cardId) ?? sprites.back
          : sprites.back;
        blitSprite(ctx, sprite, c.x, c.y);
      }
      continue;
    }

    // Tableau: bottom-to-top
    for (const c of pile.cards) {
      if (suppressIds.has(c.cardId) || dragIds?.has(c.cardId)) continue;
      const sprite = c.faceUp
        ? sprites.faces.get(c.cardId) ?? sprites.back
        : sprites.back;
      blitSprite(ctx, sprite, c.x, c.y);
    }
  }
}

function drawAnimationLayer(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteCache,
  anims: Scene<SpriteCache>["anims"],
): void {
  for (const a of anims.active) {
    const sprite =
      a.face === "up"
        ? sprites.faces.get(a.tween.cardId) ?? sprites.back
        : sprites.back;
    if (a.scaleX === 1) {
      blitSprite(ctx, sprite, a.x, a.y);
    } else {
      // Flip animation: scale around the card's vertical centerline.
      const centerX = a.x + sprites.cardW / 2;
      ctx.save();
      ctx.translate(centerX, a.y);
      ctx.scale(Math.max(0.001, a.scaleX), 1);
      ctx.translate(-sprites.cardW / 2, 0);
      blitSprite(ctx, sprite, 0, 0);
      ctx.restore();
    }
  }
}

function drawWinFinaleLayer(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteCache,
  particles: WinFinaleScene["particles"],
): void {
  for (const p of particles) {
    const sprite = sprites.faces.get(p.cardId) ?? sprites.back;
    blitSprite(ctx, sprite, p.x, p.y);
  }
}

function drawHintLayer(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteCache,
  layout: Layout,
  hint: HintScene,
): void {
  const radius = layout.cardW * 0.08;
  if (hint.kind === "stock") {
    drawHintRing(ctx, hint.target, radius, hint.pulse);
    drawDrawsBadge(ctx, hint.target, hint.draws, layout.cardW);
    return;
  }
  // move: ring on source, ring on destination, ghost card sliding between.
  drawHintRing(ctx, hint.from, radius, hint.pulse);
  drawHintRing(ctx, hint.to, radius, hint.pulse);
  const sprite = sprites.faces.get(hint.cardId) ?? sprites.back;
  ctx.save();
  ctx.globalAlpha = HINT_GHOST_ALPHA;
  blitSprite(ctx, sprite, hint.ghostX, hint.ghostY);
  ctx.restore();
}

function drawHintRing(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  radius: number,
  pulse: number,
): void {
  // Pulse ranges 0..1 → glow alpha 0.15..0.45 and ring alpha 0.6..1.
  const glowAlpha = 0.15 + pulse * 0.3;
  const ringAlpha = 0.6 + pulse * 0.4;
  ctx.save();
  ctx.lineWidth = 6;
  ctx.strokeStyle = HINT_GLOW.replace("0.25", glowAlpha.toFixed(3));
  strokeRoundRect(ctx, rect.x - 3, rect.y - 3, rect.w + 6, rect.h + 6, radius);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = HINT_RING.replace("0.95", ringAlpha.toFixed(3));
  strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.restore();
}

function drawDrawsBadge(
  ctx: CanvasRenderingContext2D,
  target: { x: number; y: number; w: number; h: number },
  draws: number,
  cardW: number,
): void {
  if (draws <= 0) return;
  const text = `${draws}x`;
  const fontSize = Math.round(cardW * 0.28);
  ctx.save();
  ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  const metrics = ctx.measureText(text);
  const padX = fontSize * 0.45;
  const padY = fontSize * 0.25;
  const bw = metrics.width + padX * 2;
  const bh = fontSize + padY * 2;
  const bx = target.x + target.w / 2 - bw / 2;
  const by = target.y + target.h + 6;

  // Badge background
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  const br = bh / 2;
  ctx.beginPath();
  const rc = ctx as CanvasRenderingContext2D & {
    roundRect?: (x: number, y: number, w: number, h: number, r: number) => void;
  };
  if (typeof rc.roundRect === "function") {
    rc.roundRect(bx, by, bw, bh, br);
  } else {
    ctx.moveTo(bx + br, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + bh, br);
    ctx.arcTo(bx + bw, by + bh, bx, by + bh, br);
    ctx.arcTo(bx, by + bh, bx, by, br);
    ctx.arcTo(bx, by, bx + bw, by, br);
    ctx.closePath();
  }
  ctx.fill();

  // Badge text
  ctx.fillStyle = "#fcd34d"; // amber-300
  ctx.fillText(text, bx + bw / 2, by + bh / 2);
  ctx.restore();
}

function drawDragLayer(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteCache,
  drag: NonNullable<Scene<SpriteCache>["drag"]>,
  fanDown: number,
): void {
  // Optional drop shadow lift via globalAlpha tweak — handled by the sprite
  // shadow already. We just stack the run with fanDown spacing.
  const baseX = drag.pt.x - drag.grabOffset.x;
  const baseY = drag.pt.y - drag.grabOffset.y;
  for (let i = 0; i < drag.cards.length; i++) {
    const card = drag.cards[i];
    const sprite = sprites.faces.get(card.id) ?? sprites.back;
    blitSprite(ctx, sprite, baseX, baseY + i * fanDown);
  }
}

/* ---------- Helpers ---------- */

function blitSprite(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
): void {
  const margin = spriteMargin(sprite);
  const { w, h } = spriteLogicalSize(sprite);
  ctx.drawImage(sprite, x - margin, y - margin, w, h);
}

function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const c = ctx as CanvasRenderingContext2D & {
    roundRect?: (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number | DOMPointInit | (number | DOMPointInit)[],
    ) => void;
  };
  ctx.beginPath();
  if (typeof c.roundRect === "function") {
    c.roundRect(x, y, w, h, r);
  } else {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
  ctx.stroke();
}

// silence unused warning for the renderer's intentional opacity constant
void DRAG_GHOST_OPACITY;
