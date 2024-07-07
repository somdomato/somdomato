#!/bin/bash

ansible-playbook --connection=local -e "ansible_port=2200" /var/www/somdomato/ansible/playbook.yml -i localhost,