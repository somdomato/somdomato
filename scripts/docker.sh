#!/usr/bin/env bash

if [ $1 ]; then
  docker stop somdomato-icecast somdomato-liquidsoap
  docker rm somdomato-icecast somdomato-liquidsoap
fi

docker compose -f docker/docker-compose.yml up -d --build