#!/bin/bash

rm -f drizzle/database.db
npx drizzle-kit push
npx tsx ./src/db/seed.ts