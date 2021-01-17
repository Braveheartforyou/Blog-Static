/*
 * @Descripttion: 
 * @Author: 
 * @Date: 2021-01-17 13:21:30
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2021-01-17 22:50:52
 */

const fs = require('fs');
const path = require('path');
const { getAST, getDependencis, transform } = require('./parser');

// comipler 类
/**
 * run 开始解析入口文件
 * buildModule 使用不同的loader遍历不同的模块，分析依赖，解析依赖
 * emitFiles 输出chunks 、文件
 */
module.exports = class Compiler {
  constructor(options) {
    // 获取配置 入口、出口文件
    const { entry, output } = options;
    this.entry = entry;
    this.output = output;
    // 储存依赖数组
    this.modules = []
  }
  
  run() {
    // 入口文件获取 依赖模块、文件名称、transformCode
    const entryModule = this.buildModule(this.entry, true);
    // 添加到依赖数组中
    this.modules.push(entryModule);
    // 循环调用 入口文件中 依赖模块
    this.modules.map(_module => {
      _module.dependencies.map(dependency => {
        this.modules.push(this.buildModule(dependency));
      })
    });
    // 输出文件
    this.emitFiles();
  }
  /**
   * @param {String} filename 文件名称
   * @param {Boolean} isEntry 是否为入口文件
   * @return {Object} filename 文件名称；dependencies 依赖数组； transformCode 转换为 es 2016/ 2015代码；
   */
  buildModule(filename, isEntry) {
    let ast;
    // 如果是入口文件直接调用getAST 获取抽象代码树；如果不是入口文件 通过路径转换 再 getAST 获取抽象代码树；
    if (isEntry) {
      ast = getAST(filename);
    } else {
      // 根据当前执行命令根目录 拼接相对路径
      let absolutePath = path.join(process.cwd(), './src', filename);
      ast = getAST(absolutePath);
    }
    return {
      filename: filename,
      dependencies: getDependencis(ast),
      transformCode: transform(ast)
    }
  }
  /**
   * 输出文件
  */
  emitFiles () {
    // 根据config 配置获取 output配置
    const outputPath = path.join(this.output.path, this.output.filename);
    // 模拟webpack中的模块函数 IIFE
    let modules = '';
    // 循环调用 依赖数组拼接代码
    this.modules.forEach(_module => {
      modules += `'${ _module.filename }': function (require, module, exports) { ${ _module.transformCode } },`
    });
    // 输出bundle代码
    const bundle = `
      (function(modules) {
        function require(fileName) {
          const fn = modules[fileName];

          const module = { exports: {} };

          fn(require, module, module.exports);

          return module.exports;

        }
        require('${this.entry}');
      })({${modules}})
    `;

    console.log('bundle: ', bundle);
    // 写入到配置的文件中
    fs.writeFileSync(outputPath, bundle, 'utf-8');
  }
  
}