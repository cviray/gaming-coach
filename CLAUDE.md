# Gaming Coach CLI — Project Rules

## Server

- **Never start, restart, or kill `server.py`** — the user runs the server manually.
- When a code change requires a server restart to take effect, say so clearly and let the user do it.

## Browser / Frontend

- Always remind the user to **hard refresh** (`Ctrl+Shift+R`) after changes to `public/app.js` or any static file, since Flask may serve cached versions.

## Debugging

- Temporary `print` / `console.log` debug lines are acceptable during investigation but must be removed once the issue is confirmed or fixed.

## Code Style

- Keep changes minimal and targeted — no refactors, no extra abstractions beyond what the task requires.
- No docstrings, comments, or type annotations added to untouched code.

## Stack

- **Backend:** Python / Flask (`server.py`) — spawns `claude -p` as a subprocess with `--output-format stream-json`
- **Frontend:** Vanilla JS (`public/app.js`), marked.js for markdown rendering
- **Data:** OP.GG MCP tools via Claude CLI (`--dangerously-skip-permissions`)
