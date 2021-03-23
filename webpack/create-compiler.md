## webpack编译流程

说明一点看webpack的编译流程非常枯燥，即使看完理解之后也不见得能对本上有很多帮助。

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

webpack入口中主要做的事情详情如下：

| 事件名 | 解释 |
|:------:|:------------------------:|
| 初始化参数 | 从配置文件和 Shell 语句中读取与合并参数，得出最终的参数。 这个过程中还会执行配置文件中的插件实例化语句 new Plugin()。  |
| 实例化 Compiler | 用上一步得到的参数初始化 `Compiler` 实例，`Compiler` 负责文件监听和启动编译。`Compiler` 实例中包含了完整的 `Webpack` 配置，全局只有一个 `Compiler` 实例。  |
| 加载插件 | 依次调用插件的 `apply` 方法，让插件可以监听后续的所有事件节点。同时给插件传入 `compiler` 实例的引用，以方便插件通过 `compiler` 调用 `Webpack` 提供的 `API`。  |
| environment | 开始应用 `Node.js` 风格的文件系统到 `compiler` 对象，以方便后续的文件寻找和读取。 |
| entry-option | 读取配置的 `Entrys`，为每个 `Entry` 实例化一个对应的 `EntryPlugin`，为后面该 `Entry` 的递归解析工作做准备。 |
| after-plugins | 调用完所有内置的和配置的插件的 `apply` 方法。 |
| after-resolvers | 根据配置初始化完 `resolver`，`resolver` 负责在文件系统中寻找指定路径的文件。 |

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

**钩子调用顺序**

- compiler.hooks.environment.call() 同步钩子
- compiler.hooks.afterEnvironment.call() 同步钩子

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

      // 通过apply方法挂载插件，并且绑定很多对应的钩子，js加载方式插件
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

**钩子调用顺序**

- compiler.hooks.entryOption.call(options.context, options.entry) 同步钩子
- compiler.hooks.afterPlugins.call(compiler); 同步钩子
- compiler.hooks.initialize.call(); 同步钩子

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
const {
  SyncHook,
  SyncBailHook,
  AsyncParallelHook,
  AsyncSeriesHook
} = require("tapable"); // 引入tapbale库
// ./lib/compiler
class Compuler {
  constructor(context) {
    // 主要打变量赋值
    this.hooks = Object.freeze({
      // 定义各种的hooks
      /** @type {AsyncSeriesHook<[Compiler]>} */
      beforeRun: new AsyncSeriesHook(["compiler"]),
      /** @type {AsyncSeriesHook<[Compiler]>} */
      run: new AsyncSeriesHook(["compiler"])
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
          // 执行readRecords方法
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

在`compiler`类中通过`tapable`库定义了很多`hooks`，webpack的**生命周期或执行流程**就是通过`hooks`串联起来的。`compiler.run()`方法内部又定义了三个函数`finalCallback`、`onCompiled`、`内部run(为了区别compiler.run)`。
在下面会直接调用`内部run`方法，会执行`this.hooks.beforeRun.callAsync`代码，触发`this.hooks.beforeRun`异步钩子绑定的回调函数。那里绑定了`this.hooks.beforeRun`钩子呢？

这里通过`watch`compiler对象内部的`hooks.beforeRun.taps`中储存了回调函数数组。如下图所示：
![beforeRun_taps](./images/beforeRun_taps.jpg)

`hooks.beforeRun`只绑定了一个回调函数，在`NodeEnvironmentPlugin(文件地址 ./lib/node/NodeEnvironmentPlugin.js)`插件中绑定的回调函数，回调函数会做一个文件系统的**清除缓存**操作，代码如下：

```js
  // 回调函数传入compiler对象作为参数
  compiler.hooks.beforeRun.tap("NodeEnvironmentPlugin", compiler => {
    // 判断当前inputFileSystem 和 当前类中的inputFileSystem相同
    if (compiler.inputFileSystem === inputFileSystem) {
      // 执行inputFileSystem中的清除操作
      inputFileSystem.purge();
    }
  });
```

> 有两种方式可以查看`this.hooks.beforeRun`其中绑定那些回调函数，一种全局搜索`hooks.beforeRun`,另一种还是通过`vscode`调试代码时添加`watch`观测`compiler`对象。

在触发完成`hooks.beforeRun`钩子后，接着触发`hooks.run`钩子，`hooks.run`没有绑定任何回调函数。`hooks.run`表示编译开始。

第一次编译直接可以忽略`this.readRecords`方法，直接看`this.compile(onCompiled);`，`this.compile`是一个比较复杂的过程，再进行拆分。

**钩子调用顺序**

- compiler.hooks.beforeRun.callAsync(compiler.hooks.run()) 异步钩子
- compiler.hooks.run.callAsync(this.complie(onCompiled)) 异步钩子

## compiler.compile(this.compile)

首先看一下`this.compile(compiler中定义)`方法的定义和传入的回调函数`onCompiled(compiler.run中定义的)`的定义，代码如下：

```js
  // ./lib/compiler

  class Compiler {
    // 省略代码...
    constuctor () {}
    // 省略代码...

    // 定义NormalModuleFactory工厂函数
    createNormalModuleFactory() {
      const normalModuleFactory = new NormalModuleFactory({
        context: this.options.context,
        fs: this.inputFileSystem,
        resolverFactory: this.resolverFactory,
        options: this.options.module,
        associatedObjectForCache: this.root,
        layers: this.options.experiments.layers
      });
      // 触发normalModuleFactory钩子函数并且传入工厂函数
      this.hooks.normalModuleFactory.call(normalModuleFactory);
      // 返回工程函数
      return normalModuleFactory;
    }
    // 定义ContextModuleFactory工厂函数
    createContextModuleFactory() {
      const contextModuleFactory = new ContextModuleFactory(this.resolverFactory);
      // 触发contextModuleFactory钩子函数并且传入工厂函数
      this.hooks.contextModuleFactory.call(contextModuleFactory);
      // 返回工程函数
      return contextModuleFactory;
    }

    // 创建Compliation所要用到的参数
    newCompilationParams() {
      const params = {
        // 触发对应的钩子并且返回工厂函数实例
        normalModuleFactory: this.createNormalModuleFactory(),
        contextModuleFactory: this.createContextModuleFactory()
      };
      return params;
    }

    // 通过new Compilation(compiler)实例化Compilation并且返回
    createCompilation() {
      return new Compilation(this);
    }

    // 创建compilation实例
    newCompilation(params) {
      // 创建Compilation函数
      const compilation = this.createCompilation();
      compilation.name = this.name;
      compilation.records = this.records;
      //  触发thisCompilation钩子，传入 compilation实例 和 { NormalModuleFactory, ContextModuleFactory}
      this.hooks.thisCompilation.call(compilation, params);
      //  触发thisCompilation钩子 传入 compilation实例 和 { NormalModuleFactory, ContextModuleFactory}
      this.hooks.compilation.call(compilation, params);
      // 返回compilation实例
      return compilation;
    }


    // 创建compile方法并且传入callback; 在compiler.run()中通过this.compile(onCompiled)调用
    compile (callback) {
      // 通过newCompilationParams()获取两个工厂函数
      // createNormalModuleFactory 用于创建NormalModuleFactory
      // createContextModuleFactory 用于创建ContextModuleFactory
      const params = this.newCompilationParams();
      // 触发beforeCompile钩子；并且传入当前传入compilation的参数
      this.hooks.beforeCompile.callAsync(params, err => {
        // 触发beforeCompile钩子；并且传入当前传入compilation的参数
        this.hooks.compile.call(params);
        // 获取compiation实例
        const compilation = this.newCompilation(params);
        // 触发make钩子执行绑定的回调函数，传入compilation实例 回调函数
        this.hooks.make.callAsync(compilation, err => {
          // 触发finishMake函数钩子执行绑定的回调函，传入compilation实例 回调函数
          this.hooks.finishMake.callAsync(compilation, err => {
            process.nextTick(() => {
              // 执行 compilation 实例上的finish方法
              compilation.finish(err => {
                 // 执行 compilation 实例上的seal方法
                compilation.seal(err => {
                  // 触发afterCompile函数钩子执行绑定的回调函，传入compilation实例 回调函数
                  this.hooks.afterCompile.callAsync(compilation, err => {
                    // 执行传入的onCompiled回调函数，并且传入compilation实例，返回执行结果
                    return callback(null, compilation);
                  });
                });
              });
            });
          });
        });
      });
    }
  }
```

这一步骤里面的代码太多了，很多代码后面又会触发其他的钩子，尽可能细的去看它们背后执行了什么。`compile`方法中就是真正的开始编译流程，下面就开始看一下`webpack`是怎么实现的。下面代码都是从上面代码分解出来了，一步一步来了解是怎么实现的。

```js
   compile (callback) {
    // 通过newCompilationParams()获取两个工厂函数
    // createNormalModuleFactory 用于创建NormalModuleFactory
    // createContextModuleFactory 用于创建ContextModuleFactory
     const params = this.newCompilationParams();
     
   }
```

在`compile`方法中首先会实例化两个有关于`Module`的两个工厂函数，这个两个工厂还是也是非常重要的是后续用来解析`module`的`normalModule`和`contextModule`。如果对这个感兴趣的话可以去看[NormalModuleFactory.md](./NormalModuleFactory.md)。

以`NormalModuleFactory`工厂函数为例，它主要实现的功能是：

- 通过`loader`的`resolver`来解析`loader`路径
- 使用`Factory`创建 `NormalModule`实例
- 使用`loaderResolver`解析`loader`模块路径
- 根据`rule.modules`创建`RulesSet`规则集
- 使用 `loader-runner` 运行 `loaders`
- 通过 `Parser` 解析 (内部是 `acron`)
- `ParserPlugins` 添加依赖

在`compiler.compile`方法中首先初始化了两个工厂函数`(normalModuleFactory、contextModuleFactory)`，并且把两个工厂函数实例储存到`params`变量中。`this.hooks.beforeCompile`触发编译前`beforeCompile`钩子，钩子函数上没有绑定任何函数；`this.hooks.compile`编译即将启动钩子，也没有绑定任何回调函数；
通过`this.newCompilation`初始化一个`Compilation`实例，接下来触发`thisCompilation.call`钩子，这个钩子上面绑定了`9个`回调函数，如下图所示：

![thisCompliation_callback](./images/thisCompliation_callback.png)

执行`compilation.call`同步钩子，当前钩子上绑定了`46个`回调函数，如下图所示：

![compliation_callback](./images/compliation_callback.png)

> `compilation实例` 对象代表了一次资源版本构建。当运行 webpack 开发环境中间件时，每当检测到一个文件变化，就会创建一个新的 `compilation`，从而生成一组新的编译资源。一个 `compilation 对象`表现了当前的模块资源、编译生成资源、变化的文件、以及被跟踪依赖的状态信息。

**compilation**中主要功能：

<!-- TODO: 总结compliation -->

在返回`compilation`实例对象后，执行`compiler.hooks.make.callAsync`钩子开始真正的编译过程，`compilation.addEntry`从入口文件开始编译。

因为`make`是一个入口文件内容也比较多，再把这个过程看做一个独立的模块。

**钩子调用顺序**

- compiler.hooks.beforeCompile.callAsync(params: {normalModuleFactory, contextModuleFactory }) 异步钩子
- compiler.hooks.normalModuleFactory.call(normalModuleFactory)/compiler.hooks.contextModuleFactory.call(contextModuleFactory) 同步钩子
- compiler.hooks.compile.call(params: {normalModuleFactory, contextModuleFactory }) 同步钩子
- compiler.hooks.thisCompilation.call(compilation // 实例, params: {normalModuleFactory, contextModuleFactory }) 同步钩子
- compiler.hooks.compilation.call(compilation // 实例, params: {normalModuleFactory, contextModuleFactory }) 同步钩子

### compiler.hooks.make.callAsync(compilation)

> addEntry 中无论是那个版本的webpack 都是回调地狱，并且很多钩子在nextTick中执行，很难找，希望在norModuleFactory中能梳理清楚，数不清楚的回调函数。再加上异步和tapable，导致调用栈都不能很好的梳理清楚。

大致执行流程是`compilation.addEntry => compilation._addEntryItem => compilation.addModuleTree => compilation.handleModuleCreation => compilation.factorizeModule => compilation._factorizeModule => NormalModuleFactory.create => compliation.addModule => compilation.buildModule => compilation._buildModule => normalModule.build => normalModule.doBuild => runLoaders(normalModule中的执行) => this.parser.parse(normalModule中的执行)`

vscode调试调用栈部分如下图所示：

![make_callStack_one.png](./images/make_callStack_one.png)


执行`compiler.hooks.make.callAsync(compilation)`触发`make钩子`，有很多个插件绑定了`compiler.hooks.make`钩子，绑定钩子的插件如下图所示：

![make_tapAsync](./images/make_tapAsync.png)

这里只关注了`entryPulgin`内部绑定的回调函数，在回调函数中执行`compilation.addEntry(context, dep, options, err=> {})`；

在`compilation.addEntry`会直接调用`compilation._addEntryItem`内部执行操作如下：

- 执行`this.entries.set(name, entryData);`添加入口文件配置
- 执行`compilation.hooks.addEntry.call(entry, options);`执行addEntry钩子，绑定钩子的插件有`ProgressPlugin`、`RuntimeChunkPlugin`，执行对应的回调函数
- 调用`compilation.addModuleTree(context, dependency: entry, contextInfo: undefined)`

在 `compilation.addModuleTree`中执行大致如下：

- `const moduleFactory = this.dependencyFactories.get(Dep);` 获取工厂函数；
- 调用`compilation.handleModuleCreation(factory: moduleFactory // 工厂函数, dependencies: [dependency])`

`compilation.handleModuleCreation`方法执行如下操作：

- 调用`compliation.factorizeModule(factory// 工厂函数, dependencies // 依赖项, (err, newModule) => { this.addModule; })`方法
- 回调函数中有调用了`compliation.addModule`方法；`compliation.addModule`的回调函数中又调用了`compliation.buildModule`方法

`compliation.factorizeModule`方法执行如下操作：

`this.factorizeQueue.add(options, callback);`，调用一开始初始化`compilation`时，初始化的`this.factorizeQueue = new AsyncQueue({ name: "factorize", parent: this.addModuleQueue, processor: this._factorizeModule.bind(this) });`

- `compilation.factorizeQueue.add()`主要的操作是`setImmediate(root._ensureProcessing);` 在下一个进程中添加一个`AsyncQueue._ensureProcessing`方法。

在下一个nextTick中，执行链大致如下`AsyncQueue._ensureProcessing => AsyncQueue._startProcessing => compilation._factorizeModule`。

下面看`compilation._factorizeModule`方法过程大致如下：

- `factory.create`