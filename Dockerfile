FROM node:20-alpine

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start", "--", "--input", "./titanic.json", "--host", "0.0.0.0", "--port", "3000"]
