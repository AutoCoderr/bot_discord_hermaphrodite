#!/bin/bash
echo -e "\n$(date +"%Y-%m-%d %T") :\n$(/usr/local/bin/node /bot/scripts/cleanTextAndVocalButtons.js)" >> /script_logs/cleanTextAndVocalButtons.log 2>&1
