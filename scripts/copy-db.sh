#!/bin/bash

MACHINE="eris"
DBREMOTE="/var/www/somdomato/backend/sqlite.db"
DBLOCAL="/home/lucas/tmp/"

scp root@$MACHINE:$DBREMOTE $DBLOCAL
