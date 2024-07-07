#!/usr/bin/env bash

export SONGS_PATH=/media/songs 

/usr/share/liquidsoap/.bun/bin/bun /var/www/somdomato/backend/src/engine.ts "$1"