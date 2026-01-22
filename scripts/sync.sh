#!/usr/bin/env bash

EXCLUDES="--exclude='*.part' --exclude='lost+found/' --exclude='temp/' --exclude='incomplete/' --exclude='.DS_Store'"

#rsync -avz --progress liquidsoap@tyche:/var/music/sdm/ /home/lucas/music/sdm/ $EXCLUDES
rsync -avz --progress /home/lucas/music/sdm/ liquidsoap@tyche:/var/music/sdm/ $EXCLUDES --delete