// Estado global de transmissão ao vivo (in-memory, efêmero)
let liveMode = false;
let liveDjName: string | null = null;

export function isLive(): boolean {
  return liveMode;
}

export function getLiveState(): { live: boolean; djName: string | null } {
  return { live: liveMode, djName: liveDjName };
}

export function setLive(active: boolean, djName?: string): void {
  liveMode = active;
  liveDjName = active ? (djName || null) : null;
}
