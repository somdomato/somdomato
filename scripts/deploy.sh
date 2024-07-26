#!/bin/bash

PATH=$PATH:/home/nginx/.bun/bin
RESET=1
PLAYBOOK="nginx"

cd backend

[ ! -L uploads ] && ln -s /media/songs/uploads uploads
[ ! -d /media/songs/uploads ] && mkdir -p /media/songs/uploads

if [ $RESET == 1 ]; then
  sudo /usr/bin/systemctl stop somdomato-hono.service
  rm -fr sqlite.db src/drizzle/migrations/
  cp .env.prod .env
else
  [ ! -f .env ] && cp .env.prod .env
fi

bun install
bun run generate
bun run migrate
bun run seed

cd ../frontend

if [ $RESET == 1 ]; then
  cp .env.prod .env
else
  [ ! -f .env ] && cp .env.prod .env
fi

bun install
bun run build

if [ $RESET == 1 ]; then
  sudo /usr/bin/systemctl start somdomato-hono.service
else
  sudo /usr/bin/systemctl restart somdomato-hono.service
fi