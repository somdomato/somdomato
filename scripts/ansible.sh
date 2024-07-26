#!/bin/bash

[ ! $1 ] && PLAYBOOK="playbook" || PLAYBOOK="$1"

if [ -f /etc/arch-release ]; then
  ansible-playbook -e "ansible_port=2200 ansible_python_interpreter=/usr/bin/python3" /home/lucas/code/somdomato/somdomato/ansible/$PLAYBOOK.yml -i eris.paxa.dev,
else
  ansible-playbook --connection=local -e "ansible_port=2200" /var/www/somdomato/ansible/$PLAYBOOK.yml -i localhost,
fi