#!/usr/bin/env bash

set -Eeuo pipefail
shopt -s nullglob

# Dimensão máxima. Para botão, 480 px costuma ser mais que suficiente.
MAX_WIDTH=480
MAX_HEIGHT=480

# Fundo decorativo não precisa de muitos quadros por segundo.
FPS=15

# Qualidade:
# H.264: valores maiores geram arquivos menores.
H264_CRF=30

# VP9: escala diferente do H.264.
VP9_CRF=38

OUTPUT_DIR="./optimized"

mkdir -p "$OUTPUT_DIR"

for input in ./*.mp4 ./*.mov ./*.mkv ./*.webm; do
    filename="$(basename "$input")"
    name="${filename%.*}"

    # Evita processar arquivos já gerados por este script.
    case "$name" in
        *_button|*_button_h264|*_button_vp9)
            continue
            ;;
    esac

    output_mp4="$OUTPUT_DIR/${name}_button.mp4"
    output_webm="$OUTPUT_DIR/${name}_button.webm"

    echo
    echo "Processando: $input"

    echo "  → Gerando MP4/H.264..."

    ffmpeg \
        -hide_banner \
        -loglevel warning \
        -stats \
        -y \
        -i "$input" \
        -map_metadata -1 \
        -an \
        -vf "
            fps=${FPS},
            scale=${MAX_WIDTH}:${MAX_HEIGHT}:
                force_original_aspect_ratio=decrease:
                force_divisible_by=2,
            setsar=1
        " \
        -c:v libx264 \
        -preset slow \
        -crf "$H264_CRF" \
        -profile:v high \
        -level 4.0 \
        -pix_fmt yuv420p \
        -movflags +faststart \
        -g $((FPS * 2)) \
        -keyint_min "$FPS" \
        "$output_mp4"

    echo "  → Gerando WebM/VP9..."

    ffmpeg \
        -hide_banner \
        -loglevel warning \
        -stats \
        -y \
        -i "$input" \
        -map_metadata -1 \
        -an \
        -vf "
            fps=${FPS},
            scale=${MAX_WIDTH}:${MAX_HEIGHT}:
                force_original_aspect_ratio=decrease:
                force_divisible_by=2,
            setsar=1
        " \
        -c:v libvpx-vp9 \
        -b:v 0 \
        -crf "$VP9_CRF" \
        -deadline good \
        -cpu-used 2 \
        -row-mt 1 \
        -pix_fmt yuv420p \
        -g $((FPS * 2)) \
        "$output_webm"

    echo "  MP4:  $(du -h "$output_mp4" | cut -f1)"
    echo "  WebM: $(du -h "$output_webm" | cut -f1)"
done

echo
echo "Conversão concluída."
echo "Arquivos salvos em: $OUTPUT_DIR"
