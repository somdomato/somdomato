#!/usr/bin/env bash

if [ "$EUID" -ne 0 ] && [ ! -f /etc/arch-release ]; then
  echo "Please run as root"
  exit 1
fi

[ ! -f /etc/arch-release ] && MUSIC=/var/music || MUSIC=$HOME/music/sdm
[ ! -f /etc/arch-release ] && chown -R liquidsoap:nginx "$MUSIC"

find "$MUSIC" -type d -exec chmod 775 {} \;
find "$MUSIC" -type f -exec chmod 664 {} \;