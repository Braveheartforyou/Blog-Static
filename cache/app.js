const Koa = require('koa');
const Router = require('koa-router');
const Static = require('koa-static');
const fs = require('fs-extra');
const Path = require('path');
const crypto = require('crypto');
const mime = require('mime');

const app = new Koa();
const router = new Router();

router.get('/', async (ctx, next) => {
    ctx.type = mime.getType('.html');
    // console.log(__dirname)
    const content = await fs.readFile(Path.resolve(__dirname + '/index/index.html'), 'UTF-8');
    // console.log(content);
    ctx.body = content;
    await next();
})
const responseFile = async (path, context, encoding) => {
    const fileContent = await fs.readFile(path, encoding);
    context.type = mime.getType(path);
    context.body = fileContent;
};


router.get('/index/rotateX.png', async (ctx, next) => {
    ctx.set('Pragma', 'no-cache');
    const { response, request, path } = ctx;
    const imagePath = Path.resolve(__dirname, `.${path}`);
    const ifModifiedSince = request.headers['if-modified-since'];
    // console.log(ifModifiedSince)
    const imageStatus = await fs.stat(imagePath);
    const lastModified = imageStatus.mtime.toGMTString();
    if (ifModifiedSince === lastModified) {
        response.status = 304;
    } else {
        response.lastModified = lastModified;
        await responseFile(imagePath, ctx);
    }

    await next();
})

// 处理 css 文件
router.get('/index/index.css', async (ctx, next) => {
    const { request, response, path } = ctx;
    ctx.type = mime.getType(path);
    response.set('pragma', 'no-cache');

    const ifNoneMatch = request.headers['if-none-match'];
    const imagePath = Path.resolve(__dirname, `.${path}`);
    const hash = crypto.createHash('md5');
    const imageBuffer = await fs.readFile(imagePath);
    hash.update(imageBuffer);
    const etag = `"${hash.digest('hex')}"`;
    if (ifNoneMatch === etag) {
        response.status = 304;
    } else {
        response.set('etag', etag);
        ctx.body = imageBuffer;
    }

    await next();
});

// 处理 css 文件
router.get('/index/index.js', async (ctx, next) => {
    const { path } = ctx;
    ctx.type = mime.getType(path);
    ctx.set('Cache-Control', 'max-age=' + 10);
    // ctx.set('Pragma', 'no-cache');
    // ctx.set('Cache-Control', 'no-cache');
    // ctx.set('Pragma', 'max-age=' + 10);
    const content = await fs.readFile(Path.resolve(__dirname, `.${path}`), 'UTF-8');
    ctx.body = content;

    await next();
});

// app.use(Static('./index'))
app.use(router.routes()).use(router.allowedMethods());

app.listen(3000, function (err) {
    // console.log()
    if (err) {
        console.log(err)
    } else {
        console.log('启动成功')
    }
})