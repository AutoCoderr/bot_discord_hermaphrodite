#!/bin/bash
echo -e "\n$(date +"%Y-%m-%d %T") :\n$(/usr/local/bin/node /bot/scripts/XP/resetTodayXPs.js)" >> /script_logs/XP/resetTodayXPs.log 2>&1
