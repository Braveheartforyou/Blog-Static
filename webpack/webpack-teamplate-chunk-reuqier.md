## webapck中module相关

> **webpack版本为 5.28.0**

这片文章记录webpack中和module相关的内容，从`compiler.hooks.make`添加入口文件收集依赖，到`loader`加载执行，再到生成`chunkGraph`然后通过`tempalte`输出chunk文件。

### enhanced-resolve/ResolverFactory

`enhanced-resolve`用来做路径解析，在webpack中的路径解析就是用的`enhanced-resolve`来做的。路径解析的实现是在`ResolverFactory`类中实现的。

webpack中的`ResolverFactory.js`主要是参数解析和初始化插件，`enhanced-resolve`内部的实现先不关注，直接看`ResolverFactory.js`内部的代码实现。
如果对`enhanced-resolve`内部实现感兴趣的可以看这篇文章[enhanced-resolve内部实现](https://juejin.cn/post/6844904056633327630#heading-10)。

```js
  // ./lib/ResolverFactory.js
  const Factory = require("enhanced-resolve").ResolverFactory;
  const { HookMap, SyncHook, SyncWaterfallHook } = require("tapable");

  module.exports = class ResolverFactory {
    constructor() {
      // 定义hooks
      this.hooks = Object.freeze({
        resolveOptions: new HookMap(
          () => new SyncWaterfallHook(["resolveOptions"])
        ),
        resolver: new HookMap(
          () => new SyncHook(["resolver", "resolveOptions", "userResolveOptions"])
        )
      });
      this.cache = new Map();
    }
    get(type, resolveOptions = {}) {
      // 处理缓存

      // 实例化ResolverFactory
      const newResolver = this._create(type, resolveOptions);
      typedCaches.direct.set(resolveOptions, newResolver);
      typedCaches.stringified.set(ident, newResolver);
      // 返回实例
      return newResolver;
    }
    _create(type, resolveOptionsWithDepType) {
      // 处理options 参数

      // 创建resolver
      const resolver = /** @type {ResolverWithOptions} */ (Factory.createResolver(
        resolveOptions
      ));
      // 触发钩子
      this.hooks.resolver
        .for(type)
        .call(resolver, resolveOptions, originalResolveOptions);
      // 返回创建的resolver
      return resolver;
    }
  }
```

真正的`Resolver`实例并没有在一开始就实例化，`ResolverFactory`的实例创建实在`compiler`实例化中。在`compiler`实例化之后在通过`createNormalModuleFactory`创建`NormalModuleFactory`实例的时候传入进去。`ResolverFactory.get`才会开始处理参数和实例化一个`Resolver`。代码如下：

```js
  // ./lib/compiler.js
  const ResolverFactory = require("./ResolverFactory");
  class Compiler {
    constructor(context) {
      this.resolverFactory = new ResolverFactory();
    }
    // 初始化NormalModuleFactory工厂函数
    createNormalModuleFactory() {
      const normalModuleFactory = new NormalModuleFactory({
        context: this.options.context,
        fs: this.inputFileSystem,
        // 传入ResolverFactory工厂函数
        resolverFactory: this.resolverFactory,
        options: this.options.module,
        associatedObjectForCache: this.root,
        layers: this.options.experiments.layers
      });
      this.hooks.normalModuleFactory.call(normalModuleFactory);
      return normalModuleFactory;
    }
    // 实例化compilation中的工厂函数
    newCompilationParams() {
      const params = {
        normalModuleFactory: this.createNormalModuleFactory(),
        contextModuleFactory: this.createContextModuleFactory()
      };
      return params;
    }
    compile(callback) {
      const params = this.newCompilationParams();
      // 实例化compilation时候传入工厂函数
      const compilation = this.newCompilation(params);
    }
  }
```

`ResolverFactory`类会在`compiler`实例化时被引用，在实例化`NormalModuleFactory`类的时候传入进去，因为在`NormalModuleFactory`中会通过`ResolverFactory.get`会创建两个`Resolver`实例。分别是`loaderResolver`、`normalResolver`用于解析`loader`路径和普通模块路径。

### 添加入口文件

触发`compiler.hooks.make`钩子会执行`EntryPlugin.js`中绑定的回调函数。`EntryPlugin`插件会在`lib/WebpackOptionsApply.js`中初始化，并且对`entryOptions`进行处理。代码如下：

```js

  // ./lib/entryplugin.js
  class EntryPlugin {
    apply(compiler) {
      // 绑定compiler.hooks.compilation同步钩子；
      // 在compiler.js中在compilation实例化完成之后会调用compilation钩子
      compiler.hooks.compilation.tap(
        "EntryPlugin",
        // 执行回调函数把 EntryDependency为key normalModuleFactory为value放进dependencyFactories Map()中 后面会用到
        (compilation, { normalModuleFactory }) => {
          compilation.dependencyFactories.set(
            EntryDependency,
            normalModuleFactory
          );
        }
      );

      compiler.hooks.make.tapAsync("EntryPlugin", (compilation, callback) => {
        // entry: './src/index.js'
        // options: { name: 'main.js' }
        // context: '/Users/19080088/Desktop/student/webpack/debug'
        const { entry, options, context } = this;
        // 执行createDependency实例化一个EntryDependency类用于后期收集依赖使用
        const dep = EntryPlugin.createDependency(entry, options);
        // 执行compilation.addEntry方法，并且传入三个参数
        compilation.addEntry(context, dep, options, err => {
          callback(err);
        });
      });
    }
  }

```

在`compiler.hooks.make`之前会先执行`compiler.hooks.compilation`钩子，该钩子会为当前的`compilation`实例上的`dependencyFactories`添加工厂函数。

在`compiler.hooks.make`中首先会实例化一个`EntryDependency`类，调用`compilation.addEntry`方法。下面看compilation的实现。

#### compilation.addEntry 实现

`compilation` 对象代表了一次资源版本构建。**当运行 webpack 开发环境中间件时，每当检测到一个文件变化，就会创建一个新的 compilation，从而生成一组新的编译资源**。一个 compilation 对象表现了当前的模块资源、编译生成资源、变化的文件、以及被跟踪依赖的状态信息。compilation 对象也提供了很多关键时机的回调，以供插件做自定义处理时选择使用。

```js
  // ./lib/compilation.js
  class Compilation {
    constructor(compiler) {
      // 处理compilation中的属性和方法
      this.compiler = compiler;
      // 传入的resolver工厂函数
      this.resolverFactory = compiler.resolverFactory;
      // 文件读取插件
      this.inputFileSystem = compiler.inputFileSystem;
      this.fileSystemInfo = new FileSystemInfo(this.inputFileSystem, {
        managedPaths: compiler.managedPaths,
        immutablePaths: compiler.immutablePaths,
        logger: this.getLogger("webpack.FileSystemInfo")
      });

      // 实例化模板类 用于创建对应的代码
      this.mainTemplate = new MainTemplate(this.outputOptions, this);
      this.chunkTemplate = new ChunkTemplate(this.outputOptions, this);
      this.runtimeTemplate = new RuntimeTemplate(
        this.outputOptions,
        this.requestShortener
      );
      /** @type {{javascript: ModuleTemplate}} */
      this.moduleTemplates = {
        javascript: new ModuleTemplate(this.runtimeTemplate, this)
      };

      // 定义moduleGraph、chunkGraph，在递归解析依赖之后生成moduleGraph；在递归处理moduleGraph生成chunkGraph
      this.moduleGraph = new ModuleGraph();
      this.chunkGraph = undefined;

      // 定义一步执行队列、回调方法
      this.factorizeQueue = new AsyncQueue({
        name: "factorize",
        parent: this.addModuleQueue,
        processor: this._factorizeModule.bind(this)
      });


      // 定义chunk相关
      this.chunks = new Set();
      this.chunkGroups = [];

      // 定义modules 用于存储 module
      this._modules = new Map();

      // cache相关
      this._modulesCache = this.getCache("Compilation/modules");
      this._assetsCache = this.getCache("Compilation/assets");
      this._codeGenerationCache = this.getCache("Compilation/codeGeneration");
    }
    // 定义factorizeModule方法
    factorizeModule(options, callback) {
      // 异步队列中添加回调方法
      this.factorizeQueue.add(options, callback);
    }
    // 在下一个Immediate后执行当前方法
    _factorizeModule({ currentProfile, factory, dependencies, originModule, contextInfo, context }, callback) {
      // 执行normalModuleFactory.create方法，并且传入参数
      factory.create(
        {
          contextInfo: {
            issuer: originModule ? originModule.nameForCondition() : "",
            issuerLayer: originModule ? originModule.layer : null,
            compiler: this.compiler.name,
            ...contextInfo
          },
          resolveOptions: originModule ? originModule.resolveOptions : undefined,
          context: context
            ? context
            : originModule
            ? originModule.context
            : this.compiler.context,
          dependencies: dependencies
        },
        (err, result) => {

          // 对result进行处理

          // 返回编译好的Module实例;
          // callback 其实就是 包含了 this.addModule的传入的回调函数
          callback(null, newModule);
        }
      )
    }

    addEntry(context, entry, optionsOrName, callback) {
      // 处理options调用_addEntryItem
      this._addEntryItem(context, entry, "dependencies", options, callback);
    }

    _addEntryItem(context, entry, target, options, callback) {
      const { name } = options;
      if (this.entries.get(name) === undefined) {
        // 创建entryData 对象，并且放进 compilation.entries中
      } else {
        // 执行另一部分操作
      }

      // 触发addEntry钩子
      this.hooks.addEntry.call(entry, options);
      // 调用addModuleTree方法
      this.addModuleTree(
        {
          context,
          dependency: entry,
          contextInfo: undefined
        },
        // 回调函数中执行对应的钩子
        (err, module) => {
          if (err) {
            this.hooks.failedEntry.call(entry, options, err);
            return callback(err);
          }
          this.hooks.succeedEntry.call(entry, options, module);
          return callback(null, module);
        }
      );
    }
    addModuleTree({ context, dependency, contextInfo }, callback) {
      // 获取dependency上的构造函数
      const Dep = (dependency.constructor);
      // 获取在 EntryPlugin 中添加的 normalModuleFactory 工厂函数
      const moduleFactory = this.dependencyFactories.get(Dep);

      // 把handleModuleCreation中需要的参数传入 主要的是两个 moduleFactory: normalModuleFactory, dependencies: dep 实例

      this.handleModuleCreation(
        {
          factory: moduleFactory,
          dependencies: [dependency],
          originModule: null,
          contextInfo,
          context
        },
        err => { }
      )
    }
    
    handleModuleCreation(/* 参数 */) {
      // 获取moduleGraph实例
      const moduleGraph = this.moduleGraph;
      // 如果存在profile
      const currentProfile = this.profile ? new ModuleProfile() : undefined;
      // 调用normalModuleFactory
      this.factorizeModule(
        {
          currentProfile,
          factory,
          dependencies,
          originModule,
          contextInfo,
          context
        },
        (err, newModule) => {
          // 回调函数中调用this.addModule 方法
          this.addModule(newModule, (err, module) => {})
        }
    }
  }
```

在上面的代码中执行步骤大致如下：

- `compliation.addEntry`进行层层调用，层层调用会对必要的参数进行处理，直到`factorizeModule`函数。
- `factorizeModule`函数会在`factorizeQueue`队列中添加一个`processor: _factorizeModule`。在异步队列中会执行`_factorizeModule`方法。
- `_factorizeModule`方法内部会调用`normalModuleFactory.create`实例上的方法，开始使用`loader`处理文件、生成module并且返回module给后面的回调函数。回调函数中的`this.addModule`会使用这个新创建`module`对象。

下面进入`normalModuleFactory`文件中看一下`create`中做了那些事情。

### normalModuleFactory.create

`normalModuleFactory`就是在`compiler`中创建的`NormalModuleFactory`的实例。从`normalModuleFactory.create`开始`module`、`chunk`创建和各种loader的执行。下面看一下`normalModuleFactory`在webpack中都做了那些工作。

`normalModuleFactory`主要实现的功能如下：

- 

```js
  // ./lib/NormalModuleFactory.js
  class NormalModuleFactory extends ModuleFactory {
    constructor({
      context,
      fs,
      resolverFactory,
      options,
      associatedObjectForCache,
      layers = false
    }) {
      super();
      // 定义各种hooks
      this.hooks = Object.freeze({})
      // 获取在resolver工厂函数；后面会用于创建loaderResolver获取loader地址；创建normalResolver
      this.resolverFactory = resolverFactory;
      this.ruleSet = ruleSetCompiler.compile([
        {
          rules: options.defaultRules
        },
        {
          rules: options.rules
        }
      ]);
    }
  }
```