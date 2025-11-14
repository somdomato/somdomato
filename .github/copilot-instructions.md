# Som do Mato - AI Coding Instructions

## Project Overview
Brazilian country radio web app ("rádio sertaneja") with real-time song requests, automatic playback scheduling, and anti-repetition rules. Built with Next.js 16 (App Router), custom Bun server for Socket.IO integration, Drizzle ORM with SQLite, and Biome for linting/formatting.

## Critical Architecture Patterns

### Custom Server Architecture
- **Server:** `src/server.ts` runs a custom Bun HTTP server wrapping Next.js to enable Socket.IO
- **Global IO:** Socket.IO server instance attached to `global.io` (typed in `src/types/global.d.ts`)
- **Real-time Events:** Emit `song:changed`, `request:added`, `request:removed`, `history:added` from API routes
- Use `global.io?.emit()` with optional chaining since it's only available server-side

### Time Slot System (Bitwise Flags)
Songs use bitwise flags for scheduling (`src/lib/time.ts`):
```typescript
timeSlots: 15 // 1111 in binary = all time slots enabled
// 1=madrugada(0-6h), 2=manhã(6-12h), 4=tarde(12-18h), 8=noite(18-24h)
```
- Filter songs with: `sql\`(${songs.timeSlots} & ${currentTimeSlot}) > 0\``
- Check availability: `canPlayAtCurrentTime(song.timeSlots)`
- Never use string comparisons for time slots

### Anti-Repetition Protection (`src/lib/protections.ts`)
Three-tier blocking system prevents repetition:
1. **Song History:** Block if in last 100 played songs
2. **Request Queue:** Block if already in pending requests
3. **Artist Recency:** Block if artist in last 10 history entries OR in pending requests

Always use `checkMusicRepetition(songId)` before accepting requests. Returns structured `RepetitionCheckResult` with specific reason codes.

### Music Selection Algorithm (`src/app/api/music/route.ts`)
1. Get blocked song IDs and artists via `getBlockedSongIds()`
2. Query songs matching current time slot, excluding blocked IDs
3. Filter out blocked artists from results
4. Prioritize pending request (FIFO), else random selection
5. Verify file exists with `fs.access()`, delete DB entry if missing
6. Insert to `history` table and emit Socket.IO events

### Parallel Routes & Modals
- **Route:** `@requests` slot in `layout.tsx` enables modal behavior
- **Intercepting:** `@requests/(.)pedidos/page.tsx` intercepts `/pedidos` for modal display
- **Fallback:** `@requests/default.tsx` returns null when modal closed
- Pattern allows `/pedidos` to work as standalone page OR modal depending on navigation

### Database Schema Patterns
- **Relations:** Use Drizzle's `relations()` for joins (see `src/db/schema.ts`)
- **Timestamps:** Use `int({ mode: 'timestamp' }).$defaultFn(() => new Date())`
- **Covers:** Stored as path strings in `songs.cover`, managed by `src/lib/cover.ts`
- **Joins:** Prefer `.leftJoin()` when related data might be missing

## Development Workflows

### Running the App
```bash
bun dev              # Development server (port 3000)
bun start            # Production (port 3333, requires NODE_ENV=production)
bun run build        # Next.js production build
```

### Database Management
```bash
bun run push         # Push schema to DB (drizzle-kit push)
bun run seed         # Seed database from music files
bun run studio       # Open Drizzle Studio (DB GUI)
```

### Code Quality
```bash
bun run lint         # Biome check (max 100 diagnostics)
bun run format       # Biome auto-format
```

### Deployment
```bash
scripts/deploy.sh    # Production deployment to /var/www/somdomato
                     # Creates temp copy, builds, swaps atomically
                     # Symlinks /var/music/sdm to public/music
```

## Project-Specific Conventions

### File Organization
- **Actions:** Server actions in `src/actions/` (use `"use server"`)
- **API Routes:** REST endpoints in `src/app/api/` subdirectories
- **Libs:** Pure functions in `src/lib/` (no React hooks)
- **Types:** Shared types in `src/types/`, extend globals in `global.d.ts`

### Import Paths
Always use `@/*` alias for imports (configured in `tsconfig.json`):
```typescript
import { db } from "@/db";
import { useAudio } from "@/context/AudioContext";
```

### Biome Configuration
- **Indent:** 2 spaces
- **Disabled Rules:** `noNonNullAssertion`, `useButtonType`, `useIframeTitle`
- **Domains:** Next.js and React recommended rules enabled
- Format before committing; CI checks with `--max-diagnostics 100`

### Environment Variables
Required in `.env`:
- `DB_FILE_NAME`: SQLite database path
- `YTDLP_PATH`: yt-dlp binary location (for YouTube downloads)
- `FFMPEG_PATH`: FFmpeg binary location

### Cover Image Resolution
`src/lib/cover.ts` implements intelligent artist name matching:
- Normalizes names (removes accents, unifies separators like "&", "e", "+")
- Searches `public/covers/{artist}/` directories
- Falls back to `/images/logotipo.svg` if no match

## Integration Points

### Socket.IO Client Setup
```typescript
import { io } from "socket.io-client";
const socket = io(); // Connects to same origin
socket.on("song:changed", (song) => { /* ... */ });
```

### YouTube Download API
POST to `/api/youtube` with `{ url: string }` to download and convert to MP3. Saves to `public/music/` with timestamp-based naming.

### Admin API Security
- Admin endpoints under `/api/admin/*` require an admin token set in `ADMIN_TOKEN` environment variable in production and the `x-admin-token` header on requests.
- For local development, if `ADMIN_TOKEN` is not set, the app will allow admin requests to be executed (convenience). To use admin endpoints from the browser admin UI, set the token (or a dummy token in dev) in the Admin panel using the token input.

Usage examples:
- Use the `Admin` page to set an admin token that will be stored in localStorage and automatically used with `x-admin-token` on requests made from the admin UI.
- cURL/example:
```bash
curl -X POST -H "Content-Type: application/json" -H "x-admin-token: $ADMIN_TOKEN" -d '{"id":1, "newFileName":"file.mp3"}' http://localhost:3000/api/admin/rename
```

### Audio Player Context
`AudioContext.tsx` manages global audio state. Access via `useAudio()` hook:
```typescript
const { playing, play, pause, volume, setVolume, muted, toggleMute } = useAudio();
```
Automatically appends cache-busting timestamp to stream URL.

## Common Pitfalls

1. **Don't filter time slots with string operations** - always use bitwise operators
2. **Don't forget `global.io` null check** - use optional chaining in API routes
3. **Don't skip `checkMusicRepetition()`** - prevents UX issues with duplicates
6. **Admin endpoints require `x-admin-token` header** - use the admin input in `/admin` to set a token for `rename` and `id3` APIs.
4. **Don't modify `next.config.ts`** - custom server handles everything
5. **Don't use `npm`** - project standardized on Bun for all package management

## Key Files Reference
- `src/server.ts` - Custom server setup
- `src/lib/protections.ts` - Anti-repetition logic
- `src/lib/time.ts` - Time slot bitwise operations
- `src/app/api/music/route.ts` - Core music selection algorithm
- `src/db/schema.ts` - Database schema with relations
 - `src/app/api/admin/*` - Admin-only endpoints (rename, id3) and require `x-admin-token` when `ADMIN_TOKEN` is set
