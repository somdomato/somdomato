#!/bin/bash

PATH=$PATH:/home/nginx/.bun/bin

cd backend
[ ! -f .env ] && cp .env.prod .env
#rm -fr sqlite.db src/drizzle/migrations/
bun install
bun run generate
bun run migrate
bun run seed

cd ../frontend
[ ! -f .env ] && cp .env.prod .env
#rm -fr dist/
bun install
bun run build

sudo /usr/bin/systemctl restart somdomato-hono.service