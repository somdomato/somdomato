import { readdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Migra capas do formato legado `public/covers/<artista_com_underscore>/cover.*`
 * para o formato atual `public/covers/<slug-com-hifen>.jpg`.
 *
 * Não remove os diretórios legados — apenas copia o arquivo para o novo local
 * se ele ainda não existir.
 */
async function main() {
  const coversDir = path.join(process.cwd(), "public/covers");
  const entries = await readdir(coversDir, { withFileTypes: true });
  const legacyDirs = entries.filter((e) => e.isDirectory());

  let migrated = 0;
  let alreadyExists = 0;
  let noCoverFile = 0;

  for (const dir of legacyDirs) {
    const dirPath = path.join(coversDir, dir.name);
    const files = await readdir(dirPath);
    const coverFile = files.find((f) => /^cover\.(jpe?g|png)$/i.test(f));

    if (!coverFile) {
      console.log(`  → ${dir.name}: nenhum arquivo de capa encontrado`);
      noCoverFile++;
      continue;
    }

    const slug = dir.name.replace(/_/g, "-");
    const targetPath = path.join(coversDir, `${slug}.jpg`);

    if (existsSync(targetPath)) {
      console.log(`  → ${dir.name}: ${slug}.jpg já existe, pulando`);
      alreadyExists++;
      continue;
    }

    await copyFile(path.join(dirPath, coverFile), targetPath);
    console.log(`  ✓ ${dir.name}/${coverFile} → ${slug}.jpg`);
    migrated++;
  }

  console.log("\nResumo da migração:");
  console.log(`- Migradas: ${migrated}`);
  console.log(`- Já existiam: ${alreadyExists}`);
  console.log(`- Sem arquivo de capa: ${noCoverFile}`);
}

main().catch((err) => {
  console.error("Erro na migração de capas legadas:", err);
  process.exit(1);
});
