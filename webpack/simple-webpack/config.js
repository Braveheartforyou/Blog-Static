/*
 * @Descripttion: 
 * @Author: 
 * @Date: 2021-01-17 13:27:02
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2021-01-17 22:35:35
 */

'use strict';

const path = require('path');

module.exports = {
  entry: path.join(__dirname, './src/index.js'),
  output: {
    path: path.join(__dirname, './dist'),
    filename: 'main.js'
  }
}