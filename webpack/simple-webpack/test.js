/*
 * @Descripttion: 
 * @Author: 
 * @Date: 2021-01-17 18:23:25
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2021-01-17 21:54:50
 */
const { getAST, getDependencis, transform } = require('./lib/parser');
const path = require('path');

const ast = getAST(path.join(__dirname, './src/index.js'))
const dependencies =  getDependencis(ast);
const transformCode = transform(ast);
console.log('transformCode: ', transformCode);
// console.log('dependencies: ', dependencies);
// console.log('ast: ', ast);