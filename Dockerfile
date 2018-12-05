FROM node:10.13

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn

COPY . .

USER node

EXPOSE 26658

CMD [ "yarn", "start" ]
