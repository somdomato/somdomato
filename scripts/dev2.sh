#!/usr/bin/env bash

SESSION="pvt"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux attach-session -t "$SESSION"
  exit 0
fi

tmux new-session -d -s "$SESSION" -x 220 -y 50 "pnpm dev"
tmux new-window -t "$SESSION"
tmux attach-session -t "$SESSION"
