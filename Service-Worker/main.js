const Koa = require('koa');
const Static = require('koa-static');
const fs = require('fs');
const path = require('path');

const app = new Koa();

// app.use(
app.use(Static('./index'));
// app.use(Static('./sw.js'));
app.listen(3000, function (data) {
    console.log(data);
});