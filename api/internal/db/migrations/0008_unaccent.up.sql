-- Busca de /pedidos deve ignorar acentos ("voce" deve encontrar "você").
-- unaccent é uma extensão padrão do Postgres (contrib), sem custo extra.
CREATE EXTENSION IF NOT EXISTS unaccent;
