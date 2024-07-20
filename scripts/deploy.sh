#!/bin/bash

PATH=$PATH:/home/nginx/.bun/bin
RESET=1

cd backend

if [ $RESET == 1 ]; then
  rm -fr sqlite.db src/drizzle/migrations/
  sudo /usr/bin/systemctl stop somdomato-hono.service
fi

[ ! -f .env ] && cp .env.prod .env

bun install
bun run generate
bun run migrate
bun run seed

cd ../frontend

[ ! -f .env ] && cp .env.prod .env

bun install
bun run build

if [ $RESET == 1 ]; then
  sudo /usr/bin/systemctl start somdomato-hono.service
else
  sudo /usr/bin/systemctl restart somdomato-hono.service
fi