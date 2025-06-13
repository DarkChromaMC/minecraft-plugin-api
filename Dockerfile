FROM maven:3.9.6-eclipse-temurin-17

WORKDIR /app

COPY . .

RUN apt-get update && apt-get install -y nodejs npm && npm install

EXPOSE 3000
CMD ["npm", "start"]
