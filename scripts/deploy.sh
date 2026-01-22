#!/usr/bin/env bash

PATH=$PATH:/home/nginx/.local/share/pnpm

NAME=somdomato
SERVICE=$NAME.service
TEMP_DIR=/tmp/$NAME
PROJECT_DIR=/var/www/$NAME

[ -d "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
cp -a "$PROJECT_DIR" "$TEMP_DIR"
cd "$TEMP_DIR" || exit 1

git clean -fxd -e .env
cp .env .env.production 

pnpm install
pnpm run push
pnpm run build || exit 1

sudo /usr/bin/systemctl stop $SERVICE
pnpm run seed
rm -rf "$PROJECT_DIR"
mv "$TEMP_DIR" "$PROJECT_DIR"
ln -sf /var/music/sdm "$PROJECT_DIR/public/music"
sudo /usr/bin/systemctl start $SERVICE

sudo /usr/bin/systemctl restart somdomato-icecast.service somdomato-liquidsoap.service