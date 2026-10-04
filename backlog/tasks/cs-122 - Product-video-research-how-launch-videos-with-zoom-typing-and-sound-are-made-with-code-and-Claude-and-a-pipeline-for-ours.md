---
id: CS-122
title: >-
  Product video research: how launch videos with zoom, typing and sound are made
  with code and Claude, and a pipeline for ours
status: To Do
assignee: []
created_date: '2026-10-04 10:24'
labels:
  - research
  - docs
dependencies: []
priority: high
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner request 2026-10-04: research how people make very cool, aesthetic, energetic motion-graphics videos to introduce a product, with Claude: which technologies (Theatre.js, Remotion, Motion Canvas and the like), the effects (zoom, then typing, with keyboard sounds and whooshes), how companies such as OpenAI introduced their products, which repositories help. The video must show everything we built (product, technical side, evaluations, tests and end-to-end coverage, production-grade code, the Claude Code configuration), very short, and the same material can be shown in more depth after the demo.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A cited research note in docs/research (at least 20 real sources: launch videos of OpenAI, Anthropic, Linear, Vercel, Raycast, Cursor, Notion, Arc and others with what can be seen of how each was made; the open-source tools and their repositories with licences, stars, activity and what each is good at (Remotion and its Claude Code skills, Motion Canvas, Revideo, Theatre.js, GSAP with a headless capture, Lottie and Rive, Manim, Slidev with code animation, VHS for terminal recordings, Screen Studio style zoom tools and their open-source alternatives, ffmpeg based editors); and how people use Claude or other agents with them) with a comparison table
- [ ] #2 The look and feel is analysed with concrete numbers (shot length, zoom curves and easing, type speed, cursor motion, transitions, caption style, music tempo, loudness) from at least five reference videos, and the sound side is covered: where keyboard, click and whoosh sounds come from, open licences and file sources, how to time them to frames, music and voiceover options, and what works from Iran (accounts, payment, blocked services)
- [ ] #3 Practicalities are measured on this laptop (render speed and CPU/RAM of a 20-second 1080p60 sample in the leading stack, capture quality of the real app: Playwright recording against a deterministic replay of UI states in React), and the note ends with two or three pipelines compared by effort, look, control and risk, one recommended
- [ ] #4 A tiny runnable prototype of the recommended pipeline in a scratch folder (not in the app): one 15-second sequence (zoom into the search box, type a plain-Farsi sentence with keyboard sounds, the results land with a whoosh), rendered once, with the files and commands, so the owner can judge the feel; the machine is shared with other work, so the render runs once and alone
- [ ] #5 Checks pass; the note and prototype are committed (the prototype in tools or docs/assets as agreed in the note, outputs not committed if large); no demo script is written (the owner did not ask for one)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
