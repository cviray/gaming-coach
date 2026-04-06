# Gaming Coach

A web-based AI coaching assistant for League of Legends, Teamfight Tactics, and Valorant — powered by Claude and live OP.GG data.

## What it does

Ask anything about your game and get coaching-grade answers backed by real-time data: champion builds, lane matchups, summoner profiles, TFT comps, Valorant agent picks, esports schedules, and more.

## Stack

- **Backend** — Python + Flask, streams responses via SSE
- **AI** — Claude CLI (`claude -p`) with the OP.GG MCP tools
- **Frontend** — Vanilla JS + HTML/CSS, renders markdown responses in real time

## Setup

**Prerequisites:** Python 3, Flask, and Claude Code CLI installed.

```bash
pip install flask
```

## Run

```bash
python server.py
```

Open `http://localhost:5000`.

## Project structure

```
gaming-coach-cli/
├── server.py          # Flask server + Claude subprocess
└── public/
    ├── index.html     # App shell
    ├── style.css      # Styles
    ├── app.js         # Chat logic + SSE stream handling
    └── icons/         # Logo and game icons
```
