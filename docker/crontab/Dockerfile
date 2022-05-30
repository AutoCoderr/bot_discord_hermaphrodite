FROM node:16

RUN apt update && apt install cron -y

CMD crontab /etc/cron.d/crontab && cron -f -l 2
