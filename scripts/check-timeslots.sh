#!/usr/bin/env bash

# Script rápido para verificar timeSlots das músicas

cd /var/www/somdomato 2>/dev/null || cd ~/code/somdomato

echo "Verificando distribuição de timeSlots..."
echo

sqlite3 drizzle/somdomato.db << 'EOF'
.mode column
.headers on

SELECT 
    timeSlots,
    COUNT(*) as count,
    CASE 
        WHEN timeSlots = 0 THEN '❌ NUNCA (bloqueado)'
        WHEN timeSlots = 15 THEN '✅ SEMPRE (24h)'
        WHEN timeSlots & 1 THEN '🌙 Inclui madrugada'
        WHEN timeSlots & 2 THEN '🌅 Inclui manhã'
        WHEN timeSlots & 4 THEN '☀️  Inclui tarde'
        WHEN timeSlots & 8 THEN '🌃 Inclui noite'
        ELSE '⚠️  Horário específico'
    END as horario
FROM songs
GROUP BY timeSlots
ORDER BY count DESC;
EOF

echo
echo "Explicação:"
echo "  timeSlots = 0  -> Nunca toca (bloqueado)"
echo "  timeSlots = 15 -> Toca 24h (todos os horários)"
echo "  timeSlots = 1  -> Só madrugada (0h-6h)"
echo "  timeSlots = 2  -> Só manhã (6h-12h)"
echo "  timeSlots = 4  -> Só tarde (12h-18h)"
echo "  timeSlots = 8  -> Só noite (18h-24h)"
