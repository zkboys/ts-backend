import config from 'config';
import ipFilter from 'ip-filter';

const blackIPs = config.get('blackList.ips');

const codeMap = {
    '-1': 'fail',
    200: 'success',
    401: 'token expired',
    500: 'server error',
    10001: 'params error',
};

function success(data) {
    this.response.status = 200;
    if (data) this.body = data;
}

function fail(message, code = -1, data = undefined) {
    this.response.status = 400;
    this.body = {
        code,
        message: message || codeMap[code],
        data,
    };
}

export default class Middleware {
    static util(ctx, next) {
        ctx.set('X-Request-Id', ctx.req.id);
        ctx.success = success;
        ctx.fail = fail;
        return next();
    }

    static ipFilter(ctx, next) {
        if (ipFilter(ctx.ip, blackIPs, {strict: false})) {
            return ctx.fail('请求频率太快，已被限制访问');
        }
        return next();
    }
}
