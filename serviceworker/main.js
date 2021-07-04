const Koa = require('koa');
const Static = require('koa-static');
const fs = require('fs');
const path = require('path');
// const plugins = require('cordova-plugins')
// import utils from './index/src/utils'
// console.log(utils)
// utils.loadFinish()
// console.log(plugins)
const app = new Koa();

// app.use(
app.use(Static('./index'));
// app.use(Static('./sw.js'));
app.listen(3003, '10.32.3.41', function (data) {
    console.log(data);
});