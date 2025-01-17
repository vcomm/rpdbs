const express = require('express');
//const request = require('request');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(express.json());

let backendTargets = {
  users: "https://jsonplaceholder.typicode.com/users",
  render:"https://render.com/",
  sefon: "https://sefon.pro/",  
  portainer: "https://192.168.1.254:9443/#!/auth"
  // Добавьте другие бэкенды по мере необходимости
};

// POST-запрос для добавления нового бэкенда
app.post('/backend', (req, res) => {
  const { name, target } = req.body;
  if (name && target) {
    backendTargets[name] = target;
    res.status(201).send(`Бэкенд ${name} добавлен.`);
  } else {
    res.status(400).send('Необходимо указать name и target.');
  }
});

// DELETE-запрос для удаления бэкенда
app.delete('/backend', (req, res) => {
  const { name } = req.body;
  if (backendTargets[name]) {
    delete backendTargets[name];
    res.status(200).send(`Бэкенд ${name} удален.`);
  } else {
    res.status(404).send(`Бэкенд ${name} не найден.`);
  }
});

// Маршрут для получения списка всех бэкендов
app.get('/backends', (req, res) => {
  res.status(200).json(backendTargets);
});

// Прокси-мидлварь с динамическим выбором бэкенда
app.use('/rproxy/:backendName', (req, res, next) => {
  const backendName = req.params.backendName;
  const target = backendTargets[backendName];
  if (target) {
//    createProxyMiddleware({ target, changeOrigin: true })(req, res, next);
   
    createProxyMiddleware({
        target,
        changeOrigin: true,
        logger: console,
        //secure: false, // Добавлено: игнорировать ошибки, связанные с недоверенными сертификатами
    })(req, res, next);
  
    //req.pipe(request(target)).pipe(res);

  } else {
    res.status(404).send('Бэкенд не найден.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
