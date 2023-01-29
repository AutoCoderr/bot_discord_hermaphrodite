FROM node:16.17

RUN npm install --location=global npm@8.19.1
RUN rm -rf /root/.npm/_cacache/tmp

WORKDIR /bot

CMD npm start
