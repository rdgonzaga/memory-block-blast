/**
 * MemoryMinigame.tsx
 * --------------------------------------------------------------------------
 * The finale: a 1970s CRT monitor housing the interactive "reallocate the
 * fragmented memory" mini-game. This file sets up the SHELL + React state so
 * the team can wire real drag-and-drop logic later — the scoring/validation is
 * intentionally stubbed (see the TODOs).
 *
 * Hydrate from the .mdx with: <MemoryMinigame client:visible />
 */
import { useMemo, useState } from 'react';

// ---- Game model ------------------------------------------------------------
type Block = {
  id: string;
  addr: string;      // logical address label, e.g. "0x1A"
  status: 'ok' | 'corrupt' | 'relocated';
  slot: number | null; // current grid slot index, or null if undocked
};

const SLOTS = 24; // 8 × 3 playfield
const CORRUPT_SLOTS = [4, 5, 11, 17]; // damaged addresses the player must avoid

function makeInitialBlocks(): Block[] {
  // The instructions that need a new home after the fault.
  return ['0x1A', '0x1B', '0x1C', '0x1D'].map((addr, i) => ({
    id: `blk-${i}`,
    addr,
    status: 'ok',
    slot: null,
  }));
}

export default function MemoryMinigame() {
  // --- State the team will build the drag-and-drop game on top of ---
  const [blocks, setBlocks] = useState<Block[]>(makeInitialBlocks);
  const [dragging, setDragging] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);

  const placed = useMemo(() => blocks.filter((b) => b.slot !== null).length, [blocks]);
  const slotMap = useMemo(() => {
    const m = new Map<number, Block>();
    blocks.forEach((b) => b.slot !== null && m.set(b.slot, b));
    return m;
  }, [blocks]);

  // --- Stubbed handlers — wire real DnD + validation here later ---
  function handleDrop(slot: number) {
    if (dragging === null) return;
    if (CORRUPT_SLOTS.includes(slot) || slotMap.has(slot)) return; // illegal target
    setBlocks((prev) => {
      const next = prev.map((b) => (b.id === dragging ? { ...b, slot, status: 'relocated' as const } : b));
      // TODO(team): replace with real win condition (all blocks on a valid,
      // contiguous run of free slots). For now: solved when all 4 are placed.
      if (next.every((b) => b.slot !== null)) setSolved(true);
      return next;
    });
    setDragging(null);
  }

  // --- Reset game state ---
  function reset() {
    setBlocks(makeInitialBlocks());
    setSolved(false);
  }

  return (
    <section id="finale" className="scroll-mt-16 px-7 pt-16 pb-20 text-center">
      <p className="mb-12 font-term text-[14px] text-ash">Now it's your turn to solve the problem!</p>

      <div className="relative mx-auto max-w-[680px]">
        {/* Phosphor glow */}
        <div className="pointer-events-none absolute -inset-10 rounded-full blur-[20px]" style={{ background: 'radial-gradient(circle,rgba(51,255,102,.28),transparent 65%)' }} />

        {/* Beige plastic chassis */}
        <div className="relative rounded-[26px] px-[34px] pt-[34px] pb-[18px]" style={{ background: 'linear-gradient(180deg,#e8e3d4,#cfc8b6)', boxShadow: 'inset 0 2px 6px rgba(255,255,255,.6),0 30px 80px rgba(0,0,0,.6)' }}>
          {/* Tube bezel */}
          <div className="relative overflow-hidden rounded-[14px] bg-[#0a0f0a] p-4" style={{ boxShadow: 'inset 0 0 50px rgba(0,0,0,.9),inset 0 0 0 3px #1a1a14' }}>
            {/* Screen */}
            <div className="relative animate-flicker overflow-hidden rounded-lg px-[22px] pt-[34px] pb-[22px]" style={{ background: 'radial-gradient(120% 120% at 50% 40%,#04140a,#020802)' }}>
              {/* Scanlines + sweep */}
              <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(0deg,rgba(0,0,0,.35) 0 2px,transparent 2px 4px)' }} />
              <div className="pointer-events-none absolute inset-x-0 h-[60px] animate-scanline" style={{ background: 'linear-gradient(180deg,transparent,rgba(51,255,102,.06),transparent)' }} />

              {solved ? (
                <>
                  <div className="font-display text-[clamp(28px,5vw,46px)] font-bold uppercase tracking-[.08em] text-crt" style={{ textShadow: '0 0 14px rgba(51,255,102,.7)' }}>Mission Complete</div>
                  <p className="mx-auto mb-5 mt-3 max-w-[380px] font-mono text-[11px] leading-relaxed text-crt/70">
                    You just reallocated code and restored program flow — the same computer architecture principles NASA used to bring Voyager 1 back online.
                  </p>
                </>
              ) : (
                <>
                  <div className="font-display text-[clamp(20px,3.6vw,30px)] font-bold uppercase tracking-[.08em] text-crt" style={{ textShadow: '0 0 14px rgba(51,255,102,.7)' }}>Reallocate Memory</div>
                  <p className="mx-auto mb-5 mt-2 max-w-[420px] font-mono text-[11px] leading-relaxed text-crt/70">
                    Drag each surviving instruction block into a healthy address. Avoid the corrupted cells (✕).
                  </p>
                </>
              )}

              {/* Playfield grid */}
              <div className="mx-auto grid max-w-[440px] grid-cols-8 gap-1.5 rounded-xl border border-white/10 bg-black/40 p-5 shadow-2xl backdrop-blur-md">
                {Array.from({ length: SLOTS }).map((_, slot) => {
                  const isCorrupt = CORRUPT_SLOTS.includes(slot);
                  const block = slotMap.get(slot);
                  return (
                    <div
                      key={slot}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(slot)}
                      className={[
                        'flex aspect-square items-center justify-center rounded-[3px] border font-mono text-[8px] transition-colors',
                        isCorrupt ? '!border-dashed !border-alert bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(230,57,70,.15)_2px,rgba(230,57,70,.15)_5px)] !text-alert shadow-[0_0_10px_rgba(230,57,70,.4)]'
                          : block ? '!border-solid !border-crt bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(51,255,102,.15)_2px,rgba(51,255,102,.15)_5px)] !text-crt shadow-[0_0_10px_rgba(51,255,102,.4)]'
                          : 'border-crt/25 bg-crt/[0.04] text-crt/40',
                      ].join(' ')}
                    >
                      {isCorrupt ? '✕' : block ? block.addr : ''}
                    </div>
                  );
                })}
              </div>

              {/* Block tray */}
              <div className="mt-4 flex items-center justify-center gap-2">
                {blocks.filter((b) => b.slot === null).map((b) => (
                  <div
                    key={b.id}
                    draggable
                    onDragStart={() => setDragging(b.id)}
                    onDragEnd={() => setDragging(null)}
                    className="cursor-grab rounded border border-crt bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(51,255,102,.15)_2px,rgba(51,255,102,.15)_5px)] px-2.5 py-1.5 font-mono text-[10px] font-bold text-crt shadow-[0_0_10px_rgba(51,255,102,.4)] active:cursor-grabbing"
                  >
                    {b.addr}
                  </div>
                ))}
                {placed > 0 && (
                  <button onClick={reset} className="ml-2 rounded border border-crt/40 px-2.5 py-1.5 font-mono text-[10px] text-crt/70 hover:bg-crt/10">RESET</button>
                )}
              </div>

              {/* Live telemetry readout */}
              <div className="mt-3.5 grid grid-cols-4 gap-px border border-crt/25 bg-crt/25 text-left font-mono">
                {[
                  ['◷ CURRENT DISTANCE', '15,234,986,612', '24,518,773,394 km'],
                  ['⇄ COMM ROUND-TRIP', '67 hr 04 min 12 sec', 'One-way ~33.5 hours'],
                  ['⌁ SIGNAL STRENGTH', '-161.4 dBm', 'DSN Canberra linked'],
                  ['◷ MISSION CONTROL TIME', '00:20:02', 'JPL DSN 2025 UTC'],
                ].map(([label, big, sub]) => (
                  <div key={label} className="bg-[#031007] px-2 py-2">
                    <p className="m-0 text-[7px] tracking-[.12em] text-crt/50">{label}</p>
                    <p className="m-0 text-[12px] font-bold text-crt">{big}</p>
                    <p className="m-0 text-[7px] text-crt/40">{sub}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3.5 text-left font-mono text-[11px] text-crt">&gt; reallocate --target=free [{placed}/{blocks.length}]<span className="animate-blink">█</span></div>
            </div>
          </div>

          {/* Chassis chin */}
          <div className="flex items-center justify-between px-2 pt-3.5 pb-1">
            <span className="font-display text-[9px] tracking-[.1em] text-[#8a8470]">DSN-9000</span>
            <span className="flex gap-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${solved ? 'bg-crt shadow-[0_0_8px_#33ff66]' : 'bg-[#5a5544]'}`} />
              <span className="h-2.5 w-2.5 rounded-full bg-[#5a5544]" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
