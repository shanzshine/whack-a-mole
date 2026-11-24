# moleclub

A cute, polished Whack-a-Mole arcade game crafted for quick breaks. Built with pure HTML5, CSS3, and vanilla JavaScript — zero external dependencies or build tools needed.

## Features

- **Multi-Stage Adventure**:
  - **Stage 1 (Sunny Meadow)**: Classic garden moles, calm and friendly pace. Goal: 15 pts.
  - **Stage 2 (Sunset Orchard)**: Autumn sunset ambience, faster moles, and introduces **Golden Moles** (+3 pts)! Goal: 22 pts.
  - **Stage 3 (Midnight Grove)**: Glowing twilight night theme with firefly tones. Introduces sneaky **Bomb Moles** (-2 pts & resets your combo streak)! Goal: 28 pts.
- **Special Mole Types**:
  - **Regular Mole**: The cheeky garden brown mole (+1 pt).
  - **Golden Mole**: Shiny gold crown & sparkle aura (+3 pts with sparkling arpeggio chime).
  - **Hazard Bomb Mole**: Sneaky bandit with a fuse; hitting it penalizes -2 pts and breaks your combo streak!
- **Combo Multiplier & Fever**:
  - Build consecutive hit streaks to climb combos (`2x`, `3x`, `5x Fever Mode`).
  - Audio pitches dynamically elevate with your combo streak.
- **Custom Arcade Mallet Cursor**:
  - Play with a wooden mallet cursor that tilts & whacks downward on click.
- **Arcade Desktop & Numpad Controls**:
  - Whack via mouse, touch screen, or keyboard number keys `1` through `9` / Numpad for intense rhythm-arcade reflex play.
- **Difficulty Modes**:
  - **Easy**, **Medium**, and **Hard** with tailored speed curves and separate best score tracking in `localStorage`.
- **Procedural Cartoon Audio**:
  - 100% synthesized audio via Web Audio API (pops, hit notes, golden shimmers, hazard buzz, level clear fanfare, and victory songs).
- **Lightweight & DRY Architecture**:
  - Modular SVG burrow templates rendered dynamically via HTML `<template>`, slashing page weight and maximizing performance.

## How to Play

1. Open `index.html` in any modern web browser.
2. Select your **Stage** (Stage 1 Meadow, Stage 2 Sunset, or Stage 3 Midnight) and **Difficulty**.
3. Hit **Start game** (or press Space / Enter).
4. Whack moles by clicking, tapping, or pressing keys `1`–`9` before the 30-second timer runs out.
5. Reach the stage target score to clear the level and unlock the next stage!

## Controls

- **Mouse / Touch**: Click or tap any burrow.
- **Keyboard (Direct Grid)**: Keys `1`–`9` or `Numpad 1`–`9` immediately whack burrows 1 to 9.
- **Keyboard (Accessibility)**: `Tab` to navigate, `Space` or `Enter` to whack.
