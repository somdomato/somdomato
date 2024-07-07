export const controls = `
<div class="plyr__controls" style="display: flex; align-items: center; justify-content: center; background: transparent; color: #fff; padding: 0;">
  <button type="button" class="plyr__control plyr__restart" data-plyr="restart">
    <svg role="presentation"><use xlink:href="#plyr-restart"></use></svg>
    <span class="plyr__tooltip" role="tooltip">Restart</span>
  </button>
  <button type="button" class="plyr__control" aria-label="Play, {title}" data-plyr="play">
    <svg class="icon--pressed" role="presentation"><use xlink:href="#plyr-pause"></use></svg>
    <svg class="icon--not-pressed" role="presentation"><use xlink:href="#plyr-play"></use></svg>
    <span class="label--pressed plyr__tooltip" role="tooltip">Pause</span>
    <span class="label--not-pressed plyr__tooltip" role="tooltip">Play</span>
  </button>
  <button type="button" class="plyr__control" aria-label="Mute" data-plyr="mute">
    <svg class="icon--pressed" role="presentation"><use xlink:href="#plyr-muted"></use></svg>
    <svg class="icon--not-pressed" role="presentation"><use xlink:href="#plyr-volume"></use></svg>
    <span class="label--pressed plyr__tooltip" role="tooltip">Unmute</span>
    <span class="label--not-pressed plyr__tooltip" role="tooltip">Mute</span>
  </button>
  <div class="plyr__volume">
    <input data-plyr="volume" type="range" min="0" max="1" step="0.05" value="1" autocomplete="off" aria-label="Volume">
  </div>
  <button type="button" class="plyr__control" data-plyr="captions">
    <svg class="icon--pressed" role="presentation"><use xlink:href="#plyr-captions-on"></use></svg>
    <svg class="icon--not-pressed" role="presentation"><use xlink:href="#plyr-captions-off"></use></svg>
    <span class="label--pressed plyr__tooltip" role="tooltip">Disable captions</span>
    <span class="label--not-pressed plyr__tooltip" role="tooltip">Enable captions</span>
  </button>
  <button type="button" class="plyr__control" data-plyr="fullscreen">
    <svg class="icon--pressed" role="presentation"><use xlink:href="#plyr-exit-fullscreen"></use></svg>
    <svg class="icon--not-pressed" role="presentation"><use xlink:href="#plyr-enter-fullscreen"></use></svg>
    <span class="label--pressed plyr__tooltip" role="tooltip">Exit fullscreen</span>
    <span class="label--not-pressed plyr__tooltip" role="tooltip">Enter fullscreen</span>
  </button>
</div>
`;

// Setup the player
// const player = new Plyr('#player', { controls });