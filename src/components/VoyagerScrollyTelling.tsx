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
 * chrome + Tailwind/fonts.
 */
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import jupiterImg from '../assets/jupiter.webp';
import saturnImg from '../assets/saturn.webp';
import voyager1Img from '../assets/voyager1.webp';
import earthImg from '../assets/earth_1.webp';

// Code-split: the finale minigame is ~900 lines of drag-and-drop logic that
// nobody needs until they scroll to the bottom of the page. Loading it via
// React.lazy + an IntersectionObserver gate (below) keeps its chunk out of
// the initial client:load bundle entirely, matching the client:visible-style
// deferred hydration this exhibit was designed around.
const MemoryMinigame = lazy(() => import('./MemoryMinigame.tsx'));

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

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

const FAILURE_FLOW = [
  'The physical chip failed.',
  'The “words” stored within that chip’s address range were no longer reliably readable.',
  'The computer’s instruction pointer was directed to unreadable memory.',
  'The system began treating broken data as real instructions, affecting core functionality.',
];

const IP_STEPS = [
  'Read the instruction at line 100.',
  'Do what line 100 says.',
  'Move the bookmark to line 101.',
  'Repeat.',
];

function NumberedList({ items, accent }: { items: string[]; accent: 'alert' | 'orange' }) {
  const badge = accent === 'alert' ? 'border-alert/40 bg-alert/10 text-alert' : 'border-orange/40 bg-orange/10 text-orange';
  return (
    <ol className="m-0 flex flex-col gap-2.5 font-term text-sm md:text-[18px] leading-[1.7] text-ash">
      {items.map((item, i) => (
        <li key={item} className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border font-mono text-[12px] font-bold ${badge}`}>{i + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function MemoryGrid({ states }: { states: CellState[] }) {
  return (
    <div className="grid grid-cols-8 gap-1 sm:gap-1.5 rounded-xl border border-white/10 bg-black/40 p-2.5 sm:p-5 font-mono shadow-2xl backdrop-blur-md">
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

export default function VoyagerScrollyTelling() {
  const root = useRef<HTMLDivElement>(null);
  const [addrP, setAddrP] = useState(0);
  const [mapP, setMapP] = useState(0);
  const [solP, setSolP] = useState(0);

  const finaleRef = useRef<HTMLDivElement>(null);
  const [minigameVisible, setMinigameVisible] = useState(false);

  useEffect(() => {
    const el = finaleRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setMinigameVisible(true);
        observer.disconnect();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    // Don't let a mobile browser's URL-bar show/hide fire a ScrollTrigger
    // refresh mid-scroll — that's the main source of pin jumpiness on phones.
    ScrollTrigger.config({ ignoreMobileResize: true });

    // Mobile stages are shorter (see the `pin` helper below), so they need a
    // shorter scrub duration too or the freeze outlasts the content.
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;

    const ctx = gsap.context((self) => {
      const q = self.selector!;

      const pin = (sel: string, set: (p: number) => void) => {
        const section = q<HTMLElement>(sel)[0];
        if (!section) return;
        const stage = section.querySelector('[data-stage]') as HTMLElement;

        // Pin the stage and scrub the grid on both desktop and mobile so the
        // screen freezes while the memory grid animates. On mobile the stage
        // is laid out so the grid sits at the top (visible during the freeze);
        // ignoreMobileResize (set above) + anticipatePin keep it from jumping.
        ScrollTrigger.create({
          trigger: section,
          start: 'top top',
          end: isDesktop ? '+=170%' : '+=110%',
          pin: stage,
          pinSpacing: true,
          anticipatePin: 1,
          scrub: true,
          onUpdate: (st) => set(+st.progress.toFixed(3)),
        });
      };
      pin('#addressing', setAddrP);
      pin('#mapping', setMapP);
      pin('#solution', setSolP);

      q<HTMLElement>('[data-parallax]').forEach((el) => {
        gsap.to(el, {
          yPercent: parseFloat(el.dataset.speed || '-12'),
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });

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
    }, root);

    return () => ctx.revert();
  }, []);

  const lost = Math.floor(mapP * FRAG.length);
  const ptr = Math.floor(Math.min(addrP, 0.999) * GRID);

  return (    
    <div ref={root} className="relative font-sans text-ghost overflow-clip">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-space">
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


			{/* INDEX SECTION */}			
      <section className="relative mx-auto max-w-[1700px] px-2 pt-20 pb-52">

        <div 
        data-parallax
        data-speed="-8"
        className="hidden md:block absolute right-0 top-[20%] -z-10 w-[clamp(400px,40vw,650px)] -translate-y-1/2 pointer-events-none select-none opacity-80"
        >
        <div className="absolute inset-0 scale-125 rounded-full bg-radial from-orange/20 to-transparent filter blur-3xl" />
        
        <img
            src={jupiterImg.src}
            alt="Jupiter"
            width={jupiterImg.width}
            height={jupiterImg.height}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="w-full h-auto object-contain"
            style={{
                WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)",
                maskImage: "linear-gradient(to right, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)",
            }}
        />
        </div>

        <div 
        data-reveal="up" 
        className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-gradient-to-b from-white/10 to-black/30 px-7 md:px-14 pb-[70px] flex flex-col items-start text-left">

          <div
          role="heading"
          aria-level={1} 
          data-reveal="mask" 
          className="m-0 !font-display text-[clamp(65px,6vw,6vw)] font-bold uppercase leading-[.86] text-orange">
            Memory<br />Block<br />Blast
          </div>
          <p className="mt-2 font-term text-[clamp(20px,34px,2vw)] tracking-wide text-ghost">Reallocating Voyager 1's Fragmented Memory Map</p>
          <p className="mt-1 m-0 max-w-[940px] font-term text-lg text-[clamp(15px,1vw,24px)] leading-relaxed text-ash/60">
          Discover how NASA engineers leveraged 1970s hardware constraints, analyzed primitive memory maps, and executed a remote software reallocating workaround to rescue humanity's most distant emissary.
          </p>
        </div>

				{/* IDX BUTTONS */}			
        <div className="mx-auto mt-8 flex max-w-[560px] flex-col gap-5">
					<a 
						href="#finale"
						className="
							no-underline text-center font-term text-sm md:text-lg tracking-wide text-white transition-all
							
							/* Glassmorphism */
							rounded-full border border-white/15 bg-white/[0.04] backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]
							px-6 py-3.5
							
							/* Hover */
							hover:border-white/40 hover:bg-white/10 hover:shadow-[0_4px_25px_rgba(255,255,255,0.1)]
						"
					>
						Launch Operations Mini-Game
					</a>

					<a 
						href="#what-is"
						className="
							no-underline flex items-center justify-center gap-2.5 font-term text-sm md:text-lg tracking-wide text-white transition-all
							
							/* Glassmorphism */
							rounded-full border border-white/15 bg-white/[0.04] backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]
							px-6 py-3.5
							
							/* Hover */
							hover:border-white/40 hover:bg-white/10 hover:shadow-[0_4px_25px_rgba(255,255,255,0.1)]
						"
					>
						Explore Story Timeline 
					</a>
				</div>

      </section>

			{/* WHAT IS VOYAGER 1 SECTION */}
      <section id="what-is" className="mx-auto max-w-[1700px] scroll-mt-20  px-2 pt-10 pb-[90px] font-term">
				
				<div className="max-w-[1600px] mx-auto relative overflow-hidden rounded-[32px] border border-white/15 bg-white/[0.04] backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)] px-7 py-12 md:px-14 md:py-16">
				
        <h2 data-reveal="up" className="m-0 mb-1.5 !font-display text-[clamp(30px,65px,65px)] font-bold uppercase text-orange px-7 md:px-14">What is Voyager 1?</h2>
        <p data-reveal="up" className="m-0 mb-9 font-term text-base md:text-[18px] text-ash/60 px-7 md:px-14">OBJECT DESIGNATION: VOYAGER 1 · NASA/JPL · LAUNCHED 1977.09.05</p>

        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2 px-7 md:px-14">

          <div data-reveal="up" className="flex flex-col gap-5">

            <p className="m-0 text-base text-[clamp(15px,1vw,24px)] leading-[1.8] text-ash">On September 5, 1977, NASA launched Voyager 1, a robot space probe with the primary goal of studying the planets in our solar system.</p>

            <p className="m-0 text-base text-[clamp(15px,1vw,24px)] leading-[1.8] text-ash">After almost six decades of travel, Voyager 1 still remains the farthest human-made object ever to leave Earth.</p>

						<p className="m-0 text-base text-[clamp(15px,1vw,24px)] leading-[1.8] text-ash">You do not debug a computer from 15 billion miles away in real time. Every decision must be deliberate, pre-calculated, and correct on the first attempt.</p>

          </div>

            <div className="relative flex justify-center items-center w-full min-h-[400px] lg:min-h-[500px]">
                <div
                    data-reveal="right"
                    className="w-[70%] max-w-[550px] aspect-square animate-slow-rotate">

                    <img
                    src={voyager1Img.src}
                    alt="Voyager 1 Probe"
                    width={voyager1Img.width}
                    height={voyager1Img.height}
                    loading="eager"
                    decoding="async"
                    className="h-full w-full object-contain drop-shadow-[0_0_50px_rgba(255,165,0,0.15)]"
                    />
                </div>
            </div>
        </div>

			</div>
      </section>

      <section className="flex min-h-[70vh] items-center justify-center px-7 py-16 text-center">
        <h2 data-reveal="scale" className="m-0 !font-display text-[clamp(28px,5vw,62px)] font-bold uppercase leading-[1.05] text-alert">In 2023,<br />Something Went Wrong...</h2>
      </section>

      <div className="mx-auto max-w-[1700px] px-7">        
      </div>

        <section className="relative mx-auto max-w-[1800px] px-7 pt-[120px] pb-[90px]">
        
        <div 
            data-parallax
            data-speed="-6"
            className="absolute left-[-120px] top-[82%] -z-10 w-[clamp(450px,48vw,850px)] -translate-y-[50%] pointer-events-none select-none opacity-90"
        >
            <div className="absolute inset-0 scale-125 rounded-full bg-radial from-orange/20 to-transparent filter blur-3xl" />
            
            <img
            src={saturnImg.src}
            alt="Saturn"
            width={saturnImg.width}
            height={saturnImg.height}
            loading="eager"
            decoding="async"
            className="w-full h-auto object-contain scale-95 translate-x-24"
            style={{
                WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
                maskImage: "linear-gradient(to right, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
            }}
            />
        </div>

        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[1.1fr_0.9fr] px-7 md:px-14">
            
            <div className="hidden md:block pointer-events-none" />

            <div className="text-right flex flex-col items-end relative z-10 font-term">
            <p data-reveal="right" className="m-0 mb-2 text-base md:text-[24px] text-ash/60">
                But why was this so difficult to fix?
            </p>
            <h2 data-reveal="up" className="m-0 !font-display text-[clamp(26px,3.8vw,80px)] font-bold uppercase leading-[1.04] text-orange">
                What Goes On Inside Voyager 1?
            </h2>
            <p data-reveal="up" className="m-0 mb-6 mt-2.5 font-term text-base md:text-[24px] text-ash">
                Understanding the Machine's Memory
            </p>
            <p data-reveal="right" className="m-0 mb-[22px] max-w-[100%] text-base md:text-[24px] leading-[1.8] text-ash/60">
                Before we can diagnose what broke inside Voyager 1, we need to speak the same language as the engineers who fixed it. That language is the language of computer memory: how data, code, and instructions are defined, addressed, and accessed. 
            </p>

            </div>
        </div>
        </section>

      <section className="relative mt-[112px] mx-auto max-w-[1800px] px-2 pt-20 pb-10">

        <div className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-gradient-to-b from-white/10 to-black/30 px-7 md:px-14 pt-16 pb-[70px] flex flex-col items-start text-left">

            <h3 data-reveal="left" className="m-0 mb-5 !font-display text-[clamp(22px,3vw,32px)] font-bold uppercase text-orange">What is Computer Memory?</h3>

            <p data-reveal="left" className="mt-5 m-0 max-w-[100%] font-term text-base md:text-[24px] text-justify leading-relaxed text-ash/60">
                Computer memory serves as the system's active workspace, holding the instructions and data required for immediate operation. On Voyager 1's 1970s architecture, this memory is organized into "words"—16-bit units rather than modern bytes—which define every calculation.
            </p>

            <p data-reveal="left" className="mt-5 m-0 max-w-[100%] font-term text-base md:text-[24px] text-justify leading-relaxed text-ash/60">
                Without this functional memory space, the spacecraft loses its operational instructions and data, effectively rendering it lifeless, which is a critical failure that occurred for Voyager 1 in November 2023.
            </p>

        </div>

      </section>

        <section id="addressing" className="relative mx-auto max-w-[1700px] px-7 md:px-14">
            <div data-stage className="flex py-16 md:py-32 flex-col items-start overflow-hidden">
                
                <div className="mb-6 md:mb-10 max-w-[750px] text-left font-term">
                    <p className="m-0 mb-2 text-base md:text-[24px] text-ash/60">
                        If memory stores everything a computer needs, how does the processor know exactly where to find each instruction?
                    </p>
                    <h2 className="m-0 !font-display text-[clamp(26px,3.8vw,80px)] font-bold uppercase leading-[1.04] text-orange">
                        Memory Addressing
                    </h2>
                </div>

                <div className="w-full grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-6 md:gap-12 items-start">

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-4 md:gap-9 bg-white/[0.02] border border-white/[0.05] p-4 md:p-6 rounded-[20px] w-full max-w-[900px]">
                        <MemoryGrid states={addressingStates(addrP)} />

                        <div className="w-full md:min-w-[190px] font-mono">
                            <p className="m-0 text-[18px] uppercase tracking-[.16em] text-ash/50">Processor read</p>
                            <p className="m-0 mt-4 text-[15px] text-ash/60">ADDRESS</p>
                            <p className="m-0 text-[30px] font-bold text-orange">{addr(ptr)}</p>
                            <p className="m-0 mt-3.5 text-[15px] text-ash/60">DATA</p>
                            <p className="m-0 text-[30px] font-bold text-ghost">0x{HEX[ptr % HEX.length]}</p>
                            <div className="mt-[18px] h-1 overflow-hidden rounded bg-white/[0.08]">
                                <div className="h-full bg-orange" style={{ width: `${(addrP * 100).toFixed(0)}%` }} />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-start text-left w-full max-w-[680px] pt-4">

                        <p className="m-0 text-base md:text-[24px] leading-relaxed text-ash/60 font-term mb-8  text-right" >
                            Every piece of information in a computer is stored in a specific location called a memory address. Instead of searching blindly for what it needs, the computer goes directly to this address, just like you would pull a specific folder from a numbered drawer in a filing cabinet.
                        </p>
                        <p className="m-0 text-base md:text-[24px] leading-relaxed text-ash/60 font-term text-right">
                            Voyager 1’s onboard computer is incredibly small by today's standards, with just 8,192 memory slots. When the spacecraft needs to know what to do next, it asks for the instructions stored in one of these specific slots, and the hardware instantly hands them over so the program can continue.
                        </p>
                    </div>

                </div>


                <p className="mt-5 m-0 max-w-[100%] font-term text-base md:text-[24px] text-center mt-6 md:mt-12 leading-relaxed text-ash/60">
                    This process repeats thousands of times a second, but it only works if the physical hardware is completely undamaged. If a single memory chip breaks down over time, as it did during 2023, the system gets confused. It starts reading from the broken memory, following corrupted instructions, and sending gibberish back to Earth.
                </p>

            </div>
        </section>

      <section id="mapping" className="relative mx-auto max-w-[1800px] px-7 md:px-14">
        <div data-stage className="flex py-16 md:py-32 flex-col items-start overflow-hidden">

            <div className="mb-4 ml-auto max-w-[560px] text-right font-term">
              <p className="m-0 mb-2 text-[16spx] leading-[1.7] text-ash">Every instruction has an address, but what happens when some of those addresses suddenly become unavailable?</p>
              <h2 className="m-0 !font-display text-[clamp(28px,4vw,48px)] font-bold uppercase text-orange">Memory Mapping</h2>
            </div>

            <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-6 md:gap-12 items-start">

                <div className="order-2 md:order-1 flex flex-col items-start text-left w-full max-w-[680px] pt-4">

                    <p className="m-0 text-base md:text-[24px] leading-relaxed text-ash/60 font-term mb-8  text-left" >
                        Think of a computer's memory like an empty plot of land. Memory mapping divides the land into permanent zones for specific jobs, like one zone for temporary data and another for software instructions.
                    </p>
                    <p className="m-0 text-base md:text-[24px] leading-relaxed text-ash/60 font-term text-left">
                        On older computers like Voyager 1, this map is an unbreakable contract. If a piece of code belongs at address 100, it must stay exactly at address 100. The computer doesn't double-check its work; it blindly goes to the requested address, grabs whatever is sitting there, and tries to run it.
                    </p>
                </div>

                <div className="order-1 md:order-2 grid grid-cols-1 md:grid-cols-[auto_1fr] items-center gap-4 md:gap-9 bg-white/[0.02] border border-white/[0.05] p-4 md:p-6 rounded-[20px] w-full">

                    <div className="w-full md:min-w-[190px] text-left font-mono">
                        <p className="m-0 text-sm md:text-[20px] uppercase tracking-[.16em] font-extrabold text-alert">Fault scan</p>
                        <p className="m-0 mt-4 text-[15px] text-ash/60">CORRUPTED BLOCKS</p>
                        <p className="m-0 text-[30px] font-bold text-alert">{String(lost).padStart(2, '0')}</p>
                        <p className="m-0 mt-3.5 text-[15px] text-ash/60">STATUS</p>
                        <p className="m-0 text-[15px] font-bold" style={{ color: lost === 0 ? '#F8F8FF' : '#E63946' }}>{lost === 0 ? 'NOMINAL' : lost < FRAG.length ? 'FAULT DETECTED' : 'CRITICAL'}</p>
                    </div>
                    <MemoryGrid states={mappingStates(mapP)} />
                    </div>

            </div>

            <p className="mt-5 m-0 max-w-[100%] font-term text-base md:text-[24px] text-center mt-12 leading-relaxed text-ash/60">
                Because the computer can't tell the difference between real instructions and random noise, a broken memory chip is incredibly dangerous. It doesn't just corrupt saved files; it completely breaks how the computer behaves.
            </p>

        </div>
      </section>

      <section id="lost-in-translation" className="relative mx-auto max-w-[1800px] px-7 md:px-14">
        <div data-stage className="flex py-32 flex-col items-center text-center overflow-hidden">
          

          <div className="mb-14 max-w-[1000px]">
            <h2 className="m-0 !font-display text-[clamp(32px,5vw,72px)] font-bold uppercase leading-[1.05] text-orange">
              Lost in Translation in Deep Space
            </h2>
            <p className="m-0 mt-4 font-mono text-[18px] tracking-wider text-ghost/80 uppercase">
              November 14, 2023 // Telemetry Stream Disruption
            </p>
          </div>

          <div className="w-full max-w-[1200px] bg-white/[0.02] border border-white/[0.04] p-8 md:p-12 rounded-[24px] flex flex-col gap-8 text-center items-center">
            
            <p className="m-0 font-term text-base md:text-[24px] leading-relaxed text-ash">
              On November 14, 2023, Voyager 1’s data stream broke.
            </p>

            <p className="m-0 font-term text-base md:text-[24px] leading-relaxed text-ash/60">
              The spacecraft hadn't died, and the signal hadn't weakened by distance. Instead of sending back science data, it simply began transmitting total gibberish nobody knew how to comprehend.
            </p>

            <p className="m-0 font-term text-base md:text-[24px] leading-relaxed text-ash/60">
              For the NASA engineers back on Earth, this was both a relief and a nightmare. The probe was clearly still alive and broadcasting its signal on time, but the data was completely meaningless.
            </p>
            
            <p className="m-0 font-term text-base md:text-[24px] leading-relaxed text-ash/60">
              To make matters worse, Voyager 1 is over 15 billion miles away. At that immense distance, every single command sent to the spacecraft takes <span className="text-ghost font-bold">47 hours</span> just to complete a round trip, making any quick fix impossible.
            </p>

          </div>

        </div>
      </section>

      <section className="mx-auto max-w-[1000px] px-7 py-32 flex flex-col items-center text-center gap-16 font-term">
        
        <div data-reveal="up" className="flex flex-col items-center gap-6 max-w-[850px]">
          <h2 className="m-0 !font-display text-[clamp(32px,4vw,52px)] font-bold uppercase text-alert leading-[1.05]">
            Root Cause:<br />A Dead Chip
          </h2>
          <p className="m-0 text-base md:text-[22px] leading-[1.8] text-ash">
            After months of testing, engineers found the problem: a single memory chip inside the computer failed completely. Because the chip broke, the instructions stored on it became unreadable. This specific chip holds the code that packages up all of Voyager 1’s science data and prepares it to be sent back to Earth.
          </p>
        </div>

        <div data-reveal="up" className="flex flex-col items-start w-full max-w-[850px] rounded-xl border border-alert/30 bg-alert/5 px-8 py-8 text-left">
          <p className="m-0 mb-4 font-mono text-[13px] uppercase tracking-[.14em] text-alert">The Failure Flow</p>
          <NumberedList items={FAILURE_FLOW} accent="alert" />
          <p className="m-0 mt-5 text-sm md:text-[18px] leading-[1.7] text-ash/80">
            When the computer’s bookmark (the Instruction Pointer) moved into this chip's territory, the computer didn't know the chip was broken. It just blindly read the unreadable memory, treating the broken data as real instructions, and ran them. This caused the system to think it was still working properly, but in reality, it was sending gibberish back to Earth.
          </p>
        </div>

        <div data-reveal="up" className="flex flex-col items-center gap-6 max-w-[850px] pt-4">
          <h2 className="m-0 !font-display text-[clamp(28px,3.5vw,44px)] font-bold uppercase text-orange leading-[1.05]">
            Instruction Pointer Control<br />& Jump Remapping
          </h2>
          <p className="m-0 text-sm md:text-[20px] leading-[1.8] text-ash">
            It’s impossible to send a mechanic 15 billion miles into deep space to swap out a broken part. The only option was a remote software repair, beamed across the solar system to the spacecraft. With a 47-hour delay between sending a command and seeing the result, there was absolutely no room for error.
          </p>
          <p className="m-0 text-sm md:text-[20px] leading-[1.8] text-ash">
            Since there wasn't a single open space in the healthy memory large enough to hold the rescued code, the engineers had to get creative. They chopped the vital instructions into smaller fragments and carefully tucked them into tiny, unused gaps scattered throughout the computer's working memory.
          </p>
          <p className="m-0 text-sm md:text-[20px] leading-[1.8] text-ash">
            Finally, they had to leave digital “breadcrumbs” — specific jump commands that explicitly told the computer exactly where to find the next instruction. They manually calculated and mapped out every single step so the system could hop seamlessly from one relocated fragment to the next, restoring the flow of data without a single misstep.
          </p>
        </div>

        <div data-reveal="up" className="flex flex-col items-center w-full max-w-[850px] rounded-xl border border-orange/20 bg-orange/5 px-8 py-10 backdrop-blur-sm">
          <h3 className="m-0 !font-display text-[26px] font-bold uppercase text-orange mb-4">
            The Instruction Pointer
          </h3>
          <p className="m-0 text-[18px] leading-[1.7] text-ash/80 mb-5 max-w-[750px]">
            Every computer has a tiny, super-fast memory slot called the Instruction Pointer (IP). Its only job is to point to the next instruction the computer needs to run. After the computer reads and does what the instruction says, the IP automatically moves to the very next line. Essentially, the order of instructions was:
          </p>
          <div className="max-w-[750px] w-full">
            <NumberedList items={IP_STEPS} accent="orange" />
          </div>
          <p className="m-0 mt-5 text-[18px] leading-[1.7] text-ash/80 max-w-[750px]">
            This regular loop is exactly what broke Voyager 1. A piece of the spacecraft's memory got physically damaged and corrupted. But the IP didn't know that. It just kept moving forward, line by line, right into the broken memory area. Once it got there, it started reading complete gibberish and trying to run it like real code. That confused the computer and completely killed Voyager 1's ability to send readable data back to Earth.
          </p>
        </div>

        <div data-reveal="scale" className="w-full max-w-[950px] rounded-2xl border border-crt/40 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(51,255,102,.03)_2px,rgba(51,255,102,.03)_5px)] bg-black/80 px-8 py-14 md:px-16 md:py-16 backdrop-blur-md shadow-[0_0_30px_rgba(51,255,102,.08)]">
          <h3 className="m-0 !font-display text-[26px] md:text-[30px] font-bold uppercase text-crt mb-6">
            The Jump Instruction
          </h3>
          <p className="m-0 mx-auto text-[18px] md:text-[20px] leading-[1.8] text-ash/90 mb-6 max-w-[750px]">
            A jump instruction (JMP) is a command that directly overwrites the Instruction Pointer with a new address. Instead of advancing sequentially to the next word, the processor instantly redirects its execution focus to whatever address the JMP specifies.
          </p>
          <p className="m-0 mx-auto text-[18px] md:text-[20px] leading-[1.8] italic text-ash/70 mb-6 max-w-[750px]">
            The JMP does not copy code. It simply redirects the processor’s attention to another part of the system’s code.
          </p>
          <p className="m-0 mx-auto text-[18px] md:text-[20px] leading-[1.8] text-ash/90 max-w-[750px]">
            This is the mechanism NASA engineers used to bridge fragmented code across non-contiguous memory regions.
          </p>
        </div>

        <div data-reveal="up" className="flex flex-col items-center gap-6 max-w-[850px] pt-4">
          <h3 className="m-0 !font-display text-[26px] font-bold uppercase text-orange mb-1">
            The Repair Strategy: Jump Remapping Across Fragments
          </h3>
          <p className="m-0 text-sm md:text-[20px] leading-[1.8] text-ash">
            Once the damaged chip was identified and empty spots in memory were found, engineers created a plan: break the code into pieces. They chopped the corrupted block of software into smaller chunks, with each block cut to fit perfectly into the tiny free gaps remaining in the spacecraft's healthy memory.
          </p>
          <p className="m-0 text-sm md:text-[20px] leading-[1.8] text-ash">
            Then came the delicate task of stitching it all back together. At the end of every piece, engineers attached a jump command pointing directly to where the next piece was hidden. The final piece was set to jump right back into the main program, making the broken software chain whole again.
          </p>
          <p className="m-0 text-sm md:text-[20px] leading-[1.8] text-ash">
            Voyager 1's computer had no idea the code had even been moved. It simply followed the trail of addresses step by step — and every single step was perfectly mapped out.
          </p>
        </div>

        <div data-reveal="up" className="flex flex-col items-center gap-5 max-w-[850px] pt-4">
          <h3 className="m-0 !font-display text-[26px] font-bold uppercase text-alert mb-1">
            Why This Was Extraordinarily Difficult
          </h3>
          <p className="m-0 text-sm md:text-[18px] leading-[1.8] text-ash/80">
            On modern computers, software automatically handles where programs are stored in memory. Voyager 1 didn't have any of that smart software. Every single line of code had to be moved by hand:
          </p>

          <blockquote className="m-0 w-full rounded-r-xl border-l-4 border-alert bg-alert/10 px-8 py-6 text-left text-[18px] leading-[1.7] text-alert/90">
            If the engineers got a single number wrong, saved code to the wrong spot, or told the computer to jump just three steps past its target, Voyager 1’s computer would crash — and the space probe would go dark forever.
          </blockquote>

          <p className="m-0 text-sm md:text-[18px] leading-[1.8] text-ash/60">
            There was no undo button. There was no way to fix a mistake once it was sent. There was only exact math, double-checked by hand on Earth, beamed across 15 billion miles of deep space, and trusted to work on a 47-year-old machine no human will ever touch again.
          </p>
        </div>

      </section>

      <section id="solution" className="relative">
        <div data-stage className="flex py-12 h-screen items-center overflow-hidden">
          <div className="mx-auto w-full max-w-[1080px] px-7 text-center font-term">
            <p className="m-0 mb-2 text-[15px] leading-[1.7] text-ash">Losing part of memory doesn't always mean losing the entire program. Sometimes, there's another solution.</p>
            <h2 className="m-0 mb-4 !font-display text-[clamp(30px,4.4vw,54px)] font-bold uppercase text-orange">NASA's Solution</h2>
            <div className="mx-auto max-w-[750px]"><MemoryGrid states={solutionStates(solP)} /></div>
            <p className="mt-6 !font-display text-[30px] font-bold uppercase text-crt transition-opacity duration-300" style={{ opacity: solP > 0.92 ? 1 : 0 }}>Code Reallocated</p>
          </div>
        </div>
      </section>

      <section className="flex min-h-[60vh] items-center justify-center px-7 py-16 text-center">
        <h2 data-reveal="scale" className="m-0 !font-display text-[clamp(28px,5vw,62px)] font-bold uppercase leading-[1.05] text-orange">
          Now it's your turn<br />to solve the problem!
        </h2>
      </section>

      <section id="finale" ref={finaleRef} className="mx-auto max-w-[1800px] px-7 py-20">
        {minigameVisible && (
          <Suspense fallback={<div className="h-[600px]" />}>
            <MemoryMinigame />
          </Suspense>
        )}
      </section>

      <section className="mx-auto max-w-[1600px] px-7 pt-8 text-center font-term">
        <p data-reveal="up" className="m-0 mb-[18px] text-base md:text-[24px] leading-[1.8] text-ash/60">Voyager 1 continues its journey through interstellar space today. Its recovery wasn't possible because engineers replaced broken hardware — it was possible because they understood how computers organize memory and execute instructions.</p>
        <p data-reveal="up" className="m-0 text-base md:text-[24px] leading-[1.8] text-ash">Great engineering isn't always about more advanced technology. Sometimes, a deeper understanding of the fundamentals is what makes the difference.</p>
      </section>

      <div className="relative mt-10 h-[540px] ">
            <div 
            data-parallax 
            data-speed="-6" 
            className="absolute left-1/2 bottom-[-220px] -z-10 w-[clamp(650px,60vw,1400px)] -translate-x-1/2 pointer-events-none select-none opacity-100"
            >
           
                <img
                    src={earthImg.src}
                    alt="Earth"
                    width={earthImg.width}
                    height={earthImg.height}
                    loading="eager"
                    decoding="async"
                    className="w-full h-auto object-contain"
                    style={{
                        filter: 'drop-shadow(0px -5px 60px rgba(170, 210, 255, 0.4)) drop-shadow(0px -15px 120px rgba(29, 91, 158, 0.5))',
                        opacity: 0.9,}}
                />
            </div> 
        </div>

        <section id="references" className="relative z-10 mx-auto max-w-[1600px] px-7 md:px-14 pt-[220px] pb-24 font-term text-[16px] text-ash/60">
            
            <div className="h-px flex-1 bg-gradient-to-r from-orange/20 via-orange/40 to-transparent bg-[linear-gradient(to_right,rgba(250,102,2,0.35)_1px,transparent_1px)] bg-[size:6px_1px]" />
            
            <div className="pl-6 md:pl-14"> 

            <h3 className="m-0 mt-10 mb-8 !font-display text-base md:text-[22px] font-bold uppercase text-orange">
                References
            </h3>            

            <ul className="m-0 pl-6 list-none flex flex-col gap-4 max-w-[1200px] text-[15px] leading-relaxed">
            
                <li className="m-0 border-l border-white/10 pl-4 py-0.5">
                    Computer memory definition concepts retrieved from{" "}
                    <a href="https://certifiedsystemsgroup.com/understanding-computer-memory/" target="_blank" rel="noreferrer" className="text-orange/80 hover:text-orange underline transition-colors break-all">https://certifiedsystemsgroup.com/understanding-computer-memory/</a>
                </li>

                <li className="m-0 border-l border-white/10 pl-4 py-0.5">
                    Memory address definitions and processor architecture retrieved from{" "}
                    <a href="https://www.ituonline.com/tech-definitions/what-is-a-memory-address/" target="_blank" rel="noreferrer" className="text-orange/80 hover:text-orange underline transition-colors break-all">https://www.ituonline.com/tech-definitions/what-is-a-memory-address/</a>
                </li>

                <li className="m-0 border-l border-white/10 pl-4 py-0.5">
                    Microprocessor memory structural operations retrieved from{" "}
                    <a href="https://www.uobabylon.edu.iq/eprints/publication_3_22584_1575.pdf" target="_blank" rel="noreferrer" className="text-orange/80 hover:text-orange underline transition-colors break-all">https://www.uobabylon.edu.iq/eprints/publication_3_22584_1575.pdf</a>
                </li>

                <li className="m-0 border-l border-white/10 pl-4 py-0.5">
                    Memory mapping core definitions and OS tables retrieved from{" "}
                    <a href="https://www.geeksforgeeks.org/operating-systems/memory-mapping/" target="_blank" rel="noreferrer" className="text-orange/80 hover:text-orange underline transition-colors break-all">https://www.geeksforgeeks.org/operating-systems/memory-mapping/</a>
                </li>

                <li className="m-0 border-l border-white/10 pl-4 py-0.5">
                    Virtual addressing and page allocation mechanics retrieved from{" "}
                    <a href="https://questdb.com/glossary/memory-mapping/" target="_blank" rel="noreferrer" className="text-orange/80 hover:text-orange underline transition-colors break-all">https://questdb.com/glossary/memory-mapping/</a>
                </li>
            </ul>

            </div>

        </section>

        
    </div>
  );
}