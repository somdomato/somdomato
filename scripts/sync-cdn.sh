#!/bin/bash

set -e

#rsync -avz -e 'ssh -p 22000' /var/www/somdomato/public/covers/ lucas@localhost:/home/lucas/code/somdomato/public/covers/ 2> /dev/null
rsync -avz /home/lucas/cdn/somdomato/ nginx@tyche:/var/www/cdn.somdomato.com/ --exclude=".*"