-- Momento em que a linha virou "pending" (entregue ao Liquidsoap via
-- /internal/music). Ordena as pending pela ordem real de entrega, para que o
-- flush de órfãs não descarte a faixa que acabou de ser servida e cujo
-- on_track ainda está a caminho (corrida com o prefetch da próxima).
ALTER TABLE queue_entries ADD COLUMN served_at TIMESTAMPTZ;
