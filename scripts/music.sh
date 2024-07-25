#!/bin/bash

MACHINE="eris"
SONGS_PATH="/media/songs"
LOCAL_SONGS_PATH="/home/lucas/audio/sdm"

rsync -avzz $LOCAL_SONGS_PATH/ root@$MACHINE:$SONGS_PATH/ --delete
ssh root@$MACHINE "chown -R liquidsoap:liquidsoap $SONGS_PATH && find $SONGS_PATH -type d -exec chmod 755 '{}' \; && find $SONGS_PATH -type f -exec chmod 644 '{}' \;"
ssh nginx@$MACHINE "cd /var/www/somdomato/backend && /home/nginx/.bun/bin/bun /var/www/somdomato/backend/src/drizzle/cleanup.ts"
