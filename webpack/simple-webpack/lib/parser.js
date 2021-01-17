/*
 * @Descripttion: 
 * @Author: 
 * @Date: 2021-01-17 13:21:42
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2021-01-17 22:52:06
 */
const fs = require('fs');
// 用于转换AST
const babylon = require('babylon');
// 获取依赖项
const traverse = require('babel-traverse').default;
// 转换为代码
const { transformFromAst } = require('babel-core');

module.exports = {
  // 获取抽象语法树
  getAST: (path) => {
    const context = fs.readFileSync(path, 'utf-8');

    return babylon.parse(context, {
      sourceType: 'module'
    });
  },
  // 获取依赖项，并且储存到数组中
  getDependencis: (ast) => {
    const dependencies = [];
    traverse(ast, {
      ImportDeclaration: ({ node }) => {
        dependencies.push(node.source.value);
      }
    });
    return dependencies;
  },
  // 转换代码
  transform: (ast) => {
    const { code } = transformFromAst(ast, null, {
      presets: ['env']
    })
    return code;
  }
}