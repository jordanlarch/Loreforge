"use client";

/**
 * BattleMap — PixiJS canvas for the always-on tactical map (#16).
 *
 * Renders the grid, walls, tokens, the active combatant's highlight + movement
 * radius, and supports drag-to-move. It is a *dumb* renderer: it draws the view
 * model it is given and reports drop targets via `onMoveToken`. The engine
 * remains authoritative — every drop is submitted as a `move_entity` command and
 * the map re-renders from the resulting world state (snapping back if rejected).
 *
 * Loaded with `ssr: false` (PixiJS needs the DOM), so the static `pixi.js`
 * import only ever runs in the browser.
 */
import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Text } from "pixi.js";

import {
  CELL_SIZE,
  cellCenter,
  cellToPixel,
  clampCell,
  mapCanvasPixelSize,
  pixelToCell,
  type Cell,
} from "@/lib/battle-map/geometry";
import {
  hpFraction,
  TOKEN_COLORS,
  tokenBorderColor,
  tokenInitials,
  type TokenKind,
} from "@/lib/battle-map/tokens";

export type BattleToken = {
  id: string;
  name: string;
  kind: TokenKind;
  position: Cell;
  hp: { current: number; max: number };
  alive: boolean;
  hostile: boolean;
  isActive: boolean;
  draggable: boolean;
  /** When true, a tap opens exploration interactions (PLAY-7 tracer). */
  interactive?: boolean;
};

/** Active targeting overlay: a range area around an origin + pickable targets. */
export type TargetingOverlay = {
  origin: Cell;
  /** Range in cells (SRD 5-5-5 → a Chebyshev square of this radius). */
  rangeCells: number;
  /** Ids of tokens that may be picked as the target. */
  targetableIds: string[];
};

/** Active AoE aim overlay (#99): a placement range + the current area preview. */
export type AimOverlay = {
  /** Caster cell — the cone apex and the sphere's placement-range center. */
  origin: Cell;
  /** Sphere placement range in cells (Chebyshev square); 0 hides the box. */
  rangeCells: number;
  /** Cells the area currently covers (empty until the player aims). */
  areaCells: Cell[];
  /** Ids of tokens caught in the current area (friend and foe). */
  caughtIds: string[];
};

export type BattleMapProps = {
  cols: number;
  rows: number;
  walls: Cell[];
  tokens: BattleToken[];
  /** Cells the active combatant can still reach this turn (movement radius). */
  reachable: Cell[];
  onMoveToken: (id: string, to: Cell) => void;
  /** When present, the map is in target-picking mode (#58). */
  targeting?: TargetingOverlay;
  onPickTarget?: (id: string) => void;
  /** When present, the map is in AoE aim mode (#99): tap a cell to place. */
  aiming?: AimOverlay;
  onAimCell?: (cell: Cell) => void;
  /** Grid-line layer toggle (PLAY-7); defaults on. */
  showGrid?: boolean;
  /** Exploration mode: tap a token to inspect / interact. */
  onSelectToken?: (id: string) => void;
  /** Unrevealed cells show fog when `fog.revealed` is set (DUN-5). */
  fog?: { revealed: Set<string> };
};

type DragState = {
  id: string;
  sprite: Container;
  origin: Cell;
};

export default function BattleMap(props: BattleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const propsRef = useRef(props);
  const dragRef = useRef<DragState | null>(null);
  const readyRef = useRef(false);

  propsRef.current = props;

  // One-time PixiJS application setup.
  useEffect(() => {
    let destroyed = false;
    // Whether `app.init()` resolved. Until it does, `app.canvas` / `app.destroy`
    // dereference a renderer that does not exist yet and throw — which Strict
    // Mode's synchronous mount→unmount→remount in dev would otherwise trip.
    let initialized = false;
    const app = new Application();
    const el = containerRef.current;

    void app
      .init({
        width: propsRef.current.cols * CELL_SIZE,
        height: propsRef.current.rows * CELL_SIZE,
        background: 0x0d0f12,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })
      .then(() => {
        if (destroyed) {
          app.destroy(true);
          return;
        }
        initialized = true;
        appRef.current = app;
        el?.appendChild(app.canvas);

        const world = new Container();
        app.stage.addChild(world);
        worldRef.current = world;

        app.stage.eventMode = "static";
        app.stage.hitArea = app.screen;
        app.stage.on("pointermove", onPointerMove);
        app.stage.on("pointerup", onPointerUp);
        app.stage.on("pointerupoutside", onPointerUp);
        app.stage.on("pointertap", onStageTap);

        readyRef.current = true;
        redraw();
      });

    return () => {
      destroyed = true;
      readyRef.current = false;
      appRef.current = null;
      worldRef.current = null;
      dragRef.current = null;
      // If init hasn't resolved, the pending `.then` sees `destroyed` and tears
      // the (by-then-initialized) app down itself; touching it here would throw.
      if (!initialized) return;
      if (el && app.canvas.parentNode === el) el.removeChild(app.canvas);
      app.destroy(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw when the view-model changes; resize the Pixi canvas when the scene
  // grid dimensions change (travel between locations with different map sizes).
  useEffect(() => {
    if (!readyRef.current) return;
    const app = appRef.current;
    if (app) {
      const { width, height } = mapCanvasPixelSize(props.cols, props.rows);
      app.renderer.resize(width, height);
      app.stage.hitArea = app.screen;
    }
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.cols,
    props.rows,
    props.walls,
    props.tokens,
    props.reachable,
    props.targeting,
    props.aiming,
    props.showGrid,
    props.fog,
  ]);

  function onPointerMove(event: { global: { x: number; y: number } }) {
    const drag = dragRef.current;
    if (!drag) return;
    drag.sprite.position.set(event.global.x, event.global.y);
  }

  function onPointerUp(event: { global: { x: number; y: number } }) {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const { cols, rows } = propsRef.current;
    const target = clampCell(
      pixelToCell(event.global.x, event.global.y, CELL_SIZE),
      cols,
      rows,
    );
    if (target.x !== drag.origin.x || target.y !== drag.origin.y) {
      propsRef.current.onMoveToken(drag.id, target);
    } else {
      // Returned to origin: redraw to settle the sprite back into its cell.
      redraw();
    }
  }

  // In AoE aim mode (#99) any tap on the grid places the aim cell. Tokens are
  // non-interactive then, so the stage receives every tap.
  function onStageTap(event: { global: { x: number; y: number } }) {
    const { aiming, onAimCell, cols, rows } = propsRef.current;
    if (!aiming || !onAimCell) return;
    const cell = clampCell(
      pixelToCell(event.global.x, event.global.y, CELL_SIZE),
      cols,
      rows,
    );
    onAimCell(cell);
  }

  function redraw() {
    const world = worldRef.current;
    if (!world) return;
    world.removeChildren().forEach((child) => child.destroy());

    const { cols, rows, walls, tokens, reachable, targeting, aiming, showGrid, fog } =
      propsRef.current;

    // Dungeon fog (DUN-5): dim unrevealed cells.
    if (fog) {
      const fogGfx = new Graphics();
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          if (fog.revealed.has(`${x},${y}`)) continue;
          const px = cellToPixel({ x, y }, CELL_SIZE);
          fogGfx.rect(px.x, px.y, CELL_SIZE, CELL_SIZE);
        }
      }
      fogGfx.fill({ color: 0x0a0a12, alpha: 0.82 });
      world.addChild(fogGfx);
    }

    // Grid lines (toggleable layer, PLAY-7).
    if (showGrid !== false) {
      const grid = new Graphics();
      for (let x = 0; x <= cols; x += 1) {
        grid.moveTo(x * CELL_SIZE, 0).lineTo(x * CELL_SIZE, rows * CELL_SIZE);
      }
      for (let y = 0; y <= rows; y += 1) {
        grid.moveTo(0, y * CELL_SIZE).lineTo(cols * CELL_SIZE, y * CELL_SIZE);
      }
      grid.stroke({ width: 1, color: TOKEN_COLORS.grid, alpha: 1 });
      world.addChild(grid);
    }

    // Movement radius.
    if (reachable.length > 0) {
      const radius = new Graphics();
      for (const cell of reachable) {
        const px = cellToPixel(cell, CELL_SIZE);
        radius.rect(px.x, px.y, CELL_SIZE, CELL_SIZE);
      }
      radius.fill({ color: TOKEN_COLORS.accent, alpha: 0.16 });
      world.addChild(radius);
    }

    // Walls.
    if (walls.length > 0) {
      const wallGfx = new Graphics();
      for (const cell of walls) {
        const px = cellToPixel(cell, CELL_SIZE);
        wallGfx.rect(px.x, px.y, CELL_SIZE, CELL_SIZE);
      }
      wallGfx.fill({ color: TOKEN_COLORS.wall, alpha: 1 });
      world.addChild(wallGfx);
    }

    // Targeting range area (a Chebyshev square around the origin).
    if (targeting) {
      const { origin, rangeCells } = targeting;
      const x0 = Math.max(0, origin.x - rangeCells);
      const y0 = Math.max(0, origin.y - rangeCells);
      const x1 = Math.min(cols - 1, origin.x + rangeCells);
      const y1 = Math.min(rows - 1, origin.y + rangeCells);
      const px = cellToPixel({ x: x0, y: y0 }, CELL_SIZE);
      const w = (x1 - x0 + 1) * CELL_SIZE;
      const h = (y1 - y0 + 1) * CELL_SIZE;
      const ring = new Graphics();
      ring.rect(px.x, px.y, w, h).fill({ color: TOKEN_COLORS.hostile, alpha: 0.08 });
      ring
        .rect(px.x, px.y, w, h)
        .stroke({ width: 2, color: TOKEN_COLORS.hostile, alpha: 0.7 });
      world.addChild(ring);
    }

    // AoE aim overlay (#99): a placement-range box (sphere) + the area preview.
    if (aiming) {
      if (aiming.rangeCells > 0) {
        const { origin, rangeCells } = aiming;
        const x0 = Math.max(0, origin.x - rangeCells);
        const y0 = Math.max(0, origin.y - rangeCells);
        const x1 = Math.min(cols - 1, origin.x + rangeCells);
        const y1 = Math.min(rows - 1, origin.y + rangeCells);
        const px = cellToPixel({ x: x0, y: y0 }, CELL_SIZE);
        const w = (x1 - x0 + 1) * CELL_SIZE;
        const h = (y1 - y0 + 1) * CELL_SIZE;
        const box = new Graphics();
        box
          .rect(px.x, px.y, w, h)
          .stroke({ width: 1, color: TOKEN_COLORS.accent, alpha: 0.5 });
        world.addChild(box);
      }
      if (aiming.areaCells.length > 0) {
        const blast = new Graphics();
        for (const cell of aiming.areaCells) {
          const px = cellToPixel(cell, CELL_SIZE);
          blast.rect(px.x, px.y, CELL_SIZE, CELL_SIZE);
        }
        blast.fill({ color: TOKEN_COLORS.hostile, alpha: 0.28 });
        world.addChild(blast);
      }
    }

    // Tokens. Targeting → pickable reticle; aiming → caught highlight (no pick).
    const targetable = new Set(targeting?.targetableIds ?? []);
    const caught = new Set(aiming?.caughtIds ?? []);
    for (const token of tokens) {
      world.addChild(
        buildToken(token, {
          pickable: targetable.has(token.id),
          highlight: targetable.has(token.id) || caught.has(token.id),
          aiming: aiming !== undefined,
        }),
      );
    }
  }

  function buildToken(
    token: BattleToken,
    state: { pickable: boolean; highlight: boolean; aiming: boolean },
  ): Container {
    const sprite = new Container();
    const center = cellCenter(token.position, CELL_SIZE);
    sprite.position.set(center.x, center.y);

    const radius = CELL_SIZE * 0.38;
    const border = tokenBorderColor(token.kind, {
      alive: token.alive,
      hostile: token.hostile,
    });

    if (token.isActive) {
      const ring = new Graphics();
      ring.circle(0, 0, radius + 4).stroke({
        width: 3,
        color: TOKEN_COLORS.accent,
        alpha: 0.9,
      });
      sprite.addChild(ring);
    }

    if (state.highlight) {
      const reticle = new Graphics();
      reticle.circle(0, 0, radius + 6).stroke({
        width: 3,
        color: TOKEN_COLORS.hostile,
        alpha: 0.95,
      });
      sprite.addChild(reticle);
    }

    const body = new Graphics();
    body
      .circle(0, 0, radius)
      .fill({ color: 0x161a21, alpha: 1 })
      .stroke({ width: 3, color: border, alpha: 1 });
    sprite.addChild(body);

    const label = new Text({
      text: tokenInitials(token.name),
      style: {
        fontFamily: "Georgia, serif",
        fontSize: 14,
        fontWeight: "600",
        fill: token.alive ? 0xe8ecf4 : TOKEN_COLORS.downed,
      },
    });
    label.anchor.set(0.5);
    sprite.addChild(label);

    // HP bar beneath the token.
    const barWidth = CELL_SIZE * 0.7;
    const frac = hpFraction(token.hp.current, token.hp.max);
    const bar = new Graphics();
    bar
      .rect(-barWidth / 2, radius + 4, barWidth, 4)
      .fill({ color: 0x000000, alpha: 0.6 });
    if (frac > 0) {
      bar
        .rect(-barWidth / 2, radius + 4, barWidth * frac, 4)
        .fill({ color: frac > 0.5 ? TOKEN_COLORS.accent : TOKEN_COLORS.hostile });
    }
    sprite.addChild(bar);

    if (state.aiming) {
      // Aim mode: tokens are visual only so every grid tap places the aim cell.
    } else if (state.pickable) {
      // Targeting takes precedence over dragging: tap an enemy to pick it.
      sprite.eventMode = "static";
      sprite.cursor = "crosshair";
      sprite.on("pointertap", () => propsRef.current.onPickTarget?.(token.id));
    } else if (token.interactive && propsRef.current.onSelectToken) {
      sprite.eventMode = "static";
      sprite.cursor = "pointer";
      sprite.on("pointertap", () => propsRef.current.onSelectToken?.(token.id));
    } else if (token.draggable) {
      sprite.eventMode = "static";
      sprite.cursor = "grab";
      sprite.on("pointerdown", () => {
        dragRef.current = { id: token.id, sprite, origin: token.position };
        worldRef.current?.addChild(sprite); // bring to top while dragging
      });
    }

    return sprite;
  }

  return <div ref={containerRef} className="touch-none select-none" />;
}
