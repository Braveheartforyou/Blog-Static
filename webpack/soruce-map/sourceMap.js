/*
 * @Descripttion: 
 * @Author: 19080088
 * @Date: 2021-04-02 15:12:54
 * @LastEditors: 19080088
 * @LastEditTime: 2021-04-02 15:13:32
 */
// 引入mozilla/source-map包
const sourceMap = require('source-map')
// 实例化SourceMapGenerator
var map = new sourceMap.SourceMapGenerator({
  file: 'sourceMap.js.map'
})

// 有一个很关键的操作 addMapping 用于添加代码的映射行列和原始行列；这里我们直接借用babel-loader生成的_rawMappings
// babel-loader中会在webpack/node_modules/@babel/generator/lib/buffer.js 文件中创建_rawMappings
const RawMapping = [
  {
    name: undefined,
    generated: {
      line: 1,
      column: 0
    },
    source: "sourceMap.js",
    original: {
      line: 1,
      column: 0
    },
  },
]
// 首先网map实例中添加原始代码  第一个参数药浴source相同
map.setSourceContent("sourceMap.js", "'I AM CHRIS'")
RawMapping.forEach(mapping => map.addMapping(mapping))
// 输出sourceMap对象
console.log(map.toString())