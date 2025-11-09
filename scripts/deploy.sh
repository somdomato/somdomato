#!/usr/bin/env bash

PATH=$PATH:/home/nginx/.bun/bin

NAME=somdomato
SERVICE=$NAME.service
TEMP_DIR=/tmp/$NAME
PROJECT_DIR=/var/www/$NAME

[ -d "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
cp -a "$PROJECT_DIR" "$TEMP_DIR"
cd "$TEMP_DIR" || exit 1

git clean -fxd -e .env.production -e cookies.txt
cp -f .env.production .env

bun install
bun run push
bun run seed
bun run build || exit 1

sudo /usr/bin/systemctl stop $SERVICE
rm -rf "$PROJECT_DIR"
mv "$TEMP_DIR" "$PROJECT_DIR"
ln -sf /var/music/sdm "$PROJECT_DIR/public/music"
sudo /usr/bin/systemctl start $SERVICE