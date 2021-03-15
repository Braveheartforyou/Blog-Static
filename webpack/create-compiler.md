## webpack入口

首先明确一点本文章只关注webpack编译流程中主要流程。在保证记录主流程的基础上尽量说道各个主要的细节点。

webpack源码内部主要的概念：

- `compiler 对象`代表了完整的 `webpack 环境配置`。这个对象在启动 webpack 时被一次性建立，并配置好所有可操作的设置，包括 `options`，`loader` 和 `plugin`。当在 webpack 环境中应用一个插件时，插件将收到此 `compiler 对`象的引用。可以使用它来访问 webpack 的主环境。
- `compilation` 对象代表了一次资源版本构建。**当运行 webpack 开发环境中间件时，每当检测到一个文件变化，就会创建一个新的 compilation，从而生成一组新的编译资源**。一个 compilation 对象表现了当前的模块资源、编译生成资源、变化的文件、以及被跟踪依赖的状态信息。compilation 对象也提供了很多关键时机的回调，以供插件做自定义处理时选择使用
- `hooks`


开始调试的代码入口实在debug文件夹内部的代码`const webpack = require('../lib/index.js');const config = require('./webpack.config'); const compiler = webpack(config);`, 通过vscode的调试按钮来开始调试。

webpack源码代码的起点是在`../lib/index.js`文件中，导出的webpack的对象指向`get webpack() { return require("./webpack"); }`同层级文件夹下的`webpack.js`文件中。

> 在`lib/index.js`同时也到处了很多插件、方法。因为文件太多就不一一介绍，主要关注主流程。

看`lib/webpack.js`文件主要包含以下功能：

- 通过`getNormalizedWebpackOptions`合并webpack配置对象options(自定义配置、默认配置)，基础配置
- 实例化`comilper`对象
- 挂载`NodeEnvironmentPlugin`插件
- 挂载自定义插件
- 通过`applyWebpackOptionsDefaults`增加编译时需要的配置，如默认的`defaultRules`、`node`、`optimization`、`output`、`resolve`、`resolveLoader`对象。(有兴趣可以打断点进行查看)
- 调用环境钩子`compiler.hooks.environment.call(); compiler.hooks.afterEnvironment.call();`

通过`new WebpackOptionsApply().process(options, compiler);`往complier上面挂载各种默认插件、执行函数钩子。这个比较复杂下面展开讲。

根据上面列表的大致执行顺序结合代码分析。

```js
  // lib/webpack.js
  const webpack = ((options, callback) => {
    const create = () => {
      validateSchema(webpackOptionsSchema, options);
      // ...省略代码
      // 判断传入的options是否为数组，创建多个compiler对象
      if (Array.isArray(options)) {
        /** @type {MultiCompiler} */
        // createMultiCompiler内部也是调用createCompiler方法
        compiler = createMultiCompiler(options, options);
        watch = options.some(options => options.watch);
        watchOptions = options.map(options => options.watchOptions || {});
      } else {
        /** @type {Compiler} */
        // 调用createCompiler并且传入options(webpack配置)
        compiler = createCompiler(options);
        watch = options.watch;
        watchOptions = options.watchOptions || {};
      }
    }
  })
```

真正创建compiler对象的是通过`createCompiler`函数，下面看一下`createCompiler`函数。

### createCompiler

上面

## 设置options