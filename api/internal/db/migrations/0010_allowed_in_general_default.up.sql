-- "Permitir no Geral" passa a vir marcado por padrão: toda música nova
-- (seed, envios aprovados) entra também no sorteio do Geral, e o admin
-- desmarca quando quiser restringi-la ao próprio gênero.
--
-- O backfill liga a flag em todo o catálogo existente: até aqui a coluna
-- nascia false sem ninguém ter escolhido isso (nenhum INSERT a preenchia).
ALTER TABLE songs ALTER COLUMN allowed_in_general SET DEFAULT true;
UPDATE songs SET allowed_in_general = true WHERE allowed_in_general = false;
