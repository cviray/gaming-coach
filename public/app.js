// ─── Config ──────────────────────────────────────────────────
marked.setOptions({ breaks: true, gfm: true, mangle: false, headerIds: false });

const GAME_LABELS = { lol: 'LoL', tft: 'TFT', valorant: 'Valorant' };
const GAME_TITLES = {
  lol:      'League of Legends',
  tft:      'Teamfight Tactics',
  valorant: 'Valorant',
};

const TOOL_NAMES = {
  mcp__opgg__lol_get_champion_analysis:        'Fetching champion analysis',
  mcp__opgg__lol_get_lane_matchup_guide:       'Fetching lane matchup',
  mcp__opgg__lol_get_summoner_profile:         'Fetching summoner profile',
  mcp__opgg__lol_list_summoner_matches:        'Loading match history',
  mcp__opgg__lol_list_lane_meta_champions:     'Checking lane meta',
  mcp__opgg__lol_list_champion_leaderboard:    'Loading leaderboard',
  mcp__opgg__lol_get_champion_synergies:       'Fetching synergies',
  mcp__opgg__lol_get_pro_player_riot_id:       'Looking up pro player',
  mcp__opgg__lol_esports_list_schedules:       'Loading esports schedule',
  mcp__opgg__lol_esports_list_team_standings:  'Fetching standings',
  mcp__opgg__tft_list_meta_decks:              'Fetching TFT meta',
  mcp__opgg__tft_get_champion_item_build:      'Fetching item build',
  mcp__opgg__tft_list_augments:                'Loading augments',
  mcp__opgg__valorant_list_agent_statistics:           'Fetching agent stats',
  mcp__opgg__valorant_list_agent_compositions_for_map: 'Checking map comps',
  mcp__opgg__valorant_list_player_matches:     'Loading matches',
  mcp__opgg__valorant_list_leaderboard:        'Fetching leaderboard',
};

// ─── State ───────────────────────────────────────────────────
let activeGame = 'lol';
let isStreaming = false;
let conversationHistory = [];

// ─── DOM ─────────────────────────────────────────────────────
const feed          = document.getElementById('messages');
const inputEl       = document.getElementById('input');
const sendBtn       = document.getElementById('send-btn');
const clearBtn      = document.getElementById('clear-btn');
const contextDot    = document.getElementById('context-dot');
const contextLabel  = document.getElementById('context-label');

// ─── Helpers ─────────────────────────────────────────────────
function scrollBottom() { feed.scrollTop = feed.scrollHeight; }

function removeWelcome() {
  const w = document.getElementById('welcome');
  if (w) w.remove();
}

function setInputEnabled(on) {
  inputEl.disabled = !on;
  sendBtn.disabled = !on || !inputEl.value.trim();
}

function autoResize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 180) + 'px';
}

function updateGameContext(game) {
  activeGame = game;
  contextDot.className = `context-dot ${game}`;
  contextLabel.textContent = GAME_LABELS[game];
  const eyebrow = document.querySelector('#welcome-eyebrow .eyebrow-game');
  if (eyebrow) { eyebrow.textContent = GAME_TITLES[game]; eyebrow.className = `eyebrow-game ${game}`; }
}

// ─── Append user message ──────────────────────────────────────
function appendUser(text) {
  removeWelcome();
  const wrap = document.createElement('div');
  wrap.className = 'message-wrap user';
  const bubble = document.createElement('div');
  bubble.className = 'user-bubble';
  bubble.textContent = text;
  wrap.appendChild(bubble);
  feed.appendChild(wrap);
  scrollBottom();
}

// ─── Create assistant turn ────────────────────────────────────
function createAssistantTurn() {
  removeWelcome();

  const wrap = document.createElement('div');
  wrap.className = 'message-wrap assistant';

  const avatar = document.createElement('div');
  avatar.className = 'coach-avatar';
  avatar.textContent = 'GC';

  const body = document.createElement('div');
  body.className = 'assistant-body';

  const toolArea = document.createElement('div');
  toolArea.className = 'tool-area';

  const responseText = document.createElement('div');
  responseText.className = 'response-text';
  responseText.innerHTML = '<div class="thinking"><span></span><span></span><span></span></div>';

  body.appendChild(toolArea);
  body.appendChild(responseText);
  wrap.appendChild(avatar);
  wrap.appendChild(body);
  feed.appendChild(wrap);
  scrollBottom();

  return { toolArea, responseText };
}

// ─── Tool pill ────────────────────────────────────────────────
function showTool(toolArea, name) {
  const existing = toolArea.querySelector('.tool-pill');
  if (existing) existing.remove();
  const pill = document.createElement('div');
  pill.className = 'tool-pill';
  pill.innerHTML = `<div class="tool-spinner"></div>${TOOL_NAMES[name] || 'Fetching data'}…`;
  toolArea.appendChild(pill);
  scrollBottom();
}

function hideTool(toolArea) {
  const p = toolArea.querySelector('.tool-pill');
  if (!p) return;
  p.style.transition = 'opacity 0.25s';
  p.style.opacity = '0';
  setTimeout(() => p.remove(), 250);
}

// ─── Send ─────────────────────────────────────────────────────
async function send(text) {
  if (!text.trim() || isStreaming) return;
  isStreaming = true;
  setInputEnabled(false);

  appendUser(text);
  const { toolArea, responseText } = createAssistantTurn();

  let raw = '';
  let started = false;
  let cursor = null;

  const messageWithGame = `[Game: ${activeGame.toUpperCase()}] ${text}`;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: messageWithGame, history: conversationHistory }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        let ev;
        try { ev = JSON.parse(line.slice(6)); } catch { continue; }

        if (ev.type === 'tool') {
          showTool(toolArea, ev.tool);
        }

        if (ev.type === 'delta') {
          hideTool(toolArea);
          if (!started) {
            responseText.innerHTML = '';
            cursor = document.createElement('span');
            cursor.className = 'cursor';
            started = true;
          }
          raw += ev.text;
          responseText.innerHTML = marked.parse(raw);
          responseText.appendChild(cursor);
          scrollBottom();
        }

        if (ev.type === 'done') {
          cursor?.remove();
          responseText.innerHTML = marked.parse(raw);
          hideTool(toolArea);
          scrollBottom();
        }

        if (ev.type === 'error') {
          cursor?.remove();
          responseText.innerHTML = `<span style="color:var(--red)">Error: ${ev.text}</span>`;
        }
      }
    }
  } catch (err) {
    cursor?.remove();
    responseText.innerHTML = `<span style="color:var(--red)">Connection error: ${err.message}</span>`;
  } finally {
    cursor?.remove();
    if (raw) {
      conversationHistory.push({ role: 'user', content: messageWithGame });
      conversationHistory.push({ role: 'assistant', content: raw });
    }
    isStreaming = false;
    setInputEnabled(true);
    inputEl.focus();
  }
}

// ─── Clear ────────────────────────────────────────────────────
function buildWelcome() {
  const w = document.createElement('div');
  w.className = 'welcome';
  w.id = 'welcome';
  w.innerHTML = `
    <div class="welcome-eyebrow" id="welcome-eyebrow"><span class="eyebrow-game ${activeGame}">${GAME_TITLES[activeGame]}</span></div>
    <h1 class="welcome-title">From the Rift to the Range —<br/><span class="title-accent">dominate</span> every arena.</h1>
    <p class="welcome-sub">Ask anything — builds, counters, summoner stats, meta, matchups.</p>
    <div class="card-grid">
      <button class="prompt-card" data-prompt="What's the best Jinx build and runes right now?">
        <span class="card-icon">⚔</span><span class="card-label">Best Jinx build & runes</span>
      </button>
      <button class="prompt-card" data-prompt="Who are Jinx's top 3 counters and how do I play against them?">
        <span class="card-icon">🛡</span><span class="card-label">Top counters & how to lane</span>
      </button>
      <button class="prompt-card" data-prompt="What are the best meta decks in TFT right now?">
        <span class="card-icon">♟</span><span class="card-label">TFT meta decks</span>
      </button>
      <button class="prompt-card" data-prompt="What are the best Valorant agents on Ascent right now?">
        <span class="card-icon">◎</span><span class="card-label">Best agents on Ascent</span>
      </button>
    </div>
  `;
  bindCards(w);
  return w;
}

clearBtn.addEventListener('click', () => {
  feed.innerHTML = '';
  feed.appendChild(buildWelcome());
  conversationHistory = [];
});

// ─── Event bindings ───────────────────────────────────────────
inputEl.addEventListener('input', () => {
  autoResize();
  sendBtn.disabled = !inputEl.value.trim() || isStreaming;
});

inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (text && !isStreaming) {
      inputEl.value = '';
      autoResize();
      sendBtn.disabled = true;
      send(text);
    }
  }
});

sendBtn.addEventListener('click', () => {
  const text = inputEl.value.trim();
  if (text && !isStreaming) {
    inputEl.value = '';
    autoResize();
    sendBtn.disabled = true;
    send(text);
  }
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    updateGameContext(tab.dataset.game);
  });
});

function bindCards(root = document) {
  root.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.dataset.prompt;
      if (prompt && !isStreaming) send(prompt);
    });
  });
}

// ─── Init ─────────────────────────────────────────────────────
bindCards();
inputEl.focus();
