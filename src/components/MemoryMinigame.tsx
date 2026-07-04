/**
 * MemoryMinigame.tsx
 * --------------------------------------------------------------------------
 * The finale: a command-console mini-game — the 2024 Voyager 1 FDS Memory
 * Rescue. Block-Blast-style tetromino pieces, dealt three at a time, get
 * dragged onto a bigger memory grid before radiation seals it off and the
 * clock runs out.
 *
 * All piece art is drawn with CSS gradients/shadows in this file — no image
 * assets are fetched or bundled, so there's nothing to source or license.
 *
 * Drag & drop uses the Pointer Events API (not HTML5 drag/drop) so it works
 * reliably on touch devices and inside sandboxed/iframe previews.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

// ---- Shape model ------------------------------------------------------------
type Cell = [number, number]; // [dx, dy] offset from a piece's anchor (top-left)
type Shape = Cell[];

type Block = {
  id: string;
  label: string;
  shape: Shape;
  color: string;
  slot: number | null; // anchor slot index once placed, null = not placed
  revealed: boolean; // whether it's in the visible 3-piece tray yet
};

type GameState = 'playing' | 'transmitting' | 'success' | 'fail';

const GRID_COLUMNS = 9;
const GRID_ROWS = 6;
const SLOTS = GRID_COLUMNS * GRID_ROWS; // 54
const HAND_SIZE = 3;
const INITIAL_TIME = 100;
const DECAY_TICK_MS = 1100;
const RADIATION_INTERVAL_MS = 5200;
const RADIATION_WARNING_MS = 900;
const TRANSMIT_DELAY_MS = 5000;

// Tetromino-family shapes, offsets relative to (0,0).
const SHAPES = {
  mono: [[0, 0]] as Shape,
  domino: [[0, 0], [1, 0]] as Shape,
  dominoV: [[0, 0], [0, 1]] as Shape,
  corner: [[0, 0], [1, 0], [0, 1]] as Shape,
  triple: [[0, 0], [1, 0], [2, 0]] as Shape,
  square: [[0, 0], [1, 0], [0, 1], [1, 1]] as Shape,
  tShape: [[0, 0], [1, 0], [2, 0], [1, 1]] as Shape,
  sShape: [[1, 0], [2, 0], [0, 1], [1, 1]] as Shape,
  zShape: [[0, 0], [1, 0], [1, 1], [2, 1]] as Shape,
  lShape: [[0, 0], [0, 1], [0, 2], [1, 2]] as Shape,
};

// The 10-block pool for a full run, each with a Voyager-flavored label and a
// distinct accent color (reds are reserved for hazards, so none appear here).
const BLOCK_TEMPLATE: Array<Pick<Block, 'id' | 'label' | 'shape' | 'color'>> = [
  { id: 'blk-jmp', label: 'JMP_PTR', shape: SHAPES.mono, color: '#33ff99' },
  { id: 'blk-lnk', label: 'LNK_SEG', shape: SHAPES.domino, color: '#5ce1ff' },
  { id: 'blk-pwr', label: 'PWR_CELL', shape: SHAPES.dominoV, color: '#ffd166' },
  { id: 'blk-nav', label: 'NAV_TRI', shape: SHAPES.corner, color: '#ff9f5c' },
  { id: 'blk-eng', label: 'ENG_PACK', shape: SHAPES.triple, color: '#7dff5c' },
  { id: 'blk-sci', label: 'SCI_PACK', shape: SHAPES.square, color: '#c792ff' },
  { id: 'blk-cmd', label: 'CMD_BUF', shape: SHAPES.tShape, color: '#5c8aff' },
  { id: 'blk-gyr', label: 'GYRO_BLK', shape: SHAPES.sShape, color: '#4dffe0' },
  { id: 'blk-aac', label: 'AACS_SEG', shape: SHAPES.zShape, color: '#ffe14d' },
  { id: 'blk-tlm', label: 'TLM_ARR', shape: SHAPES.lShape, color: '#ff8fd6' },
];

function makeInitialBlocks(): Block[] {
  return BLOCK_TEMPLATE.map((b, i) => ({ ...b, slot: null, revealed: i < HAND_SIZE }));
}

// ---- Placement / winnability solver ----------------------------------------
function shapeCells(shape: Shape, anchor: number): number[] | null {
  const anchorRow = Math.floor(anchor / GRID_COLUMNS);
  const anchorCol = anchor % GRID_COLUMNS;
  const cells: number[] = [];
  for (const [dx, dy] of shape) {
    const col = anchorCol + dx;
    const row = anchorRow + dy;
    if (col < 0 || col >= GRID_COLUMNS || row < 0 || row >= GRID_ROWS) return null;
    cells.push(row * GRID_COLUMNS + col);
  }
  return cells;
}

function getValidAnchors(shape: Shape, freeSlots: Set<number>): number[] {
  const anchors: number[] = [];
  for (let anchor = 0; anchor < SLOTS; anchor++) {
    const cells = shapeCells(shape, anchor);
    if (cells && cells.every((c) => freeSlots.has(c))) anchors.push(anchor);
  }
  return anchors;
}

// Backtracking search: can every shape simultaneously fit inside freeSlots?
function canPlaceAllShapes(shapes: Shape[], freeSlots: Set<number>): boolean {
  const sorted = [...shapes].sort((a, b) => b.length - a.length);
  function backtrack(idx: number, free: Set<number>): boolean {
    if (idx === sorted.length) return true;
    for (const anchor of getValidAnchors(sorted[idx], free)) {
      const cells = shapeCells(sorted[idx], anchor)!;
      const next = new Set(free);
      cells.forEach((c) => next.delete(c));
      if (backtrack(idx + 1, next)) return true;
    }
    return false;
  }
  return backtrack(0, freeSlots);
}

// Random hardware-corrupted sectors, retried until the opening hand is
// guaranteed to fit somewhere on the board.
function generateCorruptSlots(): number[] {
  const openingShapes = BLOCK_TEMPLATE.slice(0, HAND_SIZE).map((b) => b.shape);
  for (let attempt = 0; attempt < 500; attempt++) {
    const count = 6 + Math.floor(Math.random() * 3); // 6-8
    const chosen = new Set<number>();
    while (chosen.size < count) chosen.add(Math.floor(Math.random() * SLOTS));

    const free = new Set<number>();
    for (let i = 0; i < SLOTS; i++) if (!chosen.has(i)) free.add(i);

    if (canPlaceAllShapes(openingShapes, free)) return [...chosen];
  }
  return [4, 5, 12, 20, 33, 41]; // guaranteed-winnable fallback
}

function toHex(slot: number): string {
  return `0x${slot.toString(16).toUpperCase().padStart(2, '0')}`;
}

function shapeDims(shape: Shape): { width: number; height: number } {
  const width = Math.max(...shape.map((c) => c[0])) + 1;
  const height = Math.max(...shape.map((c) => c[1])) + 1;
  return { width, height };
}

// The drag ghost renders the whole shape centered on the pointer (so the
// player sees exactly what they're holding). To make the drop land where it
// visually looks like it should, the "target" grid cell under the pointer is
// treated as the shape's visual center, not its (0,0) anchor — then we solve
// backwards for the actual top-left anchor slot.
function anchorFromTargetSlot(shape: Shape, targetSlot: number): number | null {
  const { width, height } = shapeDims(shape);
  const centerX = Math.floor((width - 1) / 2);
  const centerY = Math.floor((height - 1) / 2);
  const targetRow = Math.floor(targetSlot / GRID_COLUMNS);
  const targetCol = targetSlot % GRID_COLUMNS;
  const anchorRow = targetRow - centerY;
  const anchorCol = targetCol - centerX;
  if (anchorRow < 0 || anchorCol < 0) return null;
  return anchorRow * GRID_COLUMNS + anchorCol;
}

// Pieces are lifted above the pointer while dragging so a finger doesn't
// block the view of the target cell on touch devices.
const DRAG_LIFT_Y = 46;

// Glossy CSS-only tile, styled after the bevelled block look of stacking
// puzzle games — no external image assets involved.
function Tile({ color, dim = 20 }: { color: string; dim?: number }) {
  return (
    <div
      style={{
        width: dim,
        height: dim,
        borderRadius: Math.max(2, dim * 0.18),
        background: `linear-gradient(160deg, ${color} 0%, ${color}cc 55%, ${color}88 100%)`,
        boxShadow: `inset 0 2px 0 rgba(255,255,255,.55), inset 0 -3px 4px rgba(0,0,0,.4), 0 0 8px ${color}77`,
      }}
    />
  );
}

function PieceIcon({ shape, color, cellSize = 12 }: { shape: Shape; color: string; cellSize?: number }) {
  const width = Math.max(...shape.map((c) => c[0])) + 1;
  const height = Math.max(...shape.map((c) => c[1])) + 1;
  const filled = new Set(shape.map(([x, y]) => `${x},${y}`));
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${width}, ${cellSize}px)`, gap: 2 }}>
      {Array.from({ length: width * height }).map((_, i) => {
        const x = i % width;
        const y = Math.floor(i / width);
        return filled.has(`${x},${y}`) ? (
          <Tile key={i} color={color} dim={cellSize} />
        ) : (
          <div key={i} style={{ width: cellSize, height: cellSize }} />
        );
      })}
    </div>
  );
}

export default function MemoryMinigame() {
  // --- Core Game State ---
  const [blocks, setBlocks] = useState<Block[]>(makeInitialBlocks);
  const [corruptSlots, setCorruptSlots] = useState<number[]>(() => generateCorruptSlots());
  const [radiationSlots, setRadiationSlots] = useState<number[]>([]);
  const [warningSlot, setWarningSlot] = useState<number | null>(null);

  const [signalStrength, setSignalStrength] = useState(INITIAL_TIME);
  const [gameState, setGameState] = useState<GameState>('playing');
  const [logMessage, setLogMessage] = useState('SYSTEM ONLINE. DRAG A BLOCK TO A FREE ADDRESS TO BEGIN.');

  // --- Pointer-based drag state (works for mouse + touch) ---
  const [drag, setDrag] = useState<{ id: string; shape: Shape; label: string; color: string; x: number; y: number } | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);

  // --- Refs so interval/timeout callbacks always see fresh state ---
  const blocksRef = useRef(blocks);
  const radiationRef = useRef(radiationSlots);
  const corruptRef = useRef(corruptSlots);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transmitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { blocksRef.current = blocks; }, [blocks]);
  useEffect(() => { radiationRef.current = radiationSlots; }, [radiationSlots]);
  useEffect(() => { corruptRef.current = corruptSlots; }, [corruptSlots]);

  // --- Derived State ---
  const placedCount = useMemo(() => blocks.filter((b) => b.slot !== null).length, [blocks]);
  const allDone = placedCount === blocks.length;
  const lockedSlots = useMemo(() => new Set([...corruptSlots, ...radiationSlots]), [corruptSlots, radiationSlots]);

  const occupiedMap = useMemo(() => {
    const map = new Map<number, Block>();
    blocks.forEach((b) => {
      if (b.slot === null) return;
      const cells = shapeCells(b.shape, b.slot) ?? [];
      cells.forEach((c) => map.set(c, b));
    });
    return map;
  }, [blocks]);

  const tray = useMemo(() => blocks.filter((b) => b.revealed && b.slot === null), [blocks]);
  const nextUp = useMemo(() => blocks.filter((b) => !b.revealed).slice(0, HAND_SIZE), [blocks]);
  const remainingToPlace = useMemo(() => blocks.filter((b) => b.slot === null).length, [blocks]);

  // --- Cosmic Decay Timer (Signal Strength) ---
  useEffect(() => {
    if (gameState !== 'playing') return;
    const timer = setInterval(() => {
      setSignalStrength((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setGameState('fail');
          setLogMessage('CRITICAL FAILURE: SIGNAL DECAYED TO 0%. PRESS RESET TO REBOOT.');
          return 0;
        }
        return prev - 1;
      });
    }, DECAY_TICK_MS);
    return () => clearInterval(timer);
  }, [gameState]);

  // --- Deal the next hand once the current one is fully placed ---
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (tray.length > 0) return;
    const next = blocks.filter((b) => !b.revealed).slice(0, HAND_SIZE);
    if (next.length === 0) return;
    const nextIds = new Set(next.map((b) => b.id));
    setBlocks((prev) => prev.map((b) => (nextIds.has(b.id) ? { ...b, revealed: true } : b)));
  }, [tray.length, blocks, gameState]);

  // --- Stuck check: if nothing in hand can fit anywhere, the run is over ---
  useEffect(() => {
    if (gameState !== 'playing' || tray.length === 0) return;
    const free = new Set<number>();
    for (let i = 0; i < SLOTS; i++) if (!lockedSlots.has(i) && !occupiedMap.has(i)) free.add(i);
    if (!canPlaceAllShapes(tray.map((b) => b.shape), free)) {
      setGameState('fail');
      setLogMessage('CRITICAL FAILURE: NO FREE SECTOR FITS THE REMAINING BLOCKS. PRESS RESET.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tray, lockedSlots, occupiedMap, gameState]);

  // --- Expanding Cosmic Radiation Loop ---
  useEffect(() => {
    if (gameState !== 'playing' && gameState !== 'transmitting') return;
    const interval = setInterval(() => strikeRadiation(), RADIATION_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  useEffect(() => {
    return () => {
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (transmitTimeoutRef.current) clearTimeout(transmitTimeoutRef.current);
    };
  }, []);

  function fireWarning(slot: number, commit: () => void) {
    setWarningSlot(slot);
    warningTimeoutRef.current = setTimeout(() => {
      commit();
      setWarningSlot(null);
      warningTimeoutRef.current = null;
    }, RADIATION_WARNING_MS);
  }

  function strikeRadiation() {
    const currentBlocks = blocksRef.current;
    const locked = new Set([...corruptRef.current, ...radiationRef.current]);
    if (warningSlot !== null) return;

    const occ = new Map<number, Block>();
    currentBlocks.forEach((b) => {
      if (b.slot === null) return;
      (shapeCells(b.shape, b.slot) ?? []).forEach((c) => occ.set(c, b));
    });

    const candidates: number[] = [];
    for (let i = 0; i < SLOTS; i++) if (!locked.has(i)) candidates.push(i);
    if (candidates.length === 0) return;

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    for (const slot of candidates) {
      const occupant = occ.get(slot);

      if (occupant) {
        fireWarning(slot, () => {
          setBlocks((prev) => prev.map((b) => (b.id === occupant.id ? { ...b, slot: null } : b)));
          setRadiationSlots((prev) => [...prev, slot]);
          setLogMessage(`ALERT: Radiation breach ejected ${occupant.label} from ${toHex(slot)}`);
        });
        return;
      }

      const handShapes = currentBlocks.filter((b) => b.revealed && b.slot === null).map((b) => b.shape);
      const free = new Set<number>();
      for (let i = 0; i < SLOTS; i++) {
        if (locked.has(i) || i === slot || occ.has(i)) continue;
        free.add(i);
      }

      if (handShapes.length === 0 || canPlaceAllShapes(handShapes, free)) {
        fireWarning(slot, () => {
          setRadiationSlots((prev) => [...prev, slot]);
          setLogMessage(`WARNING: Cosmic radiation sealed sector ${toHex(slot)}`);
        });
        return;
      }
    }
  }

  // --- Placement validation (shared by preview + commit) ---
  function checkPlacement(blockId: string, anchorSlot: number): { valid: boolean; cells: number[] | null; reason?: string } {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return { valid: false, cells: null };

    const cells = shapeCells(block.shape, anchorSlot);
    if (!cells) return { valid: false, cells: null, reason: 'Package extends outside the memory bank.' };

    for (const c of cells) {
      if (lockedSlots.has(c)) return { valid: false, cells, reason: `Sector collision or corruption at ${toHex(c)}` };
      const occupant = occupiedMap.get(c);
      if (occupant && occupant.id !== blockId) return { valid: false, cells, reason: `Sector collision or corruption at ${toHex(c)}` };
    }
    return { valid: true, cells };
  }

  function commitDrop(blockId: string, anchorSlot: number) {
    if (gameState !== 'playing') return;
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    const result = checkPlacement(blockId, anchorSlot);
    if (!result.valid) {
      setLogMessage(`ERROR: ${result.reason ?? 'Invalid placement.'}`);
      return;
    }

    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, slot: anchorSlot } : b)));
    setLogMessage(`SUCCESS: Mapped ${block.label} to ${toHex(anchorSlot)}`);
  }

  // --- Pointer drag lifecycle ---
  function startDrag(e: React.PointerEvent, block: Block) {
    if (gameState !== 'playing') return;
    e.preventDefault();
    setDrag({ id: block.id, shape: block.shape, label: block.label, color: block.color, x: e.clientX, y: e.clientY });
  }

  useEffect(() => {
    if (!drag) return;

    function slotUnderPoint(x: number, y: number): number | null {
      const el = document.elementFromPoint(x, y);
      const cell = (el as HTMLElement | null)?.closest('[data-slot]') as HTMLElement | null;
      if (!cell) return null;
      const raw = cell.getAttribute('data-slot');
      return raw !== null ? Number(raw) : null;
    }

    function handleMove(e: PointerEvent) {
      setDrag((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev));
      setHoverSlot(slotUnderPoint(e.clientX, e.clientY - DRAG_LIFT_Y));
    }

    function handleUp(e: PointerEvent) {
      const slot = slotUnderPoint(e.clientX, e.clientY - DRAG_LIFT_Y);
      setDrag((current) => {
        if (current && slot !== null) {
          const anchor = anchorFromTargetSlot(current.shape, slot);
          if (anchor !== null) {
            commitDrop(current.id, anchor);
          } else {
            setLogMessage('ERROR: Package extends outside the memory bank.');
          }
        }
        return null;
      });
      setHoverSlot(null);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id]);

  // --- Actions ---
  function handleTransmit() {
    if (!allDone || gameState !== 'playing') return;
    setGameState('transmitting');
    setLogMessage('ALL SECTORS MAPPED. TRANSMITTING PATCH TO VOYAGER 1...');

    transmitTimeoutRef.current = setTimeout(() => {
      const stillIntact = blocksRef.current.every((b) => b.slot !== null);
      if (stillIntact) {
        setGameState('success');
        setLogMessage('PATCH CONFIRMED: TELEMETRY STREAM STABILIZED.');
      } else {
        setGameState('fail');
        setLogMessage('CRITICAL FAILURE: RADIATION CORRUPTED THE PATCH MID-FLIGHT. PRESS RESET.');
      }
    }, TRANSMIT_DELAY_MS);
  }

  function reset() {
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (transmitTimeoutRef.current) clearTimeout(transmitTimeoutRef.current);
    warningTimeoutRef.current = null;
    transmitTimeoutRef.current = null;

    setBlocks(makeInitialBlocks());
    setCorruptSlots(generateCorruptSlots());
    setRadiationSlots([]);
    setWarningSlot(null);
    setDrag(null);
    setHoverSlot(null);
    setGameState('playing');
    setSignalStrength(INITIAL_TIME);
    setLogMessage('SYSTEM REBOOTED. DRAG A BLOCK TO A FREE ADDRESS TO BEGIN.');
  }

  const isDistressed = gameState === 'fail' || (gameState === 'playing' && signalStrength < 30);

  const previewCells = useMemo(() => {
    if (!drag || hoverSlot === null) return null;
    const anchor = anchorFromTargetSlot(drag.shape, hoverSlot);
    if (anchor === null) return null;
    const { valid, cells } = checkPlacement(drag.id, anchor);
    return cells ? { cells, valid } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, hoverSlot, blocks, lockedSlots]);

  return (
    <section id="finale" className="scroll-mt-16 px-7 pt-16 pb-20 text-center">
      <style>{`
        @keyframes crtShake {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-1px, 1px); }
          40% { transform: translate(1px, -1px); }
          60% { transform: translate(-1px, -1px); }
          80% { transform: translate(1px, 1px); }
        }
        @keyframes warnPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes matrixGlow {
          0% { text-shadow: 0 0 6px rgba(51,255,102,.4); }
          50% { text-shadow: 0 0 18px rgba(51,255,102,.9); }
          100% { text-shadow: 0 0 6px rgba(51,255,102,.4); }
        }
        /* Gives tray pieces a physical IC-chip look: little pin ticks on the
           top and bottom edges of the card, like a real memory module. */
        .mem-chip { position: relative; }
        .mem-chip::before, .mem-chip::after {
          content: '';
          position: absolute;
          left: 6px;
          right: 6px;
          height: 3px;
          background-image: repeating-linear-gradient(90deg, rgba(255,255,255,.4) 0 3px, transparent 3px 7px);
          opacity: .55;
        }
        .mem-chip::before { top: -3px; }
        .mem-chip::after { bottom: -3px; }
        /* Damaged source-chip panel: a faint glitch flicker on the label
           to sell "this hardware is failing" before you even read the copy. */
        @keyframes glitchFlicker {
          0%, 88%, 100% { opacity: 1; transform: translateX(0); }
          90% { opacity: .5; transform: translateX(-1px); }
          92% { opacity: 1; transform: translateX(1px); }
          94% { opacity: .6; transform: translateX(0); }
        }
        .glitch-label { animation: glitchFlicker 3.4s infinite; }
      `}</style>

      <p className="mb-12 font-term text-[14px] text-ash">Now it's your turn to solve the problem!</p>

      <div className="relative mx-auto max-w-[760px]">
        {/* Phosphor glow */}
        <div
          className="pointer-events-none absolute -inset-10 rounded-full blur-[20px]"
          style={{ background: isDistressed ? 'radial-gradient(circle,rgba(230,57,70,.28),transparent 65%)' : 'radial-gradient(circle,rgba(51,255,102,.28),transparent 65%)' }}
        />

        {/* Beige plastic chassis */}
        <div
          className="relative rounded-[26px] px-[28px] pt-[28px] pb-[16px] transition-transform sm:px-[34px] sm:pt-[34px]"
          style={{
            background: 'linear-gradient(180deg,#e8e3d4,#cfc8b6)',
            boxShadow: 'inset 0 2px 6px rgba(255,255,255,.6),0 30px 80px rgba(0,0,0,.6)',
            animation: isDistressed ? 'crtShake 0.28s infinite' : undefined,
          }}
        >
          {/* Tube bezel */}
          <div className="relative overflow-hidden rounded-[14px] bg-[#0a0f0a] p-3 sm:p-4" style={{ boxShadow: 'inset 0 0 50px rgba(0,0,0,.9),inset 0 0 0 3px #1a1a14' }}>
            {/* Screen */}
            <div className="relative animate-flicker overflow-hidden rounded-lg px-[14px] pt-[20px] pb-[16px] sm:px-[20px]" style={{ background: 'radial-gradient(120% 120% at 50% 40%,#04140a,#020802)' }}>
              {/* Scanlines + sweep */}
              <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(0deg,rgba(0,0,0,.35) 0 2px,transparent 2px 4px)' }} />
              <div className="pointer-events-none absolute inset-x-0 h-[60px] animate-scanline" style={{ background: isDistressed ? 'linear-gradient(180deg,transparent,rgba(230,57,70,.1),transparent)' : 'linear-gradient(180deg,transparent,rgba(51,255,102,.06),transparent)' }} />
              {isDistressed && (
                <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle,rgba(230,57,70,.18),transparent 70%)', animation: 'warnPulse 0.9s infinite' }} />
              )}

              {/* Header pill strip */}
              <div className="mb-2.5 flex flex-wrap items-center justify-center gap-1.5">
                {[
                  { label: 'LINK', ok: gameState !== 'fail' },
                  { label: 'DIAGNOSTIC', ok: !isDistressed },
                  { label: `BLOCKS ${placedCount}/${blocks.length}`, ok: true },
                  { label: gameState === 'transmitting' ? 'TX ACTIVE' : gameState === 'success' ? 'CONFIRMED' : 'STANDBY', ok: gameState !== 'fail' },
                ].map((pill) => (
                  <span
                    key={pill.label}
                    className={`rounded-full border px-2.5 py-[3px] font-mono text-[8px] tracking-[.1em] ${pill.ok ? 'border-crt/40 text-crt/80 bg-crt/5' : 'border-alert/50 text-alert bg-alert/10'}`}
                  >
                    {pill.label}
                  </span>
                ))}
              </div>

              {gameState === 'success' ? (
                <>
                  <div className="font-display text-[clamp(22px,4vw,34px)] font-bold uppercase tracking-[.08em] text-crt" style={{ animation: 'matrixGlow 1.6s ease-in-out infinite' }}>
                    Mission Complete
                  </div>
                  <p className="mx-auto mb-3 mt-2 max-w-[420px] font-mono text-[11px] leading-relaxed text-crt/70">
                    All ten code blocks reallocated to healthy memory. 15 billion miles from home, Voyager 1 is talking again — just like the real fix in 2024.
                  </p>
                </>
              ) : gameState === 'fail' ? (
                <>
                  <div className="font-display text-[clamp(22px,4vw,34px)] font-bold uppercase tracking-[.08em] text-alert" style={{ textShadow: '0 0 14px rgba(230,57,70,.7)' }}>SIGNAL LOST</div>
                  <p className="mx-auto mb-3 mt-2 max-w-[380px] font-mono text-[11px] leading-relaxed text-alert/70">
                    The patch never made it out. Hit reset to spin up a fresh memory bank and try the reallocation again.
                  </p>
                </>
              ) : gameState === 'transmitting' ? (
                <>
                  <div className="font-display text-[clamp(16px,3vw,22px)] font-bold uppercase tracking-[.08em] text-crt" style={{ textShadow: '0 0 14px rgba(51,255,102,.7)' }}>Transmitting…</div>
                  <p className="mx-auto mb-3 mt-1 max-w-[420px] font-mono text-[10px] leading-relaxed text-crt/70">
                    Board locked. The patch is racing across 22 light-hours of space — radiation can still knock a block loose before it lands.
                  </p>
                </>
              ) : (
                <>
                  <div className="font-display text-[clamp(16px,3vw,22px)] font-bold uppercase tracking-[.08em] text-crt" style={{ textShadow: '0 0 14px rgba(51,255,102,.7)' }}>Reallocate Memory</div>
                  <p className="mx-auto mb-3 mt-1 max-w-[440px] font-mono text-[10px] leading-relaxed text-crt/70">
                    In 2024, engineers saved Voyager 1 by moving its code to healthy memory. Drag all ten blocks — dealt three at a time — onto free addresses before signal strength hits 0%. Avoid corrupted cells (✕) and spreading radiation (☢).
                  </p>
                </>
              )}

              {/* Threat Meter */}
              <div className="w-full h-1 bg-[#1a1a14] mb-3 overflow-hidden border border-crt/20">
                <div
                  className={`h-full transition-all duration-700 ${signalStrength < 30 ? 'bg-alert' : 'bg-crt'}`}
                  style={{ width: `${signalStrength}%` }}
                />
              </div>

              {/* AVAILABLE MEMORY grid */}
              <div className="mx-auto max-w-[560px] rounded-lg border border-crt/25 bg-black/40 p-3 shadow-2xl backdrop-blur-md">
                <p className="mb-2 text-left font-mono text-[8px] tracking-[.14em] text-crt/50">DESTINATION: HEALTHY MEMORY BANK — {GRID_COLUMNS}×{GRID_ROWS}</p>
                <div className="grid gap-[5px]" style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0,1fr))` }}>
                  {Array.from({ length: SLOTS }).map((_, slot) => {
                    const isCorrupt = corruptSlots.includes(slot);
                    const isRadiation = radiationSlots.includes(slot);
                    const isWarning = warningSlot === slot;
                    const occupant = occupiedMap.get(slot);
                    const inPreview = previewCells?.cells.includes(slot);

                    let content: JSX.Element | string = '';
                    let extraStyle: React.CSSProperties = {};
                    let cellClass = 'relative flex aspect-square items-center justify-center rounded-[4px] border transition-colors overflow-hidden';
                    let addressColor = 'rgba(255,255,255,.32)';
                    const showAddress = !isWarning && !isCorrupt && !isRadiation;

                    if (isWarning) {
                      cellClass += ' !border-solid !border-yellow-300 bg-yellow-300/20';
                      extraStyle.animation = 'warnPulse 0.35s infinite';
                      content = '!';
                    } else if (inPreview) {
                      cellClass += previewCells?.valid ? ' !border-solid !border-crt bg-crt/25' : ' !border-solid !border-alert bg-alert/25';
                      addressColor = 'rgba(255,255,255,.65)';
                    } else if (isCorrupt || isRadiation) {
                      cellClass += ' !border-dashed !border-alert bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(230,57,70,.15)_2px,rgba(230,57,70,.15)_5px)] shadow-[0_0_8px_rgba(230,57,70,.4)]';
                      content = isCorrupt ? '✕' : '☢';
                      extraStyle.color = '#ff9c9c';
                      extraStyle.fontSize = 9;
                    } else if (occupant) {
                      cellClass += ' !border-solid';
                      extraStyle = {
                        borderColor: occupant.color,
                        background: `linear-gradient(160deg, ${occupant.color}55, ${occupant.color}22)`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,.3), inset 0 -2px 3px rgba(0,0,0,.35), 0 0 8px ${occupant.color}66`,
                      };
                      addressColor = 'rgba(255,255,255,.85)';
                    } else {
                      cellClass += ' border-crt/20 bg-crt/[0.03]';
                    }

                    return (
                      <div key={slot} data-slot={slot} className={cellClass} style={extraStyle}>
                        {showAddress && (
                          <span
                            className="pointer-events-none absolute left-[3px] top-[2px] font-mono font-bold leading-none"
                            style={{ fontSize: 8, color: addressColor, textShadow: occupant ? '0 1px 2px rgba(0,0,0,.6)' : 'none' }}
                          >
                            {toHex(slot)}
                          </span>
                        )}
                        <span className="font-mono text-[7px] text-alert">{content}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MEMORY BLOCKS tray — pulled live off a failing donor chip.
                  Styled as visibly damaged hardware (cracked edge, hazard
                  stripes) to contrast with the healthy green destination
                  bank above — mirroring the real 2024 fix, where corrupted
                  FDS memory was evacuated to a working memory bank. */}
              <div className="relative mx-auto mt-2.5 max-w-[560px] overflow-hidden rounded-lg border border-alert/40 bg-[linear-gradient(160deg,rgba(230,57,70,.08),rgba(0,0,0,.3))] p-3">
                <svg className="pointer-events-none absolute left-0 top-0 h-[8px] w-full" viewBox="0 0 300 8" preserveAspectRatio="none">
                  <polyline
                    points="0,7 18,1 34,6 52,0 70,7 88,2 104,6 122,1 140,7 158,2 176,6 194,1 212,7 230,2 248,6 266,1 284,7 300,3"
                    fill="none"
                    stroke="#e63946"
                    strokeWidth="1.4"
                    opacity="0.65"
                  />
                </svg>
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.06]"
                  style={{ backgroundImage: 'repeating-linear-gradient(135deg, #e63946 0 8px, transparent 8px 16px)' }}
                />
                <div className="relative mb-2 flex flex-wrap items-center justify-between gap-1.5">
                  <p className="glitch-label font-mono text-[8px] font-bold tracking-[.14em] text-alert">
                    ⚠ SOURCE: DAMAGED FDS CHIP — EVACUATING BLOCKS
                  </p>
                  <span className="rounded-full border border-alert/40 bg-alert/10 px-2 py-[2px] font-mono text-[7px] tracking-[.08em] text-alert/80">SECTOR 7F FAILING</span>
                </div>
                <div className="relative flex flex-wrap items-center justify-center gap-3">
                  {gameState === 'playing' && tray.length > 0 ? (
                    tray.map((b) => (
                      <div
                        key={b.id}
                        onPointerDown={(e) => startDrag(e, b)}
                        className={`mem-chip flex touch-none select-none flex-col items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.03] px-3 pt-3.5 pb-2.5 active:cursor-grabbing ${drag?.id === b.id ? 'opacity-25' : 'cursor-grab'}`}
                        style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,.05), 0 0 10px ${b.color}22` }}
                      >
                        <PieceIcon shape={b.shape} color={b.color} cellSize={14} />
                        <span className="font-mono text-[8px] font-bold tracking-wide" style={{ color: b.color }}>{b.label}</span>
                        <span className="font-mono text-[6px] tracking-[.08em] text-white/30">{b.shape.length} CELL{b.shape.length !== 1 ? 'S' : ''}</span>
                      </div>
                    ))
                  ) : gameState === 'playing' && allDone ? (
                    <button
                      onClick={handleTransmit}
                      className="animate-pulse rounded border-2 border-crt bg-crt px-5 py-2 font-display text-[12px] font-bold text-[#0a0f0a] hover:bg-[#aaffaa]"
                    >
                      TRANSMIT PATCH
                    </button>
                  ) : (
                    <p className="font-mono text-[9px] text-crt/40">
                      {gameState === 'transmitting' ? 'IN FLIGHT…' : gameState === 'playing' ? 'DEALING NEXT BATCH…' : 'STANDING BY'}
                    </p>
                  )}
                </div>

                {/* Next batch preview + remaining counter */}
                <div className="relative mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-crt/20 bg-black/30 px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] font-bold tracking-[.1em] text-crt/70">NEXT UP</span>
                    {nextUp.length > 0 ? (
                      <div className="flex items-center gap-2">
                        {nextUp.map((b) => (
                          <div key={b.id} className="rounded border border-white/15 bg-black/40 p-1 opacity-80" title={b.label}>
                            <PieceIcon shape={b.shape} color={b.color} cellSize={9} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="font-mono text-[9px] text-crt/40">— none queued —</span>
                    )}
                  </div>
                  <span className="whitespace-nowrap rounded-full border border-crt/40 bg-crt/10 px-2.5 py-1 font-mono text-[9px] font-bold tracking-[.08em] text-crt">
                    {remainingToPlace} BLOCK{remainingToPlace !== 1 ? 'S' : ''} LEFT
                  </span>
                </div>
              </div>

              {/* Bottom bar: log + reset */}
              <div className="mx-auto mt-2.5 flex max-w-[560px] items-center gap-2 rounded-full border border-crt/25 bg-black/40 px-3 py-2">
                <span className={`flex-1 truncate text-left font-mono text-[10px] ${gameState === 'fail' ? 'text-alert' : gameState === 'success' ? 'text-green-300' : 'text-crt'}`}>
                  &gt; {logMessage}<span className="animate-blink">█</span>
                </span>
                {placedCount > 0 || gameState !== 'playing' ? (
                  <button
                    onClick={reset}
                    className="shrink-0 rounded-full border border-alert/60 bg-alert/15 px-3.5 py-1.5 font-mono text-[10px] font-bold tracking-[.05em] text-alert hover:bg-alert/25"
                  >
                    ⟲ RESET
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Chassis chin */}
          <div className="flex items-center justify-between px-2 pt-3.5 pb-1">
            <span className="font-display text-[9px] tracking-[.1em] text-[#8a8470]">DSN-9000</span>
            <span className="flex gap-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${gameState === 'success' ? 'bg-crt shadow-[0_0_8px_#33ff66]' : gameState === 'fail' ? 'bg-alert shadow-[0_0_8px_#e63946]' : 'bg-[#5a5544]'}`} />
              <span className="h-2.5 w-2.5 rounded-full bg-[#5a5544]" />
            </span>
          </div>
        </div>
      </div>

      {/* Floating drag ghost — renders the FULL shape footprint, centered on
          the pointer and lifted above it. This is the same geometry the
          anchor solver assumes, so the piece drops exactly where it looks
          like it will. */}
      {drag && (
        <div
          className="pointer-events-none fixed z-50 flex flex-col items-center gap-1 rounded-lg border border-white/15 bg-[#04140a]/90 px-2.5 py-2 shadow-2xl"
          style={{ left: drag.x, top: drag.y - DRAG_LIFT_Y, transform: 'translate(-50%, -50%)', boxShadow: `0 0 16px ${drag.color}55, 0 10px 24px rgba(0,0,0,.6)` }}
        >
          <PieceIcon shape={drag.shape} color={drag.color} cellSize={18} />
          <span className="font-mono text-[8px] font-bold tracking-wide" style={{ color: drag.color }}>{drag.label}</span>
        </div>
      )}
    </section>
  );
}
