/*
 * @Descripttion: 
 * @Author: 19080088
 * @Date: 2021-04-01 15:36:47
 * @LastEditors: 19080088
 * @LastEditTime: 2021-04-01 16:32:10
 */
const vlq = require('vlq')

const string = vlq.encode(['1', '0', '1', '0'])
console.log('string: ', string);