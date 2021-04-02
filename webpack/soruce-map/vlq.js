/*
 * @Descripttion: 
 * @Author: 19080088
 * @Date: 2021-04-01 15:36:47
 * @LastEditors: 19080088
 * @LastEditTime: 2021-04-02 14:17:30
 */
const vlq = require('vlq')

const string = vlq.encode([12, 3, 456, 7])
// const string = vlq.encode([1, 0, 1, 6, 2])
const decodeString =  vlq.decode('aAAaA')
console.log('string: ', string, decodeString);