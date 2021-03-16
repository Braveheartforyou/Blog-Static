## webpack编译流程

- Entry: 指定`webpack`开始构建的入口模块，从该模块开始构建并计算出直接或间接依赖的模块或者库。
- Output：告诉`webpack`如何命名输出的文件以及输出的目录
- Module: 模块，在 `Webpack` 里一切皆模块，一个模块对应着一个文件。Webpack 会从配置的 `Entry` 开始递归找出所有依赖的模块。
- Chunk：`coding split`的产物，我们可以对一些代码打包成一个单独的chunk，比如某些公共模块，去重，更好的利用缓存。或者按需加载某些功能模块，优化加载时间。在`webpack3`及以前我们都利用`CommonsChunkPlugin`将一些公共代码分割成一个`chunk`，实现单独加载。在webpack4 中`CommonsChunkPlugin`被废弃，使用`SplitChunksPlugin`
- Loader：模块转换器，用于把模块原内容按照需求转换成新内容。
- Plugin：扩展插件，在 Webpack 构建流程中的特定时机会广播出对应的事件，插件可以监听这些事件的发生，在特定时机做对应的事情。

整体的编译流程大致如图所示，[简单的编译流程推荐文章](https://juejin.cn/post/6844903935828819981/)。

![webpack 编译流程](https://user-gold-cdn.xitu.io/2019/9/5/16d00393b89a5d42?imageslim)
## webpack入口

首先明确一点本文章只关注webpack编译流程中主要流程，会按照上图所以的打包流程按照源码来记录。在保证记录主流程的基础上尽量说道各个主要的细节点。

`Webpack`可以将其理解是一种基于**事件流**的编程范例，一个插件合集。而将这些插件控制在**webapck事件流**上的运行的就是webpack自己写的基础类`Tapable`。`Webpack` 的事件流机制应用了**观察者模式**，和 `Node.js` 中的 `EventEmitter`非常相似。

webpack源码内部主要的概念：

- `compiler 对象`代表了完整的 `webpack 环境配置`。这个对象在启动 webpack 时被一次性建立，并配置好所有可操作的设置，包括 `options`，`loader` 和 `plugin`。当在 webpack 环境中应用一个插件时，插件将收到此 `compiler 对`象的引用。可以使用它来访问 webpack 的主环境。
- `compilation` 对象代表了一次资源版本构建。**当运行 webpack 开发环境中间件时，每当检测到一个文件变化，就会创建一个新的 compilation，从而生成一组新的编译资源**。一个 compilation 对象表现了当前的模块资源、编译生成资源、变化的文件、以及被跟踪依赖的状态信息。compilation 对象也提供了很多关键时机的回调，以供插件做自定义处理时选择使用
- `tapable`

**调试技巧**

在通过vscode或者浏览器进行调试时，一定要在watch里面添加三个函数`compiler`、`compilation`、`options`，不然你真的很难搞清楚它们是怎么变化的。并且这三个对象真的很复杂，有数不清的属性，回调函数等等。

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
  // callback传入为空
  const webpack = ((options, callback) => {
    const create = () => {
      // 校验传入的options类型是否符合webpack内部定义的webpackOptionsSchema范式
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
    // 返回创建的compiler、watch、watchOptions对象
    return { compiler, watch, watchOptions };
  })
```

真正创建compiler对象的是通过`createCompiler`函数，下面看一下`createCompiler`函数。

### createCompiler

代码如下：

```js
const createCompiler = rawOptions => {
  // 初始化基础配置，如output、devserver、plugin 给赋值一些默认的配置格式，防止后面使用时报错
  const options = getNormalizedWebpackOptions(rawOptions);
  // options上添加context
  applyWebpackOptionsBaseDefaults(options);
  // 实例化compiler，传入上面创建的options.context
  const compiler = new Compiler(options.context);
  // options赋值给compiler.options
  compiler.options = options;
  // 把NodeEnvironmentPlugin插件挂载到compiler实例上
  // NodeEnvironmentPlugin中主要把文件系统挂载到compiler对象上 如infrastructureLogger(log插件)、inputFileSystem(文件输入插件)、outputFileSystem(文件输出插件)、watchFileSystem(监听文件输入插件)
  // 绑定hooks.beforeRun.tap("NodeEnvironmentPlugin") 钩子执行inputFileSystem.purge();
  new NodeEnvironmentPlugin({
    infrastructureLogging: options.infrastructureLogging
  }).apply(compiler);
  // 判定options.plugins中是否有插件需要挂载到compiler上
  if (Array.isArray(options.plugins)) {
    for (const plugin of options.plugins) {
      // 如果存在plugin的类型为function，通过call调用
      if (typeof plugin === "function") {
        plugin.call(compiler, compiler);
      } else {
        // 如果plugin为object类型，或者class类型，就调用它内部的apply方法
        plugin.apply(compiler);
      }
    }
  }
  // 简单来说就是往options上添加各种默认的配置
  // 通过applyExperimentsDefaults往options上面添加experiments
  // 通过applyModuleDefaults往options上面添加module
  // 通过applyOutputDefaults往options上面添加output
  // 通过applyLoaderDefaults往options上面添加loader
  // 通过applyOptimizationDefaults往options上面添加optimization
  applyWebpackOptionsDefaults(options);
  // 调用触发compiler上的environment钩子，绑定environment钩子的回调函数执行
  compiler.hooks.environment.call();
  // 调用触发compiler上的afterEnvironment钩子，绑定afterEnvironment钩子的回调函数执行
  // compiler对象上添加watchFileSystem 插件  compiler.watchFileSystem = new IgnoringWatchFileSystem( compiler.watchFileSystem, this.paths );
  compiler.hooks.afterEnvironment.call();
  // 主要用于挂载默认插件和触发对应时期的钩子
  new WebpackOptionsApply().process(options, compiler);
  compiler.hooks.initialize.call();
  return compiler;
};
```

因为`createCompiler`中的内容有点多，所以分开描述比较好一点。`new WebpackOptionsApply().process(options, compiler);`其中的内容也比较多。

在`createCompiler`函数中首先通过`getNormalizedWebpackOptions`和`applyWebpackOptionsBaseDefaults`往`options`对象上添加默认属性、方法。通过`const compiler = new Compiler(options.context);`并且把`options`赋值给`compiler.options`；把`NodeEnvironmentPlugin`其中包含的**文件处理插件**挂载到`compiler`对象上。
自定义的插件是在`webpack.config.js`中配置的`plugins`数组。在`plugins`中可以是`函数`和`对象`，如果是**函数**通过`call`执行；如果是**对象**，并且对象上存在`apply`方法，调用对象上的`apply`函数挂载插件。
通过`applyWebpackOptionsDefaults(options);`再补全`options`上的默认配置。
执行`compiler.hooks`上的钩子，执行绑定钩子的函数。

### WebpackOptionsApply().process(options, compiler)

`new WebpackOptionsApply().process(options, compiler);`看着代码只有一点点，但是里面添加了很多默认的`plugins`进去，也触发了`compiler.hooks`对应的钩子。`WebpackOptionsApply`的声明在`./lib/WebpackOptionsApply.js`文件中。

> 如果在自定义的配置中增加了某些参数，也会在这里挂载相对应的插件。

`./lib/WebpackOptionsApply.js`中的有很多代码，这里只看主要的流程如下：

```js
  class WebpackOptionsApply extends OptionsApply {
    constructor() {
      super();
    }
    process(options, compiler) {
      // 很多判断，根据options上的配置，是否通过apply方法挂载插件；
      // 。。。。。。省略很多代码

      // 判断options.devtool是否为''或者false
      if (options.devtool) {
        // 因为devtool有很多中配置，保证在需要的插件内部能方位到complier对象；
        // 后面会再具体讲一下source-map插件的原理
        if (options.devtool.includes("source-map")) {
          const hidden = options.devtool.includes("hidden");
          const inline = options.devtool.includes("inline");
          const evalWrapped = options.devtool.includes("eval");
          const cheap = options.devtool.includes("cheap");
          const moduleMaps = options.devtool.includes("module");
          const noSources = options.devtool.includes("nosources");
          // 引入不同的插件
          const Plugin = evalWrapped
            ? require("./EvalSourceMapDevToolPlugin")
            : require("./SourceMapDevToolPlugin");
          // 保证在插件内部能方位到complier对象；绑定很多compiler.hooks钩子
          new Plugin({
            filename: inline ? null : options.output.sourceMapFilename,
            moduleFilenameTemplate: options.output.devtoolModuleFilenameTemplate,
            fallbackModuleFilenameTemplate:
              options.output.devtoolFallbackModuleFilenameTemplate,
            append: hidden ? false : undefined,
            module: moduleMaps ? true : cheap ? false : true,
            columns: cheap ? false : true,
            noSources: noSources,
            namespace: options.output.devtoolNamespace
          }).apply(compiler);
        } else if (options.devtool.includes("eval")) {
          const EvalDevToolModulePlugin = require("./EvalDevToolModulePlugin");
          new EvalDevToolModulePlugin({
            moduleFilenameTemplate: options.output.devtoolModuleFilenameTemplate,
            namespace: options.output.devtoolNamespace
          }).apply(compiler);
        }
      }
      // 。。。。。。省略很多代码

      // 通过apply方法挂载插件，并且绑定很多对应的钩子
      new JavascriptModulesPlugin().apply(compiler);
      
      // 。。。。。。省略很多代码
      
      // 通过apply方法挂载插件
      // 并且绑定compiler.hooks.entryOption钩子，回调函数中会根据options.entry的类型再分为两种加载入口插件 DynamicEntryPlugin插件；EntryPlugin插件
      new EntryOptionPlugin().apply(compiler);

      // 触发compiler.hooks.entryOption钩子执行对应的回调函数；
      // 如调试代码中设置的入口文件，就会再compiler对象上的compiler.hooks.compilation.taps 上添加了一个name 为EntryPlugin对象
      compiler.hooks.entryOption.call(options.context, options.entry);

      // 。。。。。。省略很多代码

      // 绑定compiler.hooks上面的钩子的回调函数；并且保证插件内部能访问到compiler对象或者compation对象

      // options.optimization 相关的插件

      // options.cache 相关的插件

      // AMDPlugin, CommonJsPlugin

      // 触发compiler.hooks.afterPlugins钩子函数，执行前面绑定的回调函数；
      // 该插件组合了 ContainerPlugin 和 ContainerReferencePlugin。重载（overrides）和可重载（overridables）被合并到指定共享模块的单个列表中。
      compiler.hooks.afterPlugins.call(compiler);

      // compiler.resolverFactory.hooks.resolveOptions 为HookMap
      
      // 触发compiler.hooks.afterResolvers，执行绑定的回调函数； 因为回调函数为空
      compiler.hooks.afterResolvers.call(compiler);
      
      // 返回options对象
      return options;
    }
  }
```

在`WebpackOptionsApply().process(options, compiler)` 主要是为了根据不同的自定义配置和默认配置给`compiler`对象上挂载不同的插件；并且为`compiler.hooks`上的钩子绑定很多回调函数。

`webpack`的插件的编写要提供一个`apply`方法，在初始化webpack插件时，会调用插件的`apply`方法，并且会传入`compiler`对象，方便在插件中做绑定`compiler.hooks`上的钩子函数和访问当前配置。

### webpack 方法

在执行完成`createCompiler`方法后，返回`create`方法创建的`compiler`对象，代码如下：

```js
  // callback传入为undefined
  const webpack = ((options, callback) => {
    // 上面详细看过的函数，这里不多做解释
    const create = () => { // ...省略代码 }
    if (callback) {
      // 省略代码。。。
    } else {
      // 通过create()方法会返回 三个对象compiler、watch、watchOptions对象
      // compiler中间储存了当前编译的的配置
      // watch、watchOptions都为undefined
      const { compiler, watch } = create();
      if (watch) {
        util.deprecate(
          () => {},
          "A 'callback' argument need to be provided to the 'webpack(options, callback)' function when the 'watch' option is set. There is no way to handle the 'watch' option without a callback.",
          "DEP_WEBPACK_WATCH_WITHOUT_CALLBACK"
        )();
      }
      // 返回当前编译环境的compiler对象
      return compiler;
    }
  })
```

在执行完成`const compiler = webpack(config);`会返回当前编译环境的`compiler`对象，在这一步的时候当前编译环境中的`options`都配置完成。下一步执行调试代码中的`compiler.run(() => {})`。

## compiler.run

下面开始进入编译流程，执行`debug/start.js`中的流程`compiler.run`，代码如下：

```js
// 进入compiler.run流程，并且传入回调函数，收集编译信息和报错信息
compiler.run((err, stats)=>{
  if(err){
      console.error(err)
  }else{
      console.log(stats)
  }
})
```

首先要了解`compiler`类的实现才能知道后续流程执行的过程。代码如下：

**./lib/compiler**

```js
const Cache = require("./Cache"); // ./lib/Cache
// ./lib/compiler
class Compuler {
  constructor(context) {
    // 主要打变量赋值
    this.hooks = Object.freeze({
      // 定义各种的hooks
      
    })
    // 赋值其它变量
    /** @type {boolean} */
    this.idle = false;
    // 实例化一个Cache类
    this.cache = new Cache();
    // 省略代码....
  }
  // 获取cache
  getCache(name) {}

  run (callback) {
    // 判断代码是否正在执行
    if (this.running) {
      return callback(new ConcurrentCompilationError());
    }
    // 执行完成的回调 暂时先不看 后面会看到
    const finalCallback = (err, stats) => {
      // 省略代码....
    };
    const startTime = Date.now();
    this.running = true;
    // 下面this.compile中传入的回调函数 后面会具体说
    const onCompiled = (err, compilation) => {
      // 省略代码....
    }
    // 后面真正要执行的代码
    const run = () => {
      // 触发beforeRun钩子，执行绑定的回调
      this.hooks.beforeRun.callAsync(this, err => {
        // 如果报错直接退出当前编译，并且返回报错信息
        if (err) return finalCallback(err);
        // 在执行完成异步钩子beforeRun；后再执行run一步钩子
        this.hooks.run.callAsync(this, err => {
          if (err) return finalCallback(err);
          // 执行readRecords方法，进行文件读取完成后执行this.compile方法
          this.readRecords(err => {
            if (err) return finalCallback(err);
            // 执行this.compile方法并且传入当前onCompiled作为回调函数
            this.compile(onCompiled);
          });
        });
      });
    };
    // this.idle 默认为false
    if (this.idle) {
      // 这里的代码暂时不做解释
      this.cache.endIdle(err => {
        if (err) return finalCallback(err);
        this.idle = false;
        run();
      });
    } else {
      // 执行啥名定义的run()方法
      run();
    }

  }
  // 后面定义的方法暂时不在此一一列出等用到了会标注清楚
  // ...省略代码
}
```
