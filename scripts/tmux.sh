#!/bin/bash

SESSION_NAME=${1:-"somdomato"}
[ "$(sw_vers -productName)" == "macOS" ] && \
    PROJECT_DIR="/Users/lucas/code/sdm/somdomato" || \
    PROJECT_DIR="/home/lucas/code/sdm/somdomato"

[ ! -L "$PROJECT_DIR/public/music" ] && ln -s /Users/lucas/Music/sdm "$PROJECT_DIR/public/music"

if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    if tmux list-windows -t $SESSION_NAME 2>/dev/null | grep -q "studio"; then
        tmux attach-session -t $SESSION_NAME
        exit 0
    else
        echo "🔄 Sessão corrompida detectada, recriando..."
        tmux kill-session -t $SESSION_NAME 2>/dev/null
    fi
fi

echo "🚀 Criando sessão $SESSION_NAME..."

# Método mais simples e robusto
tmux new-session -d -s $SESSION_NAME -c $PROJECT_DIR -n "work" \; \
  send-keys "clear" C-m \; \
  new-window -n "dev" -c $PROJECT_DIR \; \
  send-keys "npm run dev" C-m \; \
  new-window -n "studio" -c $PROJECT_DIR \; \
  send-keys "npx drizzle-kit studio" C-m \; \
  select-window -t 0
tmux attach-session -t $SESSION_NAME