Som do Mato — systemd timer

This folder includes a sample systemd `service` and `timer` to run the `seed-watcher` script every 15 minutes.

Files:
- `somdomato-seed.service` — runs `bun ./src/db/seed-watcher.ts` in the repository working directory.
- `somdomato-seed.timer` — triggers the service every 15 minutes (and 1 minute after boot).

Notes & install instructions:
1. Adjust `WorkingDirectory`, `User`, `Group`, and any `Environment` vars in the `.service` file to match your system paths and user.
2. To install as a system-level timer (requires root):
   sudo cp somdomato-seed.service /etc/systemd/system/
   sudo cp somdomato-seed.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now somdomato-seed.timer

3. To install for a single user (without root), run as that user:
   mkdir -p ~/.config/systemd/user
   cp somdomato-seed.service ~/.config/systemd/user/
   cp somdomato-seed.timer ~/.config/systemd/user/
   systemctl --user daemon-reload
   systemctl --user enable --now somdomato-seed.timer

4. Troubleshooting:
   - See logs with `journalctl -u somdomato-seed.service -f` (or `journalctl --user -u somdomato-seed.service -f` for user-level)
   - Verify the script runs on demand: `systemctl start somdomato-seed.service`
   - Ensure `bun` is in the `PATH` for the chosen `User`, or use an absolute path to the `bun` binary in `ExecStart`.
