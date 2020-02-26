import Router from 'koa-router';

const pageRouter = new Router({prefix: ''});

function renderPage(page) {
    return async function (ctx) {
        await ctx.render(page);
    };
}

// ctx.state 可以给模版传递数据
export default pageRouter
    .get('/', renderPage('index'))
    .get('/register', renderPage('register'));