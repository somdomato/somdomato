import { recoverMissingCovers } from "@/lib/cover";

async function main() {
  console.log("Iniciando recuperação de capas...");

  const { checked, recovered, stillMissing } = await recoverMissingCovers();

  console.log("\nResumo da recuperação de capas:");
  console.log(`- Verificadas: ${checked}`);
  console.log(`- Recuperadas: ${recovered}`);
  console.log(`- Sem capa disponível: ${stillMissing}`);
}

main().catch((err) => {
  console.error("Erro na recuperação de capas:", err);
  process.exit(1);
});
