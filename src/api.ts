import path from 'path';
import { SwaggerRouter } from 'koa-swagger-decorator';
import controller = require('./controller');

const router = new SwaggerRouter();

// USER ROUTES
router.get('/users', controller.user.getUsers);
router.get('/users/:id', controller.user.getUser);
router.post('/users', controller.user.createUser);
router.put('/users/:id', controller.user.updateUser);
router.delete('/users/:id', controller.user.deleteUser);
router.delete('/testusers', controller.user.deleteTestUsers);

// Swagger endpoint
router.swagger({
    title: '企业微信消息平台',
    description: '收集业务数据，发送消息到企业微信',
    version: '1.0.0',
    // prefix: '/api',
});

// mapDir will scan the input dir, and automatically call router.map to all Router Class
router.mapDir(__dirname);

export default router;