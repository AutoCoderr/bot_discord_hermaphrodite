#!/bin/bash
echo -e "\n$(date +"%Y-%m-%d %T") :\n$(/usr/local/bin/node /bot/scripts/cleanDatabase/cleanDatabase.js)" >> /script_logs/clean_database.log 2>&1
