# Axis Invaders

A tiny browser-based Space Invaders–style game with three themed stages:

1. **Cage Rage** — Nicolas Cage-inspired chaos (dramatic faces, blood-red palette)
2. **BYD Velocity** — BYD-inspired pursuit (silver/gunmetal/BYD-red, scrolling lane)
3. **Samba Storm** — Brazilian Carnaval party (yellow/green/red, drifting confetti)

Difficulty ramps classically: each stage adds rows, faster march, faster bullets, more frequent enemy fire.

## Run

Just double-click `index.html` — opens in any modern browser. No build step, no server, no dependencies.

## Controls

| Key                   | Action       |
|-----------------------|--------------|
| `←` `→` or `A` `D`    | Move         |
| `Space`               | Fire         |
| `Enter`               | Start / restart |
| `P`                   | Pause toggle |

## Tech

- Vanilla HTML5 Canvas + JavaScript (no frameworks, no build, no deps)
- Pixel-art sprites generated programmatically from a tiny string-grid DSL
- Synthesized SFX via WebAudio (no audio files shipped)
- Single namespace `window.AxisInvaders` across plain `<script>` tags
