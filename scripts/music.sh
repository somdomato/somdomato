#!/bin/bash

rsync -avzz /home/lucas/audio/sdm/ root@ananke:/media/songs/ --delete
ssh root@ananke "chown -R liquidsoap:liquidsoap /media/songs/"