/*
 * @Descripttion: 
 * @Author: 
 * @Date: 2021-01-17 13:21:19
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2021-01-17 22:51:11
 */
const Compiler = require('./compiler');

const options = require('../config');

new Compiler(options).run();