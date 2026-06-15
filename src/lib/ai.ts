/**
 * AI-based evaluation for auto-approving uploads.
 * Uses Groq API (free tier) with Llama model when GROQ_API_KEY is set.
 * Falls back to heuristic evaluation otherwise.
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// ---------------------------------------------------------------------------
// Simple sequential queue – ensures only one evaluation runs at a time so we
// don't burst the free-tier API rate limits.
// ---------------------------------------------------------------------------

let _queueTail: Promise<unknown> = Promise.resolve();

/**
 * Enqueue a function so it only runs after all previously enqueued work has
 * finished (success or failure).
 */
export function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const task = _queueTail.catch(() => {}).then(() => fn());
  _queueTail = task;
  return task;
}

interface AIEvaluation {
  approved: boolean;
  confidence: number; // 0-100
  reason: string;
  suggestedGenre: string;
  suggestedRotation: string;
}

interface TrackInfo {
  title: string;
  artist: string;
  deezerGenre: string;
  duration: number; // seconds
  albumName?: string;
}

/**
 * Evaluate a track using AI (Groq) or heuristic fallback.
 */
export async function evaluateTrack(track: TrackInfo): Promise<AIEvaluation> {
  if (GROQ_API_KEY) {
    try {
      return await evaluateWithGroq(track);
    } catch (err) {
      console.error("[ai] Erro ao avaliar com Groq, usando heurística:", err);
      return evaluateWithHeuristic(track);
    }
  }
  return evaluateWithHeuristic(track);
}

async function evaluateWithGroq(track: TrackInfo): Promise<AIEvaluation> {
  const prompt = `Você é um curador de música para a Rádio Som do Mato, uma rádio brasileira especializada em música sertaneja e gêneros relacionados.

Avalie se esta música deve ser aprovada para tocar na rádio. A rádio aceita:
- Sertanejo (universitário, raiz, romântico)
- Música gaúcha
- Modão, moda de viola
- Arrocha
- Sertanejo romântico

NÃO aceita:
- Funk, trap, rap
- Rock/metal internacional
- Eletrônica/EDM
- Pop internacional
- Músicas com mais de 8 minutos

Dados da música:
- Título: ${track.title}
- Artista: ${track.artist}
- Gênero (Deezer): ${track.deezerGenre}
- Duração: ${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}
${track.albumName ? `- Álbum: ${track.albumName}` : ""}

Responda APENAS com JSON válido no formato:
{
  "approved": true/false,
  "confidence": 0-100,
  "reason": "explicação curta em português",
  "suggestedGenre": "geral|gaucha|modao|arrocha|romantico",
  "suggestedRotation": "ultraleve|leve|normal|pesado|ultrapesada"
}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq API error: ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from Groq");
  }

  const parsed = JSON.parse(content);

  // Validate and sanitize response
  const validGenres = ["geral", "gaucha", "modao", "arrocha", "romantico"];
  const validRotations = [
    "ultraleve",
    "leve",
    "normal",
    "pesado",
    "ultrapesada",
  ];

  return {
    approved: Boolean(parsed.approved),
    confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)),
    reason: String(parsed.reason || "Sem justificativa"),
    suggestedGenre: validGenres.includes(parsed.suggestedGenre)
      ? parsed.suggestedGenre
      : "geral",
    suggestedRotation: validRotations.includes(parsed.suggestedRotation)
      ? parsed.suggestedRotation
      : "normal",
  };
}

/** Sertanejo-related genre patterns */
const SERTANEJO_PATTERNS = [
  "sertanejo",
  "sertaneja",
  "sertanejo universitário",
  "sertanejo universitario",
  "country",
  "brazilian",
];

const ARROCHA_PATTERNS = ["arrocha", "swingueira", "pagode baiano"];

function evaluateWithHeuristic(track: TrackInfo): AIEvaluation {
  const genre = track.deezerGenre.toLowerCase();
  const maxDuration = 8 * 60;

  if (track.duration > maxDuration) {
    return {
      approved: false,
      confidence: 90,
      reason: `Duração excede 8 minutos (${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")})`,
      suggestedGenre: "geral",
      suggestedRotation: "normal",
    };
  }

  const isSertanejo = SERTANEJO_PATTERNS.some((p) => genre.includes(p));
  const isArrocha = ARROCHA_PATTERNS.some((p) => genre.includes(p));

  if (isSertanejo) {
    return {
      approved: true,
      confidence: 85,
      reason: `Gênero "${track.deezerGenre}" é compatível com a rádio (sertanejo)`,
      suggestedGenre: "geral",
      suggestedRotation: "normal",
    };
  }

  if (isArrocha) {
    return {
      approved: true,
      confidence: 80,
      reason: `Gênero "${track.deezerGenre}" é compatível com a rádio (arrocha)`,
      suggestedGenre: "arrocha",
      suggestedRotation: "normal",
    };
  }

  return {
    approved: false,
    confidence: 60,
    reason: `Gênero "${track.deezerGenre}" não é compatível com o perfil da rádio`,
    suggestedGenre: "geral",
    suggestedRotation: "normal",
  };
}
