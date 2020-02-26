import path from 'path';
import Koa from 'koa';
import jwt from 'koa-jwt';
import bodyParser from 'koa-bodyparser';
import helmet from 'koa-helmet';
import staticCache from 'koa-static-cache';
import favicon from 'koa-favicon';
import cors from '@koa/cors';
import winston from 'winston';
import { createConnection } from 'typeorm';
import 'reflect-metadata';
import { ConnectionString } from 'connection-string';
import { pathToRegexp } from 'path-to-regexp';
import config from 'config';

import { logger } from './logging';
import * as router from './routes';
import { cron } from './cron';
import { getIp } from './utl';
import render from './middlewares/layout-ejs';
import middleware from './middlewares';
import { patchClassValidatorI18n } from './utl/class-validator-i18n';

patchClassValidatorI18n();

const databaseUrl = config.get('db');
const dbEntitiesPath = config.get('dbEntitiesPath');
const jwtSecret = config.get('jwt.secret');
const port = config.get('port');
const host = getIp();


// Get DB connection options from env variable
const connectionOptions = new ConnectionString(databaseUrl);
const {user: username, password} = connectionOptions;
const h = connectionOptions.hosts[0];
const dbHost = h.name;
const dbPort = h.port;
const database = connectionOptions.path[0];


// create connection with database
// note that its not active database connection
// TypeORM creates you connection pull to uses connections from pull on your requests
createConnection({
    type: 'mysql',
    host: dbHost,
    port: dbPort,
    username,
    password,
    database,
    synchronize: true,
    logging: false,
    entities: dbEntitiesPath,
}).then(async connection => {

    const app = new Koa();

    render(app, {
        root: path.join(__dirname, 'views'),
        layout: 'layout',
        viewExt: 'ejs',
        cache: false,
        debug: false,
    });

    app.use(middleware.util);
    app.use(middleware.ipFilter);

    // Provides important security headers to make your app more secure
    app.use(helmet());

    // Enable cors with default options
    app.use(cors());

    // Logger middleware -> use winston as logger (logging.ts with config)
    app.use(logger(winston));

    // Enable bodyParser with default options
    app.use(bodyParser());

    app.use(favicon(path.join(__dirname, 'public', 'images', 'icon.png')));

    app.use(serveStatic('/public', './public'));

    // JWT middleware -> below this line routes are only reached if JWT token is valid, secret as env variable
    // do not protect swagger-json and swagger-html endpoints
    app.use(jwt({secret: jwtSecret}).unless(ctx => {

        if (/^\/swagger-/.test(ctx.path)) return true;
        if (/^\/api\/swagger-/.test(ctx.path)) return true;

        if (/^\/api/.test(ctx.path)) {
            return pathToRegexp([
                '/api/login',
                '/api/register',
                '/api/swagger-json',
            ]).test(ctx.path);
        }

        return true;
    }));

    // These routes are protected by the JWT middleware, also include middleware to respond with "Method Not Allowed - 405".
    app.use(router.api.routes()).use(router.api.allowedMethods());
    app.use(router.page.routes()).use(router.page.allowedMethods());

    // Register cron job to do any action needed
    cron.start();

    app.listen(port);

    console.log(`Server running on http://${host}:${port}`);

}).catch(error => console.log('TypeORM connection error: ', error));


function serveStatic(prefix, filePath) {
    return staticCache(path.resolve(__dirname, filePath), {
        prefix: prefix,
        gzip: true,
        dynamic: true,
        // FIXME 静态文件缓存怎么设置
        // maxAge: 60 * 60 * 24 * 30,
    });
}