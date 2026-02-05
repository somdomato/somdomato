#!/usr/bin/env bash

# Script para simular a lógica da API e ver quantas músicas sobram após filtros

cd /var/www/somdomato 2>/dev/null || cd ~/code/somdomato

echo "========================================="
echo "Simulação da Lógica de Seleção da API"
echo "========================================="
echo

# Horário atual
CURRENT_HOUR=$(date +%H)

if [ "$CURRENT_HOUR" -ge 0 ] && [ "$CURRENT_HOUR" -lt 6 ]; then
    TIMEBIT=1
    TIMENAME="Madrugada"
elif [ "$CURRENT_HOUR" -ge 6 ] && [ "$CURRENT_HOUR" -lt 12 ]; then
    TIMEBIT=2
    TIMENAME="Manhã"
elif [ "$CURRENT_HOUR" -ge 12 ] && [ "$CURRENT_HOUR" -lt 18 ]; then
    TIMEBIT=4
    TIMENAME="Tarde"
else
    TIMEBIT=8
    TIMENAME="Noite"
fi

echo "⏰ Horário: ${CURRENT_HOUR}h ($TIMENAME, bit $TIMEBIT)"
echo

# Total de músicas
TOTAL=$(sqlite3 drizzle/somdomato.db "SELECT COUNT(*) FROM songs;")
echo "📊 Total de músicas no banco: $TOTAL"

# Músicas disponíveis neste horário
AVAILABLE=$(sqlite3 drizzle/somdomato.db "SELECT COUNT(*) FROM songs WHERE (timeSlots & $TIMEBIT) > 0 AND genre = 'geral';")
echo "⏰ Disponíveis neste horário (geral): $AVAILABLE"

# Músicas bloqueadas no histórico (últimas 100)
BLOCKED_HISTORY=$(sqlite3 drizzle/somdomato.db "SELECT COUNT(DISTINCT songId) FROM (SELECT songId FROM history ORDER BY id DESC LIMIT 100);")
echo "🚫 Bloqueadas por histórico (100 últimas): $BLOCKED_HISTORY"

# Artistas bloqueados (últimas 10 músicas)
echo
echo "🎤 Artistas bloqueados (últimas 10 músicas):"
sqlite3 drizzle/somdomato.db "
    SELECT DISTINCT s.artist
    FROM history h 
    JOIN songs s ON h.songId = s.id 
    ORDER BY h.id DESC 
    LIMIT 10;
" | while read -r artist; do
    echo "   - $artist"
done

# Contar músicas de cada artista bloqueado
echo
echo "📊 Músicas por artista bloqueado:"
sqlite3 drizzle/somdomato.db "
    SELECT s.artist, COUNT(*) as count
    FROM songs s
    WHERE s.artist IN (
        SELECT DISTINCT s2.artist
        FROM history h 
        JOIN songs s2 ON h.songId = s2.id 
        ORDER BY h.id DESC 
        LIMIT 10
    )
    AND (s.timeSlots & $TIMEBIT) > 0
    GROUP BY s.artist
    ORDER BY count DESC;
" | while IFS='|' read -r artist count; do
    echo "   - $artist: $count músicas"
done

# Calcular músicas disponíveis APÓS filtros
echo
echo "🔍 Calculando músicas disponíveis após TODOS os filtros..."
echo

# Músicas disponíveis neste horário E gênero geral
STEP1=$(sqlite3 drizzle/somdomato.db "
    SELECT COUNT(*) 
    FROM songs 
    WHERE (timeSlots & $TIMEBIT) > 0 
    AND genre = 'geral';
")
echo "   1️⃣ Após filtro de horário + gênero: $STEP1"

# Menos as bloqueadas no histórico
STEP2=$(sqlite3 drizzle/somdomato.db "
    SELECT COUNT(*) 
    FROM songs 
    WHERE (timeSlots & $TIMEBIT) > 0 
    AND genre = 'geral'
    AND id NOT IN (
        SELECT songId FROM history ORDER BY id DESC LIMIT 100
    );
")
echo "   2️⃣ Após remover histórico (100): $STEP2"

# Menos as de artistas bloqueados
STEP3=$(sqlite3 drizzle/somdomato.db "
    SELECT COUNT(*) 
    FROM songs 
    WHERE (timeSlots & $TIMEBIT) > 0 
    AND genre = 'geral'
    AND id NOT IN (
        SELECT songId FROM history ORDER BY id DESC LIMIT 100
    )
    AND artist NOT IN (
        SELECT DISTINCT s.artist
        FROM history h 
        JOIN songs s ON h.songId = s.id 
        ORDER BY h.id DESC 
        LIMIT 10
    );
")
echo "   3️⃣ Após remover artistas bloqueados (10): $STEP3"

echo
echo "========================================="
if [ "$STEP3" -eq 0 ]; then
    echo "❌ PROBLEMA CONFIRMADO!"
    echo
    echo "Não há músicas disponíveis após aplicar todos os filtros:"
    echo "  - Horário atual ($TIMENAME)"
    echo "  - Gênero 'geral'"
    echo "  - Cooldown de 100 músicas"
    echo "  - Cooldown de 10 artistas"
    echo
    echo "💡 SOLUÇÕES:"
    echo
    echo "1. Reduzir cooldown no src/config.ts:"
    echo "   export const LAST_SONGS_HISTORY_LIMIT = 50; // ao invés de 100"
    echo
    echo "2. Adicionar mais músicas de artistas diferentes"
    echo
    echo "3. Classificar músicas em outros gêneros:"
    echo "   pnpm tsx scripts/sync-music.ts"
else
    echo "✅ Músicas disponíveis: $STEP3"
    echo
    echo "Listando algumas disponíveis:"
    sqlite3 drizzle/somdomato.db "
        SELECT title, artist
        FROM songs 
        WHERE (timeSlots & $TIMEBIT) > 0 
        AND genre = 'geral'
        AND id NOT IN (
            SELECT songId FROM history ORDER BY id DESC LIMIT 100
        )
        AND artist NOT IN (
            SELECT DISTINCT s.artist
            FROM history h 
            JOIN songs s ON h.songId = s.id 
            ORDER BY h.id DESC 
            LIMIT 10
        )
        LIMIT 5;
    " | while IFS='|' read -r title artist; do
        echo "  - $title by $artist"
    done
fi
echo "========================================="
