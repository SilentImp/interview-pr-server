# Запуск локально
Створіть з `.env.template` файл `.env` і додайте GitHub API токен у `INVITE_GITHUB_TOKEN`, імʼя користувача API у `INVITE_GITHUB_USERNAME` та статичний пароль у `INVITE_PASSWORD`.
```
npm ci
node server.js
```

# Збірка контейнера та публікація у реєстр
```
docker buildx build --platform linux/amd64 -t silentimp/interview-pr ./
docker push silentimp/interview-pr       
```

# Запуск через контейнер
```
docker run -p 127.0.0.1:3000:3000/tcp silentimp/interview-pr
open http://127.0.0.1:3000
```
