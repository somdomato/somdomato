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

# Calcular o bit do time slot
if [ "$CURRENT_HOUR" -ge 0 ] && [ "$CURRENT_HOUR" -lt 6 ]; then
    TIMEBIT=1
elif [ "$CURRENT_HOUR" -ge 6 ] && [ "$CURRENT_HOUR" -lt 12 ]; then
    TIMEBIT=2
elif [ "$CURRENT_HOUR" -ge 12 ] && [ "$CURRENT_HOUR" -lt 18 ]; then
    TIMEBIT=4
else
    TIMEBIT=8
fi

# Consulta simplificada
sqlite3 drizzle/somdomato.db "
SELECT genre, COUNT(*) 
FROM songs 
WHERE (timeSlots & $TIMEBIT) > 0 
GROUP BY genre;
" | while IFS='|' read -r genre count; do
    echo "     - $genre: $count"
done

# Verificar se há músicas SEM time slot configurado
NO_TIMESLOT=$(sqlite3 drizzle/somdomato.db "SELECT COUNT(*) FROM songs WHERE timeSlots = 0 OR timeSlots IS NULL;")
if [ "$NO_TIMESLOT" -gt 0 ]; then
    echo "     ⚠️  Músicas sem time slot: $NO_TIMESLOT (nunca tocarão!)"
fi

echo
echo "🚫 5. Verificando proteções/bloqueios..."
echo "---"

# Verificar quantas músicas estão no histórico (bloqueadas por cooldown)
HISTORY_COUNT=$(sqlite3 drizzle/somdomato.db "SELECT COUNT(DISTINCT songId) FROM (SELECT songId FROM history ORDER BY id DESC LIMIT 100);")
echo "   Músicas bloqueadas por histórico (últimas 100): $HISTORY_COUNT"

# Verificar artistas bloqueados (últimas 10 músicas)
echo "   Artistas das últimas 10 músicas (bloqueados):"
sqlite3 drizzle/somdomato.db "
    SELECT DISTINCT s.artist
    FROM history h 
    JOIN songs s ON h.songId = s.id 
    ORDER BY h.id DESC 
    LIMIT 10;
" | while read -r artist; do
    echo "     - $artist"
done

echo
echo "   Últimas 5 músicas tocadas:"
MISSING=0
FOUND=0
sqlite3 drizzle/somdomato.db "SELECT path FROM songs LIMIT 10;" | while read -r filepath; do
    if [ -f "$filepath" ]; then
        echo "     ✅ Existe: $(basename "$filepath")"
        FOUND=$((FOUND + 1))
    else
        echo "     ❌ FALTANDO: $filepath"
        MISSING=$((MISSING + 1))
    fi
done

echo
echo "📊 7. Resumo do Problema..."
echo "---"

# Descobrir a causa raiz
if [ "$TOTAL_SONGS" -eq 0 ]; then
    echo "❌ CAUSA: Banco de dados vazio"
    echo "   SOLUÇÃO: Execute 'pnpm tsx scripts/sync-music.ts'"
elif [ "$NO_TIMESLOT" -eq "$TOTAL_SONGS" ]; then
    echo "❌ CAUSA: Nenhuma música tem horário configurado (timeSlots = 0)"
    echo "   SOLUÇÃO: Execute 'pnpm tsx scripts/sync-music.ts' para reconfigura
r"
else
    echo "⚠️  Investigação necessária:"
    echo "   - Total de músicas: $TOTAL_SONGS"
    echo "   - Músicas sem time slot: $NO_TIMESLOT"
    echo "   - Todas no gênero 'geral'"
    echo "   - Outros gêneros vazios (gaucha, modao, etc.)"
    echo
    echo "   Possíveis causas:"
    echo "   1. Script sync-music.ts não classificou gêneros corretamente"
    echo "   2. Tags ID3 dos MP3 não têm gênero definido"
    echo "   3. Músicas bloqueadas por time slot (não disponíveis agora)"
    echo
    echo "   PRÓXIMO PASSO: Execute 'pnpm tsx scripts/sync-music.ts' para ressincronizar"
fiwhile IFS='|' read -r title artist dt; do
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
