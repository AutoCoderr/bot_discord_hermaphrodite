FROM node:16.17

RUN npm install --location=global npm@9.6.5

RUN rm -rf /root/.npm/_cacache/tmp

WORKDIR /bot

CMD npm start
