type SongMetaLike = {
  title?: string | null;
  artist?: string | null;
};

function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const JINGLE_PATTERN = /\b(vinheta|vinhetas|jingle|jingles)\b/;

export function isJingleMetadata(song: SongMetaLike): boolean {
  const title = normalizeText(song.title);
  const artist = normalizeText(song.artist);
  return JINGLE_PATTERN.test(title) || JINGLE_PATTERN.test(artist);
}
