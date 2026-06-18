/**
 * Constantes puras de capa — sem dependências de `node:fs`/`process.cwd()`,
 * para que possam ser importadas tanto por código de servidor quanto por
 * componentes cliente (ex: `CoverImage.tsx`).
 */

export const DEFAULT_COVER = "/images/logotipo.svg";
