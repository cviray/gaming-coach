import subprocess
import json
import os
from flask import Flask, request, Response, send_from_directory

app = Flask(__name__, static_folder="public")

CLAUDE_PATH = "/home/jums/.local/bin/claude"
WORK_DIR = os.path.dirname(os.path.abspath(__file__))

SYSTEM_PROMPT = """You are a professional gaming coach specializing in League of Legends, Teamfight Tactics (TFT), and Valorant. You have access to live OP.GG data through MCP tools.

When a user asks about:
- Champion stats, builds, runes, counters → use mcp__opgg__lol_get_champion_analysis or mcp__opgg__lol_get_lane_matchup_guide
- Summoner profiles, rank, match history → use mcp__opgg__lol_get_summoner_profile or mcp__opgg__lol_list_summoner_matches
- TFT comps, items, augments → use the tft_ MCP tools
- Valorant agents, maps, stats → use the valorant_ MCP tools
- Esports schedules or standings → use mcp__opgg__lol_esports_list_schedules or mcp__opgg__lol_esports_list_team_standings

Always fetch live data when relevant. Be concise, direct, and format responses cleanly using markdown (tables for stats, bold for key points). You are a premium coaching assistant — give actionable advice, not just raw numbers."""


@app.route("/")
def index():
    return send_from_directory("public", "index.html")


@app.route("/public/<path:filename>")
def static_files(filename):
    return send_from_directory("public", filename)


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_message = data.get("message", "").strip()
    history = data.get("history", [])
    print(f"[DEBUG] history length: {len(history)}", flush=True)
    print(f"[DEBUG] history: {json.dumps(history[:2])}", flush=True)
    if not user_message:
        return {"error": "Empty message"}, 400

    # Build a conversation transcript so Claude retains context across turns
    transcript = ""
    for turn in history:
        role = turn.get("role", "")
        content = turn.get("content", "")
        if role == "user":
            transcript += f"\nUser: {content}"
        elif role == "assistant":
            transcript += f"\nAssistant: {content}"

    transcript += f"\nUser: {user_message}"

    full_prompt = f"{SYSTEM_PROMPT}\n\nConversation so far:{transcript}\n\nRespond to the latest User message above, using the full conversation history for context."

    def generate():
        try:
            proc = subprocess.Popen(
                [
                    CLAUDE_PATH,
                    "-p", full_prompt,
                    "--output-format", "stream-json",
                    "--include-partial-messages",
                    "--verbose",
                    "--no-session-persistence",
                    "--dangerously-skip-permissions",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                cwd=WORK_DIR,
                text=True,
                bufsize=1,
            )

            for line in proc.stdout:
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue

                # Stream text deltas to the client
                if (
                    event.get("type") == "stream_event"
                    and event.get("event", {}).get("type") == "content_block_delta"
                    and event.get("event", {}).get("delta", {}).get("type") == "text_delta"
                ):
                    text = event["event"]["delta"]["text"]
                    payload = json.dumps({"type": "delta", "text": text})
                    yield f"data: {payload}\n\n"

                # Signal tool use (so UI can show "fetching data...")
                elif (
                    event.get("type") == "stream_event"
                    and event.get("event", {}).get("type") == "content_block_start"
                    and event.get("event", {}).get("content_block", {}).get("type") == "tool_use"
                ):
                    tool_name = event["event"]["content_block"].get("name", "")
                    payload = json.dumps({"type": "tool", "tool": tool_name})
                    yield f"data: {payload}\n\n"

                # Done
                elif event.get("type") == "result":
                    payload = json.dumps({"type": "done"})
                    yield f"data: {payload}\n\n"
                    break

            proc.wait()

        except Exception as e:
            payload = json.dumps({"type": "error", "text": str(e)})
            yield f"data: {payload}\n\n"

    return Response(generate(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


if __name__ == "__main__":
    print("Gaming Coach running at http://localhost:5000")
    app.run(debug=False, port=5000, threaded=True)
