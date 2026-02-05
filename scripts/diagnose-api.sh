#!/usr/bin/env bash

# Script de diagnóstico da API /api/music
# Verifica por que a API não está retornando músicas

echo "========================================"
echo "Diagnóstico da API /api/music"
echo "========================================"
echo

PROJECT_DIR="/var/www/somdomato"
cd "$PROJECT_DIR" || exit 1

echo "📦 1. Verificando banco de dados..."
echo "---"

if [ -f "drizzle/somdomato.db" ]; then
    echo "✅ Banco de dados existe: drizzle/somdomato.db"
    
    # Verificar se tem músicas
    TOTAL_SONGS=$(sqlite3 drizzle/somdomato.db "SELECT COUNT(*) FROM songs;")
    echo "   Total de músicas: $TOTAL_SONGS"
    
    if [ "$TOTAL_SONGS" -eq 0 ]; then
        echo "❌ PROBLEMA: Banco de dados está vazio!"
        echo "   Solução: Execute 'pnpm tsx scripts/sync-music.ts'"
        exit 1
    fi
    
    # Verificar músicas por gênero
    echo
    echo "   Músicas por gênero:"
    sqlite3 drizzle/somdomato.db "SELECT genre, COUNT(*) FROM songs GROUP BY genre;" | while IFS='|' read -r genre count; do
        echo "     - $genre: $count"
    done
    
    # Verificar músicas com allowedInGeneral
    ALLOWED_IN_GENERAL=$(sqlite3 drizzle/somdomato.db "SELECT COUNT(*) FROM songs WHERE allowedInGeneral = 1;")
    echo "     - allowedInGeneral=1: $ALLOWED_IN_GENERAL"
    
else
    echo "❌ Banco de dados NÃO existe!"
    echo "   Esperado: drizzle/somdomato.db"
    exit 1
fi

echo
echo "🎵 2. Verificando diretório de músicas..."
echo "---"

if [ -d "/var/music/sdm" ]; then
    echo "✅ Diretório existe: /var/music/sdm"
    
    MUSIC_FILES=$(find /var/music/sdm -type f -name "*.mp3" 2>/dev/null | wc -l)
    echo "   Arquivos MP3 encontrados: $MUSIC_FILES"
    
    if [ "$MUSIC_FILES" -eq 0 ]; then
        echo "❌ PROBLEMA: Nenhum arquivo MP3 encontrado!"
        exit 1
    fi
    
    # Verificar permissões
    echo "   Permissões do diretório:"
    ls -ld /var/music/sdm
    
else
    echo "❌ Diretório de músicas NÃO existe: /var/music/sdm"
    exit 1
fi

echo
echo "🔍 3. Testando API para cada gênero..."
echo "---"

GENRES=("geral" "gaucha" "modao" "arrocha" "romantico" "forro")

for genre in "${GENRES[@]}"; do
    echo "   Testando gênero: $genre"
    
    RESPONSE=$(curl -s "http://localhost:3000/api/music?genre=$genre")
    
    # Verificar se retornou null
    if echo "$RESPONSE" | jq -e '.music == null' > /dev/null 2>&1; then
        echo "     ❌ Retornou NULL"
        
        # Extrair mensagem de erro se houver
        ERROR_MSG=$(echo "$RESPONSE" | jq -r '.notification.message // "Sem mensagem"' 2>/dev/null)
        echo "     Mensagem: $ERROR_MSG"
    else
        TITLE=$(echo "$RESPONSE" | jq -r '.title // "N/A"')
        ARTIST=$(echo "$RESPONSE" | jq -r '.artist // "N/A"')
        echo "     ✅ OK: $TITLE - $ARTIST"
    fi
    echo
done

echo
echo "⏰ 4. Verificando horário atual..."
echo "---"

CURRENT_HOUR=$(date +%H)
echo "   Hora atual: ${CURRENT_HOUR}h"

if [ "$CURRENT_HOUR" -ge 0 ] && [ "$CURRENT_HOUR" -lt 6 ]; then
    TIMESLOT="Madrugada (bit 1)"
elif [ "$CURRENT_HOUR" -ge 6 ] && [ "$CURRENT_HOUR" -lt 12 ]; then
    TIMESLOT="Manhã (bit 2)"
elif [ "$CURRENT_HOUR" -ge 12 ] && [ "$CURRENT_HOUR" -lt 18 ]; then
    TIMESLOT="Tarde (bit 4)"
else
    TIMESLOT="Noite (bit 8)"
fi

echo "   Time slot: $TIMESLOT"
echo

# Verificar quantas músicas estão disponíveis neste horário
echo "   Músicas disponíveis neste horário por gênero:"
sqlite3 drizzle/somdomato.db << EOF | while IFS='|' read -r genre count; do
    echo "     - $genre: $count"
done
SELECT 
    CASE 
        WHEN genre = 'geral' THEN 'geral + allowedInGeneral'
        ELSE genre
    END as genre_group,
    COUNT(*) as count
FROM songs
WHERE (
    CASE 
        WHEN $CURRENT_HOUR >= 0 AND $CURRENT_HOUR < 6 THEN (timeSlots & 1) > 0
        WHEN $CURRENT_HOUR >= 6 AND $CURRENT_HOUR < 12 THEN (timeSlots & 2) > 0
        WHEN $CURRENT_HOUR >= 12 AND $CURRENT_HOUR < 18 THEN (timeSlots & 4) > 0
        ELSE (timeSlots & 8) > 0
    END
)
AND (
    CASE 
        WHEN genre = 'geral' THEN 1
        ELSE genre != 'geral'
    END
)
GROUP BY genre_group
UNION
SELECT 
    'allowedInGeneral (não-geral)',
    COUNT(*) as count
FROM songs
WHERE allowedInGeneral = 1
AND genre != 'geral'
AND (
    CASE 
        WHEN $CURRENT_HOUR >= 0 AND $CURRENT_HOUR < 6 THEN (timeSlots & 1) > 0
        WHEN $CURRENT_HOUR >= 6 AND $CURRENT_HOUR < 12 THEN (timeSlots & 2) > 0
        WHEN $CURRENT_HOUR >= 12 AND $CURRENT_HOUR < 18 THEN (timeSlots & 4) > 0
        ELSE (timeSlots & 8) > 0
    END
);
EOF

echo
echo "🚫 5. Verificando proteções/bloqueios..."
echo "---"

# Últimas 10 músicas do histórico
echo "   Últimas 10 músicas tocadas:"
sqlite3 drizzle/somdomato.db "
    SELECT s.title, s.artist, datetime(h.createdAt, 'localtime') 
    FROM history h 
    JOIN songs s ON h.songId = s.id 
    ORDER BY h.id DESC 
    LIMIT 10;
" | while IFS='|' read -r title artist dt; do
    echo "     - $title by $artist ($dt)"
done

echo
echo "🎯 6. Verificando arquivos físicos..."
echo "---"

# Pegar uma amostra de 5 músicas do banco e verificar se existem
echo "   Verificando se arquivos do banco existem no disco:"
sqlite3 drizzle/somdomato.db "SELECT path FROM songs LIMIT 5;" | while read -r filepath; do
    if [ -f "$filepath" ]; then
        echo "     ✅ $filepath"
    else
        echo "     ❌ FALTANDO: $filepath"
    fi
done

echo
echo "========================================"
echo "Diagnóstico concluído"
echo "========================================"
