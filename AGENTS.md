# AGENTS

## Stack

- Runtime/package manager: Bun
- App framework: React 19 + TypeScript
- Bundler/dev server: Vite on port `3000`
- UI primitives: shadcn-style component structure with Radix UI
- Styling: Tailwind CSS v4 + project CSS variables
- 3D viewport: Three.js

## Purpose

This project is a frontend scaffold for a browser CAD application inspired by Onshape. Current behavior is intentionally limited to UI structure, typed tool dispatch, and a navigable 3D workspace. CAD operations do not execute yet; tool actions only emit typed events and log to the console.

## Interface Overview

- Top toolbar: icon-only CAD tools with tooltips, search, undo/redo on the left, mode-aware tool switching between `part` and `sketch`, and dropdown support for tool families like pattern variants.
- Left sidebar: feature tree at the top and parts/objects at the bottom, both kept visually compact for dense CAD-style navigation.
- Main viewport: Three.js canvas with an XY grid, three perpendicular reference planes (`XY`, `YZ`, `XZ`), right-click rotate, middle-mouse pan, and a clickable view cube overlay for fast camera orientation changes.

## Important Architecture

- Tool definitions live in `src/domain/tools/` and are the source of truth for ids, groups, icons, modes, and dropdown families.
- Tool/group hooks are strongly typed through `ToolActionBus`; clicking a tool dispatches the group event first and the tool event second.
- UI components live under `src/components/`; tool logic, schemas, and scene helpers stay in `src/domain/` and `src/hooks/`.
- `ToolActionProvider` supplies the current mode and the shared action bus to the UI.

## Current Behavior Rules

- All toolbar actions currently `console.log` through subscribers installed in the workbench.
- Entering sketch mode is triggered by the `Sketch` tool.
- Returning to part mode is triggered by `Finish Sketch`.
- Keep UI, domain definitions, and future CAD behavior split cleanly; do not mix scene logic or event contracts into presentational components.
