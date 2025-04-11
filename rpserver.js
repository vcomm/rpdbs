const express = require('express');
//const request = require('request');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(express.json());

// Модифицированная структура backendTargets
let backendTargets = {
  users: {
    baseUrl: "https://jsonplaceholder.typicode.com/users",
    routes: {
      all: "/",
      byId: "/:id",
      posts: "/:id/posts"
    }
  },
  render:"https://render.com/",
  sefon: "https://sefon.pro/",  
  portainer: "https://192.168.1.254:9443/#!/auth"
  // Добавьте другие бэкенды по мере необходимости
};

// Helper function to get real IP address
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.headers['x-real-ip'] ||
           req.socket.remoteAddress;
}

// Модифицированный POST endpoint для регистрации бэкенда с маршрутами
app.post('/backend', (req, res) => {
    const { name, target, routes } = req.body;
    if (!name || !target) {
        return res.status(400).json({
            error: 'Name and target are required'
        });
    }

    const clientIp = getClientIp(req);
    console.log(`Request received from IP: ${clientIp}`);

    try {
        const targetUrl = new URL(target);
        if (targetUrl.hostname === 'localhost' || targetUrl.hostname === '127.0.0.1') {
            targetUrl.hostname = clientIp;
        }
        
        backendTargets[name] = {
            baseUrl: targetUrl.toString(),
            routes: routes || { default: "/" }
        };
        
        res.status(201).json({
            message: `Backend ${name} added with IP ${clientIp}`,
            backend: backendTargets[name]
        });
    } catch (error) {
        res.status(400).json({
            error: `Invalid URL: ${error.message}`
        });
    }
});

// DELETE-запрос для удаления бэкенда
app.delete('/backend', (req, res) => {
    const { name } = req.body;
    if (backendTargets[name]) {
        delete backendTargets[name];
        res.status(200).json({
            message: `Backend ${name} deleted`
        });
    } else {
        res.status(404).json({
            error: `Backend ${name} not found`
        });
    }
});

// Маршрут для получения списка всех бэкендов
app.get('/backends', (req, res) => {
  res.status(200).json(backendTargets);
});

// Модифицированный прокси-middleware с поддержкой маршрутов
app.use('/rproxy/:backendName/:route?/*', (req, res, next) => {
    const backendName = req.params.backendName;
    const routeName = req.params.route || 'default';
    const backend = backendTargets[backendName];
    
    if (!backend) {
        return res.status(404).json({
            error: 'Backend not found'
        });
    }

    const route = backend.routes[routeName];
    if (!route) {
        return res.status(404).json({
            error: 'Route not found'
        });
    }

    const proxyOptions = {
        target: backend.baseUrl,
        changeOrigin: true,
        pathRewrite: (path) => {
            // Удаляем префикс /rproxy/backendName/route и добавляем определенный маршрут
            const basePath = `/rproxy/${backendName}/${routeName}`;
            return path.replace(basePath, route);
        },
        logger: console,
        secure: false,
    };

    createProxyMiddleware(proxyOptions)(req, res, next);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
