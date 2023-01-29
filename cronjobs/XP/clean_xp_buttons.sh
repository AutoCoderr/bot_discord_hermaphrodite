#!/bin/bash
echo -e "\n$(date +"%Y-%m-%d %T") :\n$(/usr/local/bin/node /bot/scripts/XP/cleanXPButtons.js)" >> /script_logs/XP/cleanXPButtons.log 2>&1