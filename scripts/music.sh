#!/bin/bash

MACHINE="eris"
SONGS_PATH="/media/songs"

rsync -avzz /home/lucas/audio/sdm/ root@$MACHINE:$SONGS_PATH/ --delete
ssh root@$MACHINE "chown -R liquidsoap:liquidsoap $SONGS_PATH && find $SONGS_PATH -type d -exec chmod 755 '{}' \; && find $SONGS_PATH -type f -exec chmod 644 '{}' \;"