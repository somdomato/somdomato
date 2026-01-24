#!/usr/bin/env bash

chown -R liquidsoap:nginx /var/music
find /var/music -type d -exec chmod 775 {} \;
find /var/music -type f -exec chmod 664 {} \;