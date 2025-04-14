const express = require('express');
const proxy = require('express-http-proxy');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
  aigrokproxy: {
    baseUrl: "http://46.121.173.32:3000/",
    routes: {
        analyze: "/analyze",
        getTest: "/api/test",
        getTraining: "/api/training",
        postTraining: "/api/training"
    }
  }
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

    console.log(`Request param:`, req.params);
    console.log(`Request method: ${req.method}`);
    
    if (!backend) {
        return res.status(404).json({
            error: 'Backend not found',
            backend: backendName
        });
    }

    const route = backend.routes[routeName];
    if (!route) {
        return res.status(404).json({
            error: 'Route not found',
            route: routeName
        });
    }

    // Create proxy middleware
    const proxyMiddleware = proxy(backend.baseUrl, {
        proxyReqPathResolver: function(req) {
            return route;
        },
        proxyReqBodyDecorator: function(bodyContent, srcReq) {
            // Ensure body is properly handled for POST/PUT
            return new Promise(function(resolve) {
                resolve(bodyContent);
            });
        },
        proxyErrorHandler: function(err, res, next) {
            console.error('Proxy Error:', err);
            res.status(500).json({
                error: 'Proxy Error',
                message: err.message
            });
        },
        timeout: 60000
    });

    return proxyMiddleware(req, res, next);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
