# Final Milestone Update (July 2026 - Final Submission)

**Deployment Link:** [https://rdgonzaga.github.io/memory-block-blast/](https://rdgonzaga.github.io/memory-block-blast/)

In the final week before submission, our team focused on fixing mobile layouts, making the minigame fairer, speeding up the site's load times, and cleaning up our codebase.

### Challenges

* Getting the game to work on phones was super frustrating. Our original desktop grid layout looked completely broken and unusable on a vertical mobile screen.
* The site lagged hard at first. The browser was trying to load all our heavy images and the entire React minigame at the same time, which tanked the initial load speed.
* Our first drafts were way too long and full of unnecessary jargon. We realized that if we wanted people to actually learn about computer architecture, we had to cut it down. We spent a lot of time editing the paragraphs to make the narrative readable and straight to the point.

---

### Aha! Moments

* During playtesting, our friends kept getting frustrated because the random memory corruption would sometimes make the game impossible to win. We realized the game was punishing players unfairly. We needed to add a quick check to guarantee every round is actually winnable, and show a preview of upcoming blocks so players can plan.
* We realized that our load times are slow because of our massive and unoptimized images. Simply changing our image formats made the site load way faster.

---

### Technical Discussion

* We refactored the board to dynamically reconfigure into a vertical 6x9 grid on mobile viewports while keeping the same array indexes and state management. We also fixed GSAP scroll-pinning bugs that caused the screen to jump around on phone browsers, and clamped our typography sizes to stop the page from overflowing horizontally.
* We added a validation algorithm during the dealing phase. The game now verifies that every dealt memory fragment has at least one valid, unblocked placement on the board, preventing unwinnable drops. We also expanded the block queue UI so players can strategize.
* We converted all media to `.webp`, cutting image payload sizes by over 60%. More importantly, we wrapped the interactive minigame in `React.lazy` and `Suspense` boundaries. This means the initial narrative page loads instantly, and the heavy game bundle only loads when the user scrolls down to it.

---

### Disclosure on the Use of AI

During the development of this project, we utilized Large Language Models (LLMs) to assist with scaffolding, technical troubleshooting, and iterative coding:

* **Anthropic Claude:** Utilized primarily during the early stages of development to brainstorm the overarching structure and generate the foundational layout design templates for the website.
* **Google Gemini:** Utilized during active development to assist with complex programming tasks. This included refining the logic for the interactive drag-and-drop minigame. This was also used to revise the grammar, contents, and create placeholders text while designing the project.

*Note: All AI-assisted designs and code snippets were thoroughly reviewed, modified, and tested by our group to ensure they aligned with our specific project requirements and academic standards.*

---

<br/>
<br/>

***

# Mid-Milestone Update (July 2026)

**Deployment Link:** [https://rdgonzaga.github.io/memory-block-blast/](https://rdgonzaga.github.io/memory-block-blast/)

### Challenges

Our very first challenge as a group was selecting a topic for the case study that is both interesting and related to CSARCH2. We explored a number of different topics like CrowdStrike, military conflicts, and space applications. Ultimately, we liked the idea of the type of technology in the context of space and Aerospace Engineering and decided to take the problem with **Voyager 1’s FDS** and how NASA Engineers figured out what the problem is and what they did to solve it.

At first, we didn’t really know what the actual problem was with Voyager 1’s FDS since we didn’t fully understand the underlying concept that made it fail. We thought it was because some kind of RAM inside Voyager 1 had failed, and they had to fix that remotely. Turns out, the thing had **multiple memory chips inside of it, and a single one of them was responsible for storing a portion of the FDS Software that had failed**, and all they had to do was transfer instructions from the old broken memory chip to a new one.

We also found it difficult to allocate time for developing the website itself due to demands from other courses such as LBYARCH, CSSWENG, STHCIUX, and CSNETWK. Finally, we struggled with **deployment pathing on GitHub Pages**, where our background images kept breaking in production because our Vite/Astro bundler couldn't resolve hardcoded string paths on a subpath domain. We had to **migrate to dynamic React imports** to fix it.

---

### Interactive Element

The interactive element we ended up implementing is a minigame that requires the user to put blocks of instructions from the broken memory chip into a new one. We thought that it would be boring if we just implemented a drag-and-drop system by itself, so we added **pressure mechanics** and a goal for the user to achieve.

While developing the minigame, many things went wrong. First, the drag-and-drop feature was a little clunky and hard to play with, which took a little bit of time figuring out how to make it easy and predictable for the user to place the blocks. We also had some trouble figuring out how to **make the graphics of the minigame look like an actual memory chip**, so we tried adding memory addresses to each box of the game’s grid. The sizes of the text at first were also too small to be noticeable by the player, so we made them bigger and more obvious.  

We also spent considerable time **refining the game logic to make it fair**. During testing, cosmic radiation would randomly destroy pieces the player had already successfully placed. We fixed this by programming an **"occupied-slot immunity map"** that forces radiation to only target empty memory sectors and actively rejects players from dropping pieces onto actively decaying slots. To improve the ergonomics of the workspace, we redesigned the layout entirely, **moving the drag-and-drop tray to a fixed left sidebar and the "Next Up" queue to the bottom** so the game feels like a proper terminal dashboard.

---

### Aha Moments & Things Learned

During the early development phases of this project, there was considerable confusion regarding the exact purpose and relationship between our **MDX file layer and our TSX component layer**. The initial impression was that MDX files were simply a glorified Markdown layout with very little unique programmatic value. 

Initially, our Mission Control HUD used generic placeholder timers that just ticked upwards arbitrarily. We realized that we could **use actual astrophysics to drive the UI instead**. By anchoring to a known NASA epoch (Jan 1, 2024) and programming Voyager 1's true drifting speed (17.0 km/s), we wrote a simple algorithm to compute the probe's **exact real-time distance and live light-speed communication delay** in milliseconds. This change made our simple UI decoration into a highly accurate, grounded scientific dashboard.

---

### Creative Development

To make our computer architecture project engaging and intuitive, we designed our exhibit with a **strong emphasis on storytelling and interactive learning**. Instead of immediately forcing users into a raw programming challenge, we structured the exhibit to first guide the user through a chronological, scroll-driven visual timeline. This narrative provides crucial backstory regarding the **real-world stakes of the Voyager 1 mission**, the engineering difficulties the crew faced across a 15-billion-mile radio link, and the underlying mechanics of absolute memory addressing and physical mapping. By establishing this solid narrative foundation, users can easily understand the purpose behind the technical hardware constraints before transitioning into the main operations mini-game. This makes the player feel like a member of the mission rescue crew. 

We also implemented a lot of **smooth scroll-scrubbed reveal animations using GSAP**, which we had some problems with at first because the animations would sometimes fire way too early.

---

### Things to be done in the final submission  

Although the progress we’ve made in this submission is already good, there are still several changes we would like to be made by the final submission. The following are:

1. Improve layout design and overall mobile responsiveness;
2. Improve the game mechanics;
3. Optimize the website’s performance and scrolling animations;
4. Add subtle sound design like retro terminal beeps to make the website more immersive;
5. Clean up unused components, functions, and comments;

---

<br/>
<br/>

***

# CSARCH2 Virtual Exhibit Proposal

## S03 Group 3

## Group Members

| Name |
| :--- |
| Gonzaga, Rainer D. |
| Gonzales, Aaron James S. |
| Manalang, Kennese Ross F. |
| Marcaida, Duncan Joseph B. |
| Ramos, Richmond Jose G. |

---

## I. Topic Theme

**Project Title:** Memory Block Blast: Reallocating Voyager 1’s Fragmented Memory Map  
**Chosen Topic:** The 2024 Voyager 1 Flight Data Subsystem (FDS) Memory Rescue  
**Category:** Problem-solving stories

---

## II. Exhibit Narrative Content

### 1. What is Voyager 1?

Launched on September 5, Voyager 1 is one of the two space probes launched by NASA in 1977. It holds the record for traveling further than any man-made object originating from Earth. It is currently drifting through interstellar space at a speed of around 17 kilometers per second, over 15 billion miles from Earth. It operates on legacy computer architecture built during the 1970s, acting as a sort of time capsule of early computing. Because of the distance, any radio command sent to the space probe takes around 23.5 hours to arrive, making a full communication round-trip take 47 hours.

### 2. Background/Context of Voyager 1 FDS Failure

In November 2023, the Telemetry Modulation Unit (TMU) of Voyager 1 suddenly stopped sending readable data, instead transmitting a gibberish pattern of binary 1s and 0s. After months of remote debugging, NASA pinpointed the root cause: a corrupted 256-word memory chip inside the Flight Data Subsystem (FDS). Since physical repair is impossible to do, the spacecraft's operating code on that faulty chip had to be relocated to a different memory.

### 3. Why This is a Computer Architecture Topic (Problem & Solution)

This situation is a real-world example of hardware constraints and memory mapping. It highlights how software instructions are permanently tied to physical memory addresses. Working with highly restricted 1970s memory banks, NASA engineers had to calculate the exact byte sizes of the stranded instructions and chop the code into smaller fragments. From there, they meticulously rewrote the internal memory pointers so the CPU could pull and execute these scattered pieces of code across different, non-contiguous hardware blocks.

### 4. Timeline of the mission

* **September 5, 1977** - Launch of Voyager 1
* **November 14, 2023** - Voyager 1 stopped sending readable science and engineering data back to Earth
* **March 3, 2024** - NASA team noticed that activity from one part of the flight data system stood out from the rest of the garbled data.
* **April 20, 2024** - Mission flight team heard back from the spacecraft after five months.

---

## III. Exhibit Flow

### Narrative Structure

The exhibit follows a **ScrollyTelling** format. As the user scrolls downward, the chronological timeline of Voyager 1 unfolds through scroll-driven animations and visual storytelling elements, simulating a sense of space travel that mirrors the spacecraft’s journey through space.

### Definition of Memory

To give the users a quick foundation before diving into the problem of Voyager 1, this section defines computer memory in accessible terms. It will explain memory as the electronic workspace where a computer stores the active data and operating instructions it needs to function. 

### Memory Addressing and Memory Mapping

Building on the definition of memory, this section introduces how the computer navigates its storage.

* **Memory Addressing:** We will explain how every piece of data is assigned a unique numerical identifier (an address) so the central processing unit (CPU) can locate it instantly.
* **Memory Mapping:** The exhibit will visually break down how a computer organizes these addresses into distinct regions for system code, temporary data, and hardware communications.

Before reaching the interactive segment, users will encounter a brief concept discussion introducing the computer architecture principles behind the Voyager 1 recovery effort. Through descriptions and visual illustrations, the exhibit will explain how software instructions are stored in specific memory locations and how processors use memory addresses to fetch and execute instructions. The discussion will also highlight the challenges posed by hardware limitations and memory corruption, demonstrating how NASA engineers were forced to relocate critical code to alternative memory regions.

### Instruction Pointer Control

The exhibit will also introduce the concept of Instruction Pointer control and program flow. Users will learn how a processor normally executes instructions sequentially and how jump instructions can redirect execution to different memory addresses. This concept is central to understanding how Voyager 1 continued operating even after portions of its software were relocated across non-contiguous memory regions.

### Interactive Element

The interactive mini-game will serve as a visual demonstration of these concepts by allowing users to perform memory reallocation and instruction remapping. Through this activity, users will gain an understanding of how memory organization, address mapping, and control flow were used by NASA engineers to restore communication with Voyager 1 after the Flight Data Subsystem failure.

Upon reaching the 2024 problem-solving segment, the exhibit will feature an interactive mini-game. Voyager 1’s minigame will be focused on memory reallocation and instruction mapping.

* **User Flow:** The user will encounter a mission-control terminal responsible for receiving engineering updates from Voyager 1. Due to a memory chip failure, memory in the FDS that is responsible for packaging and sending engineering and science data became corrupted. They must transfer packages of code from the old memory chip to the new working memory chip by selecting memory chunks from the old memory chip and selecting a sector in the new memory chip for the memory chunk to transfer to. The user must successfully transfer all necessary code to the new memory chip and initiate CPU Jump Remapping to fix Voyager 1’s output stream.

This gamified task serves as an application of the previously discussed Computer Architecture concepts. By relocating code fragments and performing CPU jump remapping, users will gain an intuitive understanding of how software can continue functioning even when code must be relocated across different memory regions. The activity reinforces concepts such as memory addressing, memory organization, and control flow in an engaging medium.

---

## IV. Technical Stack

To build this interactive exhibit, our group will utilize a modern web stack with the following technologies:

* **Astro 6 & Node.js 26:** This is based on the template repository that will be forked.
* **MDX (Markdown Extended):** This lets us write out the historical Voyager story in standard markdown while allowing us to drop our interactive React components straight into the text wherever we need them. 
* **React & TypeScript:** This will be the main stack that will run the interactive minigame. React will be used to manage all the moving parts of the memory block in the minigame. While TypeScript is used to ensure strict data typing for the whole project.
* **Tailwind CSS:** Tailwind CSS will handle the styling for the whole project. It provides utility classes to efficiently style the retro 1970s NASA aesthetic mixed with vibrant, touch-friendly, and mobile-responsive UI for the gamified tasks.

---

## V. Tentative Style Guide Snapshot & Motif

**Theme:** Retro Space Website  
The visual motif will be a blend of the monochromatic aesthetic of 1970s NASA Mission Control terminals for the narrative sections and the vibrant, flat-design UI of an Among Us task screen for the interactive mini-game.

### Color Palette:

* **Background:** Deep Space Black (#050505) and Dark Slate (#1E1E1E) to create an immersive, void-like backdrop.
* **Primary Text (Narrative):** Ghost White (#F8F8FF) and Light Ash (#D3D3D3) for readability against the dark backgrounds.
* **Accent/Interactive UI:** Alert Red (#E63946) for the corrupted memory block and flashing error messages.

### Typography:

* **Heading Font:** Century Gothic Bold or Space Grotesk for wide, commanding section titles.
* **Body/Terminal Font:** Roboto Mono for memory addresses and raw data streams, paired with Inter for standard paragraph readability.

### Layout & Interface:

* **Content Sections:** A single-column layout centered on the screen, reading like a chronological mission log.
* **Interactive Area:** The memory grid will be inside a rounded container with a thick, gray border, designed to look like a physical "tablet" or "maintenance panel" the user just pulled up.

---

## VI. References & Inspiration

### Site References:

* [Star Wars Eclipse](https://www.starwarseclipse.com/)
* [Solar System Scope](https://www.solarsystemscope.com/)
* [NASA Voyager Timeline](https://science.nasa.gov/mission/voyager/timeline/)
* [CNN: Voyager 1 Communication Fix](https://edition.cnn.com/2024/04/22/world/voyager-1-communication-issue-cause-fix-scn)

### Inspiration:

* [Prototype of the new NASA site #1](https://ph.pinterest.com/pin/422281211192498/)

### Reference Images:

<img src="./img/ref1.jpg" width="400" alt="Reference 1" />
<img src="./img/ref2.jpg" width="400" alt="Reference 2" />
<img src="./img/ref3.png" width="400" alt="Reference 3" />