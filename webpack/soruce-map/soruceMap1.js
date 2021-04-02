/*
 * @Descripttion:
 * @Author: 19080088
 * @Date: 2021-04-01 13:48:20
 * @LastEditors: 19080088
 * @LastEditTime: 2021-04-02 14:06:17
 */
const sourceMap = require('source-map')
//
var map = new sourceMap.SourceMapGenerator({
  //
  file: './foo.js'
})
// 'I AM CHRIS' 生成的mapping如下
// map.addMapping({
//   sour
// })
// ,{
//   name: 'H',
//   generated: { line: 1, column: 2, },
//   source: "/Users/19080088/Desktop/student/Blog-Static/webpack/soruce-map/foo.js",
//   original: { line: 1, column: 7, }
// },{
//   name: 'R',
//   generated: { line: 1, column: 3, },
//   source: "/Users/19080088/Desktop/student/Blog-Static/webpack/soruce-map/foo.js",
//   original: { line: 1, column: 8, }
// },{
//   name: 'I',
//   generated: { line: 1, column: 4, },
//   source: "/Users/19080088/Desktop/student/Blog-Static/webpack/soruce-map/foo.js",
//   original: { line: 1, column: 9, }
// },{
//   name: 'S',
//   generated: { line: 1, column: 5, },
//   source: "/Users/19080088/Desktop/student/Blog-Static/webpack/soruce-map/foo.js",
//   original: { line: 1, column: 10, }
// }
// const Rawmapping = [
//   {
//     name: undefined,
//     generated: { line: 1, column: 13 },
//     source: "/Users/19080088/Desktop/student/Blog-Static/webpack/soruce-map/foo.js",
//     original: { line: 1, column: 13 }
//   },

// ]
const Rawmapping = [
  {
    name: undefined,
    generated: {
      line: 1,
      column: 0,
    },
    source: "/Users/19080088/Desktop/student/webpack/debug/src/index.js",
    original: {
      line: 1,
      column: 0,
    },
  },
]
map.setSourceContent("/Users/19080088/Desktop/student/webpack/debug/src/index.js", 'CHRIS')
Rawmapping.forEach(mapping => { map.addMapping(mapping) })
console.log(map.toString())
