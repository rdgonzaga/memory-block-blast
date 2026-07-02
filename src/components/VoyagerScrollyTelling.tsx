/**
 * VoyagerScrollyTelling.tsx
 * --------------------------------------------------------------------------
 * The full scroll-driven narrative for the "Memory Block Blast" exhibit.
 *
 * Why GSAP ScrollTrigger (vs Framer Motion): this spec needs PINNED sections
 * (the title/background pins while text + the memory grid scrub past) AND true
 * scroll-scrubbed timelines. `pin: true` + `scrub: true` do that natively;
 * Framer's useScroll/useTransform is great for simple reveals but pinning long
 * scrubbed timelines is far cleaner in GSAP. All effects below are scrubbed —
 * nothing "fires once".
 *
 * Hydrate from the .mdx with: <VoyagerScrollyTelling client:load />
 *
 * NOTE: the locked ExhibitLayout.astro owns the <title>/<author>/<readingTime>
 * chrome + Tailwind/fonts. The page-specific Mission-Control HUD is rendered
 * HERE (a generic layout won't have it) and ticks live via an interval.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

// ---- Memory grid model -----------------------------------------------------
const GRID = 48; // 8 cols × 6 rows
const FRAG = [5, 6, 7, 13, 18, 19, 26, 27, 33, 34, 40, 41]; // corrupted addresses
const HEX = ['7F', '03', 'A1', 'FF', '2C', '90', '5E', '11', 'C8', '04', 'D2', '6B'];
const addr = (i: number) => '0x' + i.toString(16).padStart(2, '0').toUpperCase();

type CellState = 'idle' | 'scanned' | 'active' | 'corrupt' | 'freed' | 'relocated';

const CELL_CLASS: Record<CellState, string> = {
  idle:      'border-orange/20 bg-white/[0.02] text-ash/40',
  scanned:   'border-orange/45 bg-orange/15 text-orange',
  active:    'border-orange bg-orange text-space shadow-[0_0_18px_rgba(250,102,2,.7)]',
  corrupt:   'border border-dashed border-alert bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(230,57,70,.15)_2px,rgba(230,57,70,.15)_5px)] text-alert shadow-[0_0_10px_rgba(230,57,70,.4)]',
  freed:     'border-white/10 bg-white/[0.02] text-ash/20',
  relocated: 'border border-crt bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(51,255,102,.15)_2px,rgba(51,255,102,.15)_5px)] text-crt shadow-[0_0_10px_rgba(51,255,102,.4)]',
};

function MemoryGrid({ states }: { states: CellState[] }) {
  return (
    <div className="grid grid-cols-8 gap-1.5 rounded-xl border border-white/10 bg-black/40 p-5 font-mono shadow-2xl backdrop-blur-md">
      {Array.from({ length: GRID }).map((_, i) => (
        <div
          key={i}
          className={`flex aspect-square items-center justify-center rounded-[3px] border text-[8px] transition-colors duration-150 ${CELL_CLASS[states[i] ?? 'idle']}`}
        >
          {addr(i)}
        </div>
      ))}
    </div>
  );
}

// ---- Pure progress → cell-state mappers (mirror the prototype) --------------
function addressingStates(p: number): CellState[] {
  const ptr = Math.floor(Math.min(p, 0.999) * GRID);
  return Array.from({ length: GRID }, (_, i) =>
    i < ptr ? 'scanned' : i === ptr ? 'active' : 'idle',
  );
}
function mappingStates(p: number): CellState[] {
  const n = Math.floor(p * FRAG.length);
  const lost = new Set(FRAG.slice(0, n));
  return Array.from({ length: GRID }, (_, i) => (lost.has(i) ? 'corrupt' : 'scanned'));
}
function solutionStates(p: number): CellState[] {
  if (p < 0.5) {
    return Array.from({ length: GRID }, (_, i) => (FRAG.includes(i) ? 'corrupt' : 'scanned'));
  }
  const moved = Math.floor(((p - 0.5) / 0.5) * FRAG.length);
  return Array.from({ length: GRID }, (_, i) => {
    const fragIdx = FRAG.indexOf(i);
    if (fragIdx > -1) return fragIdx < moved ? 'freed' : 'corrupt';
    if (i >= GRID - moved) return 'relocated';
    return 'scanned';
  });
}

// ---- Sticky Mission-Control HUD (page-specific; ticks live) ----------------
function MissionHud() {
  const [mi, setMi] = useState(15_234_986_612);
  const [km, setKm] = useState(24_518_773_394);
  const [sec, setSec] = useState(20 * 60 + 2);
  useEffect(() => {
    const id = setInterval(() => {
      setMi((v) => v + 38);
      setKm((v) => v + 61);
      setSec((v) => v + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (v: number) => String(v).padStart(2, '0');
  const clock = `${pad(Math.floor(sec / 3600) % 100)}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`;
  const cell = 'bg-black/85 px-3.5 py-2.5';
  const label = 'm-0 text-[9px] uppercase tracking-[.16em] text-orange';
  const big = 'm-0 mt-0.5 text-sm font-bold text-ghost';
  return (
    <header className="sticky top-0 z-40 grid grid-cols-2 gap-px border-b border-orange/35 bg-orange/20 backdrop-blur-md md:grid-cols-4">
      <div className={cell}><p className={label}>▸ Current Distance</p><p className={big}>{mi.toLocaleString('en-US')} <span className="text-[9px] text-ash">mi</span></p><p className="m-0 text-[9px] text-ash/40">{km.toLocaleString('en-US')} km</p></div>
      <div className={cell}><p className={label}>⇄ Comm Round-Trip</p><p className={big}>67 hr 04 min 12 sec</p><p className="m-0 text-[9px] text-ash/40">One-way ~33.5 hours</p></div>
      <div className={cell}><p className={label}>⌁ Signal Strength</p><p className={big}>-161.4 <span className="text-[9px] text-ash">dBm</span></p><p className="m-0 text-[9px] text-ash/40">DSN Canberra connected</p></div>
      <div className={cell}><p className={label}>◷ Mission Control Time</p><p className={big}>{clock}</p><p className="m-0 text-[9px] text-ash/40">JPL DSN 2025 UTC</p></div>
    </header>
  );
}

export default function VoyagerScrollyTelling() {
  const root = useRef<HTMLDivElement>(null);
  const [addrP, setAddrP] = useState(0);
  const [mapP, setMapP] = useState(0);
  const [solP, setSolP] = useState(0);

  useLayoutEffect(() => {
    const ctx = gsap.context((self) => {
      const q = self.selector!;

      // Parallax — planets drift slower/opposite to scroll for depth.
      q<HTMLElement>('[data-parallax]').forEach((el) => {
        gsap.to(el, {
          yPercent: parseFloat(el.dataset.speed || '-12'),
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });

      // Scroll-scrubbed reveals (slide / fade / mask).
      q<HTMLElement>('[data-reveal]').forEach((el) => {
        const v = el.dataset.reveal;
        const from: gsap.TweenVars =
          v === 'left'  ? { x: -90, autoAlpha: 0 } :
          v === 'right' ? { x: 90, autoAlpha: 0 } :
          v === 'mask'  ? { clipPath: 'inset(0 0 100% 0)', y: 24, autoAlpha: 0 } :
          v === 'scale' ? { scale: 0.84, autoAlpha: 0 } :
                          { y: 48, autoAlpha: 0 };
        gsap.from(el, {
          ...from,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 45%', scrub: true },
        });
      });

      // Pinned, scrubbed memory stages. The stage pins; cell-state is driven by
      // self.progress so the grid animates AS you scroll (not on enter).
      const pin = (sel: string, set: (p: number) => void) => {
        const section = q<HTMLElement>(sel)[0];
        if (!section) return;
        ScrollTrigger.create({
          trigger: section,
          start: 'top top',
          end: '+=170%',
          pin: section.querySelector('[data-stage]') as HTMLElement,
          pinSpacing: true,
          scrub: true,
          onUpdate: (st) => set(+st.progress.toFixed(3)),
        });
      };
      pin('#addressing', setAddrP);
      pin('#mapping', setMapP);
      pin('#solution', setSolP);
    }, root);

    return () => ctx.revert();
  }, []);

  const lost = Math.floor(mapP * FRAG.length);
  const ptr = Math.floor(Math.min(addrP, 0.999) * GRID);

  return (
    <div ref={root} className="relative font-sans text-ghost">
      {/* ===== Galaxy Background (fixed, behind everything) ===== */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-space">
        {/* Nebula clouds */}
        <div
          className="absolute inset-0 opacity-[0.35] mix-blend-screen"
          style={{
            backgroundImage: `
              radial-gradient(circle at 15% 50%, rgba(76, 29, 149, 0.4), transparent 45%),
              radial-gradient(circle at 85% 30%, rgba(15, 118, 110, 0.5), transparent 55%),
              radial-gradient(circle at 50% 80%, rgba(153, 27, 27, 0.3), transparent 50%),
              radial-gradient(circle at 70% 90%, rgba(20, 40, 120, 0.4), transparent 40%),
              radial-gradient(circle at 30% 10%, rgba(150, 60, 20, 0.3), transparent 45%)
            `
          }}
        />
        {/* Drifting Stars - Parallax Layers */}
        <div
          className="absolute inset-0 animate-drift opacity-80"
          style={{
            backgroundImage: `
              url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Ccircle cx='50' cy='50' r='1.5' fill='%23fff' opacity='0.8'/%3E%3Ccircle cx='250' cy='150' r='2' fill='%23fff' opacity='0.6'/%3E%3Ccircle cx='100' cy='300' r='1' fill='%23fff' opacity='0.4'/%3E%3Ccircle cx='350' cy='350' r='1.5' fill='%23fff' opacity='0.9'/%3E%3Ccircle cx='150' cy='100' r='1' fill='%23fff' opacity='0.7'/%3E%3Ccircle cx='300' cy='50' r='2.5' fill='%23fff' opacity='0.3'/%3E%3Ccircle cx='50' cy='250' r='1' fill='%23fff' opacity='0.5'/%3E%3Ccircle cx='250' cy='300' r='0.5' fill='%23fff' opacity='0.8'/%3E%3Ccircle cx='350' cy='150' r='1.5' fill='%23fff' opacity='0.6'/%3E%3Ccircle cx='100' cy='150' r='2' fill='%23fff' opacity='0.4'/%3E%3C/svg%3E"),
              url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Ccircle cx='30' cy='80' r='1' fill='%23fff' opacity='0.7'/%3E%3Ccircle cx='180' cy='40' r='1.5' fill='%23fff' opacity='0.5'/%3E%3Ccircle cx='250' cy='200' r='1' fill='%23fff' opacity='0.8'/%3E%3Ccircle cx='90' cy='250' r='0.5' fill='%23fff' opacity='0.6'/%3E%3Ccircle cx='150' cy='160' r='1' fill='%23fff' opacity='0.9'/%3E%3Ccircle cx='280' cy='90' r='2' fill='%23fff' opacity='0.2'/%3E%3Ccircle cx='60' cy='180' r='1' fill='%23fff' opacity='0.4'/%3E%3Ccircle cx='210' cy='280' r='0.5' fill='%23fff' opacity='0.7'/%3E%3C/svg%3E"),
              url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Ccircle cx='100' cy='100' r='0.5' fill='%23fff' opacity='0.5'/%3E%3Ccircle cx='40' cy='150' r='0.5' fill='%23fff' opacity='0.4'/%3E%3Ccircle cx='160' cy='30' r='1' fill='%23fff' opacity='0.6'/%3E%3Ccircle cx='10' cy='90' r='0.5' fill='%23fff' opacity='0.3'/%3E%3Ccircle cx='180' cy='180' r='1' fill='%23fff' opacity='0.7'/%3E%3Ccircle cx='120' cy='40' r='0.5' fill='%23fff' opacity='0.8'/%3E%3C/svg%3E")
            `,
            backgroundSize: '400px 400px, 300px 300px, 200px 200px',
          }}
        />
      </div>

      <MissionHud />

      {/* ===== HERO ===== */}
      <section className="mx-auto max-w-[1100px] px-7 pt-20 pb-8">
        <div data-reveal="up" className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-gradient-to-b from-white/10 to-black/30 px-14 pt-16 pb-[70px]">
          <div className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.04) 1px,transparent 1px)', backgroundSize: '6px 6px' }} />
          <div role="heading" aria-level={1} data-reveal="mask" className="m-0 !font-display text-[clamp(58px,9vw,128px)] font-bold uppercase leading-[.86] tracking-[-.02em] text-orange">
            Memory<br />Block<br />Blast
          </div>
          <p className="mt-6 font-term text-[clamp(15px,2.1vw,24px)] tracking-wide text-ghost">Reallocating Voyager 1's Fragmented Memory Map</p>
          <p className="mt-5 max-w-[560px] font-term text-[13px] leading-relaxed text-ash/60">
            [ insert here a short description on what to expect and what to learn throughout the exhibit — NASA's Voyager 1, the FDS failure, and the technical architecture behind it all ]
          </p>
        </div>

        <div className="mx-auto mt-9 flex max-w-[430px] flex-col gap-4">
          <a href="#finale" className="rounded-[10px] border border-white/20 bg-black/60 px-5 py-[18px] text-center font-term text-[15px] tracking-wide text-ghost transition-colors hover:border-orange hover:bg-orange/10 hover:text-orange">Launch Operations Mini-Game</a>
          <a href="#what-is" className="flex items-center justify-center gap-2.5 rounded-[10px] border border-white/20 bg-black/60 px-5 py-[18px] font-term text-[15px] tracking-wide text-ghost transition-colors hover:border-orange hover:bg-orange/10 hover:text-orange">Explore Story Timeline <span className="text-lg leading-none">⌄</span></a>
        </div>
      </section>

      {/* Jupiter rising (parallax + pixel overlay) */}
      <div className="relative h-[560px] overflow-hidden">
        <div data-parallax data-speed="-14" className="absolute left-1/2 top-[140px] h-[1180px] w-[1180px] -translate-x-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle at 42% 30%,rgba(255,240,210,.55),transparent 42%),repeating-linear-gradient(0deg,#e7a86a 0 10px,#c87c40 10px 22px,#a85e2c 22px 30px,#d98f50 30px 44px,#8f4a26 44px 52px,#e7b67d 52px 66px),radial-gradient(circle at 50% 50%,transparent 52%,rgba(5,5,5,.85))', boxShadow: 'inset -40px -30px 120px rgba(5,5,5,.9),0 0 120px rgba(250,102,2,.22)' }} />
        <div data-parallax data-speed="-14" className="pointer-events-none absolute left-1/2 top-[140px] h-[1180px] w-[1180px] -translate-x-1/2 rounded-full mix-blend-multiply"
          style={{ backgroundImage: 'linear-gradient(rgba(5,5,5,.32) 1px,transparent 1px),linear-gradient(90deg,rgba(5,5,5,.32) 1px,transparent 1px)', backgroundSize: '8px 8px' }} />
      </div>

      {/* ===== WHAT IS VOYAGER 1 ===== */}
      <section id="what-is" className="mx-auto max-w-[1080px] scroll-mt-20 px-7 pt-10 pb-[90px]">
        <h2 data-reveal="up" className="m-0 mb-1.5 !font-display text-[clamp(30px,4.4vw,52px)] font-bold uppercase text-orange">What is Voyager 1?</h2>
        <p data-reveal="up" className="m-0 mb-9 font-term text-[12px] text-ash/60">[ insert here the learning points about Voyager 1 ]</p>

        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2">
          <div data-reveal="left" className="flex flex-col gap-5">
            <p className="m-0 text-[13px] leading-[1.8] text-ash">Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
            <p className="m-0 text-[13px] leading-[1.8] text-ash/60">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
          </div>

          {/* Voyager probe — CSS placeholder; swap in real imagery */}
          <div className="relative min-h-[300px]">
            <div data-reveal="right" className="absolute right-0 top-1.5 h-[200px] w-[230px]">
              <div className="absolute right-2 top-0 h-32 w-32 rounded-full" style={{ background: 'radial-gradient(circle at 38% 34%,#f3e6c9,#cdb184 55%,#8a774b)', boxShadow: 'inset -10px -8px 22px rgba(0,0,0,.55),0 0 30px rgba(250,102,2,.18)', transform: 'rotate(-18deg)' }} />
              <div className="absolute right-[60px] top-24 h-[30px] w-[54px] border border-black/40" style={{ background: 'linear-gradient(180deg,#d9c79a,#7d6c45)', transform: 'rotate(-18deg)' }} />
              <div className="absolute -right-8 top-[150px] h-[3px] w-[240px] origin-right" style={{ background: 'linear-gradient(90deg,transparent,#b9a878)', transform: 'rotate(8deg)' }} />
              <div className="absolute right-[46px] top-2 h-2 w-2 animate-pulse2 rounded-full bg-orange shadow-[0_0_12px_#fa6602]" />
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
          <div />
          <p data-reveal="right" className="m-0 text-right text-[13px] leading-[1.8] text-ash/60">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
        </div>
      </section>

      {/* ===== IN 2023, SOMETHING WENT WRONG ===== */}
      <section className="flex min-h-[70vh] items-center justify-center px-7 py-16 text-center">
        <h2 data-reveal="scale" className="m-0 !font-display text-[clamp(28px,5vw,62px)] font-bold uppercase leading-[1.05] text-alert">In 2023,<br />Something Went Wrong...</h2>
      </section>
      <div className="mx-auto max-w-[1080px] px-7">
        <div data-reveal="up" className="h-[130px] rounded-t-[20px] border border-b-0 border-alert/30" style={{ background: 'linear-gradient(180deg,rgba(230,57,70,.05),transparent)' }} />
      </div>

      {/* ===== WHAT GOES ON INSIDE (FDS) ===== */}
      <section className="mx-auto max-w-[1080px] px-7 pt-[120px] pb-[90px]">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[0.9fr_1.1fr]">
          {/* Saturn */}
          <div data-parallax data-speed="-10" className="relative h-[360px]">
            <div className="absolute left-10 top-[90px] h-24 w-[340px] rounded-full" style={{ transform: 'rotate(-22deg)', background: 'linear-gradient(90deg,transparent 6%,rgba(220,180,120,.15) 14%,#caa46a 30%,#e7c896 50%,#b88a4e 70%,rgba(220,180,120,.15) 86%,transparent 94%)', boxShadow: '0 0 30px rgba(250,102,2,.12)' }} />
            <div className="absolute left-[108px] top-[62px] h-[188px] w-[188px] rounded-full" style={{ background: 'radial-gradient(circle at 40% 32%,rgba(255,240,210,.5),transparent 44%),repeating-linear-gradient(0deg,#e0a866 0 8px,#c4823e 8px 16px,#a8632c 16px 22px,#d99250 22px 32px),radial-gradient(circle at 50% 50%,transparent 54%,rgba(5,5,5,.8))', boxShadow: 'inset -22px -18px 50px rgba(5,5,5,.85),0 0 70px rgba(250,102,2,.2)' }} />
          </div>

          <div className="text-right">
            <p data-reveal="right" className="m-0 mb-2 text-[12px] text-ash/60">But why was this so difficult to fix?</p>
            <h2 data-reveal="up" className="m-0 !font-display text-[clamp(26px,3.8vw,46px)] font-bold uppercase leading-[1.04] text-orange">What Goes On Inside<br />Voyager 1 (FDS)?</h2>
            <p data-reveal="up" className="m-0 mb-6 mt-2.5 font-term text-[13px] text-ash">Understanding Computer Memory</p>
            <p data-reveal="right" className="m-0 mb-[22px] text-[13px] leading-[1.8] text-ash/60">Engineers knew something had failed. But before understanding the solution, we first need to understand how a computer stores and retrieves information.</p>
            <p data-reveal="right" className="m-0 text-[12px] text-ash/40">[ pano ba i-visualize hahaha ]</p>
          </div>
        </div>
      </section>

      {/* ===== MEMORY ADDRESSING (pinned + scrubbed) ===== */}
      <section id="addressing" className="relative">
        <div data-stage className="flex h-screen items-center overflow-hidden">
          <div className="mx-auto w-full max-w-[1080px] px-7">
            <div className="mb-8 max-w-[520px]">
              <p className="m-0 mb-2 text-[13px] leading-[1.7] text-ash">If memory stores everything a computer needs, how does the processor know exactly where to find each instruction?</p>
              <h2 className="m-0 !font-display text-[clamp(28px,4vw,48px)] font-bold uppercase tracking-wide text-orange">Memory Addressing</h2>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-9">
              <MemoryGrid states={addressingStates(addrP)} />
              <div className="min-w-[190px] font-mono">
                <p className="m-0 text-[9px] uppercase tracking-[.16em] text-ash/50">▸ Processor read</p>
                <p className="m-0 mt-4 text-[11px] text-ash/60">ADDRESS</p>
                <p className="m-0 text-[30px] font-bold text-orange">{addr(ptr)}</p>
                <p className="m-0 mt-3.5 text-[11px] text-ash/60">DATA</p>
                <p className="m-0 text-[30px] font-bold text-ghost">0x{HEX[ptr % HEX.length]}</p>
                <div className="mt-[18px] h-1 overflow-hidden rounded bg-white/[0.08]"><div className="h-full bg-orange" style={{ width: `${(addrP * 100).toFixed(0)}%` }} /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MEMORY MAPPING (pinned + scrubbed) ===== */}
      <section id="mapping" className="relative">
        <div data-stage className="flex h-screen items-center overflow-hidden">
          <div className="mx-auto w-full max-w-[1080px] px-7 text-right">
            <div className="mb-8 ml-auto max-w-[560px]">
              <p className="m-0 mb-2 text-[13px] leading-[1.7] text-ash">Every instruction has an address — but what happens when some of those addresses suddenly become unavailable?</p>
              <h2 className="m-0 !font-display text-[clamp(28px,4vw,48px)] font-bold uppercase tracking-wide text-orange">Memory Mapping</h2>
            </div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-9">
              <div className="min-w-[190px] text-left font-mono">
                <p className="m-0 text-[9px] uppercase tracking-[.16em] text-alert">⚠ Fault scan</p>
                <p className="m-0 mt-4 text-[11px] text-ash/60">CORRUPTED BLOCKS</p>
                <p className="m-0 text-[30px] font-bold text-alert">{String(lost).padStart(2, '0')}</p>
                <p className="m-0 mt-3.5 text-[11px] text-ash/60">STATUS</p>
                <p className="m-0 text-[15px] font-bold" style={{ color: lost === 0 ? '#F8F8FF' : '#E63946' }}>{lost === 0 ? 'NOMINAL' : lost < FRAG.length ? 'FAULT DETECTED' : 'CRITICAL'}</p>
              </div>
              <MemoryGrid states={mappingStates(mapP)} />
            </div>
          </div>
        </div>
      </section>

      {/* ===== NASA'S SOLUTION (pinned + scrubbed) ===== */}
      <section id="solution" className="relative">
        <div data-stage className="flex h-screen items-center overflow-hidden">
          <div className="mx-auto w-full max-w-[1080px] px-7 text-center">
            <p className="m-0 mb-2 text-[13px] leading-[1.7] text-ash">Losing part of memory doesn't always mean losing the entire program. Sometimes, there's another solution.</p>
            <h2 className="m-0 mb-8 !font-display text-[clamp(30px,4.4vw,54px)] font-bold uppercase tracking-wide text-orange">NASA's Solution</h2>
            <div className="mx-auto max-w-[560px]"><MemoryGrid states={solutionStates(solP)} /></div>
            <p className="mt-6 !font-display text-[22px] font-bold uppercase tracking-[.12em] text-crt transition-opacity duration-300" style={{ opacity: solP > 0.92 ? 1 : 0 }}>✓ Code Reallocated</p>
          </div>
        </div>
      </section>

      {/* ===== OUTRO ===== */}
      <section className="mx-auto max-w-[760px] px-7 pt-8 text-center">
        <p data-reveal="up" className="m-0 mb-[18px] text-[13px] leading-[1.8] text-ash/60">Voyager 1 continues its journey through interstellar space today. Its recovery wasn't possible because engineers replaced broken hardware — it was possible because they understood how computers organize memory and execute instructions.</p>
        <p data-reveal="up" className="m-0 text-[13px] leading-[1.8] text-ash">Great engineering isn't always about more advanced technology. Sometimes, a deeper understanding of the fundamentals is what makes the difference.</p>
      </section>

      {/* Earth (parallax) */}
      <div className="relative mt-10 h-[340px] overflow-hidden">
        <div data-parallax data-speed="-8" className="absolute left-1/2 top-[120px] h-[1300px] w-[1300px] -translate-x-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle at 40% 30%,rgba(170,210,255,.45),transparent 40%),radial-gradient(circle at 62% 58%,rgba(80,160,90,.5),transparent 28%),radial-gradient(circle at 30% 64%,rgba(70,140,80,.45),transparent 24%),radial-gradient(circle at 50% 50%,#1d5b9e,#0a2f57 60%,rgba(5,5,5,.9) 82%)', boxShadow: 'inset -30px -20px 120px rgba(5,5,5,.9),0 0 130px rgba(80,160,255,.18)' }} />
      </div>
    </div>
  );
}