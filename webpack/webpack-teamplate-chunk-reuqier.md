## webapck中module相关

> **webpack版本为 5.28.0**

这片文章记录webpack中和module相关的内容，从`compiler.hooks.make`添加入口文件收集依赖，到`loader`加载执行，再到生成`chunkGraph`然后通过`tempalte`输出chunk文件。

## 调试源码修改

在[调试webpack 源码](./debuge.md)代码基础上进行如下修改。

**添加./src/asyncModule.js**文件

```js
  const add = (a, b) => { return a + b; }
  export default add
```

**添加./src/syncModule.js**文件

```js
  const add = (a, b) => { return a + b; }
  export default add
```

**修改./src/index.js**文件

```js
  import is from 'object.is'  // 这里引入一个小而美的第三方库，以此观察webpack如何处理第三方包
  // import add from './asyncModule'
  import syncAdd from './syncModule'
  const add = import('./asyncModule')
  console.log('很高兴认识你，webpack')
  console.log(is(1,1))
  const addNum = add(1, 2)
  const syncAddNum = syncAdd(1, 2)
  console.log('add', addNum, syncAddNum)
```

## 相关知识

### enhanced-resolve/ResolverFactory

`enhanced-resolve`用来做路径解析，在webpack中的路径解析就是用的`enhanced-resolve`来做的。路径解析的实现是在`ResolverFactory`类中实现的。

webpack中的`ResolverFactory.js`主要是参数解析和初始化插件，`enhanced-resolve`内部的实现先不关注，直接看`ResolverFactory.js`内部的代码实现。
如果对`enhanced-resolve`内部实现感兴趣的可以看这篇文章[enhanced-resolve内部实现](https://juejin.cn/post/6844904056633327630#heading-10)。
`enhanced-resolve`大致分为两个阶段：

- `doResolve`开始编译根据传入的路径对文件分析。通过调用`Snapshot.createSnapshot`来生成代码片段。对生成的**文件信息对象**进行处理。
- `finshResolve`再对**文件信息对象**和当前资源进行组装，返回组装好的对象。

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

### ruleSet


在实例化`NormalModuleFactory`时候，通过`ruleSetCompiler.compile([])`创建一个`ruleSet`对象，这个对象相当于一个规则过滤器，会将`resourcePath`应用于所有的`module.rules`规则，从而筛选出所需的`loader`。其中最重要的两个方法是：

- 实例方法`ruleSet.exec()`；返回需要解析的loader
- 实例对象`references:Map()`用于存储需要模块要用到`loader`

实例化后的`RuleSet`就可以用于为每个模块获取对应的`loader`。这个实例化的`RuleSet`就是我们上面提到的`NormalModuleFactory`实例上的`this.ruleSet`属性。工厂每次创建一个新的`NormalModule`时都会调用`RuleSet`实例的`ruleSet.exec()`方法，只有当通过了各类测试条件，才会将该`loader push`到结果数组中。

## 添加入口文件

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

### compilation.addEntry 实现

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

## normalModuleFactory.create

`normalModuleFactory`就是在`compiler`中创建的`NormalModuleFactory`的实例。从`normalModuleFactory.create`开始`module`、`chunk`创建和各种loader的执行。下面看一下`normalModuleFactory`在webpack中都做了那些工作。

`normalModuleFactory`主要实现的功能如下：

- 实例化`normalModuleFactory`会在构造函数中初始化要用到的如`resolverFactory`、`ruleSet`、`hooks`、`cache`等等
- `normalModuleFactory.create`中首先创建了`resolveData`用于后期使用。调用`normalModuleFactory.hooks.factorize`钩子触发绑定的回调函数。

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
      // 序列化并把 rules 编译为固定格式（RuleSet 相关逻辑本文略过）
      // 返回一个exct方法和references(map)
      this.ruleSet = ruleSetCompiler.compile([
        {
          // webpack中默认的配置的rules
          rules: options.defaultRules
        },
        {
          // 用户通过webpack.config.js中配置
          rules: options.rules
        }
      ]);
      // 绑定钩子的回调函数
      this.hooks.factorize.tapAsync()
      this.hooks.resolve.tapAsync()
    }
    create (data, callback) {
      // 创建resolveData对象，用于触发钩子函数的入参
      const resolveData = {
        contextInfo, // {issuer: '', issuerLayer: null, compiler: undefined}
        resolveOptions, // {}
        context, // '/Users/admin/Desktop/velen/student/webpack/debug'
        request, // './src/index.js'
        dependencies, // [EntryDependency]
        fileDependencies, // LazySet {_set: Set(0), _toMerge: Set(0), _toDeepMerge: Array(0), _needMerge: false, _deopt: false}
        missingDependencies, // LazySet {_set: Set(0), _toMerge: Set(0), _toDeepMerge: Array(0), _needMerge: false, _deopt: false}
        contextDependencies, // LazySet {_set: Set(0), _toMerge: Set(0), _toDeepMerge: Array(0), _needMerge: false, _deopt: false}
        createData: {}, // {}
        cacheable: true
      };
      // 触发hooks.beforeResolve钩子传入resolveData
      this.hooks.beforeResolve.callAsync(resolveData, (err, result) => {
        // 触发hooks.factorize钩子传入resolveData；执行构造函数中绑定的factorize钩子上回调函数
        this.hooks.factorize.callAsync(resolveData, (err, module) => {
          // 定义工厂结果
          const factoryResult = {
            module,
            fileDependencies,
            missingDependencies,
            contextDependencies
          };
          // 执行回调函数 并且传入factoryResult
          callback(null, factoryResult)
        })
      })
    }
  }
```

`this.hooks.factorize`会调用到构造函数中绑定的钩子函数，又会触发`this.hooks.resolve.callAsync`钩子，开始创建`loaderResolver`等等对象。

通过`normalResolver`来解析普通js文件信息。

```js
  // ./lib/NormalModuleFactory.js
  class NormalModuleFactory extends ModuleFactory {
    constructor () {
      this.hooks.factorize.tapAsync({ name: "NormalModuleFactory", stage: 100 },
        (resolveData, callback) => {
          // 首先触发hooks.resolve钩子函数
          this.hooks.resolve.callAsync(resolveData, (err, result) => {})
        }
      )
      // 执行绑定钩子函数
      this.hooks.resolve.tapAsync( { name: "NormalModuleFactory", stage: 100 },
        (data, callback) => {
          // 解构传入的resolveData
          const {
            contextInfo,
            context,
            dependencies,
            request,
            resolveOptions,
            fileDependencies,
            missingDependencies,
            contextDependencies
          } = data;
          const dependencyType // 通过dependencies获取类型
          // 实例化一个resolverFactory 调用resolverFactory.get方法 => 调用resolverFactory._create => 触发监听的钩子 compiler.resolverFactory.hooks.resolver.intercept({}) => 返回创建的resolverFactory实例
          const loaderResolver = this.getResolver("loader");

          // 需要对文件路径进行处理还判断

          // 会在这个里面首先判断模块需要的loader，然后通过loaderResolver.resolve来加载对应的loader
          const continueCallback = needCalls(2, err => {
            // 生成当前模块需要的loader数组
            const result = this.ruleSet.exec({
              resource: resourceDataForRules.path,
              realResource: resourceData.path,
              resourceQuery: resourceDataForRules.query,
              resourceFragment: resourceDataForRules.fragment,
              mimetype: matchResourceData ? "" : resourceData.data.mimetype || "",
              dependency: dependencyType,
              descriptionData: matchResourceData
                ? undefined
                : resourceData.data.descriptionFileData,
              issuer: contextInfo.issuer,
              compiler: contextInfo.compiler,
              issuerLayer: contextInfo.issuerLayer || ""
            });
            // 创建三个用于存储 根据类型分别储存result中的loader
            const settings = {};
            const useLoadersPost = [];
            const useLoaders = [];
            const useLoadersPre = [];

            // 声明三个数据用于存储解析完成的loader
            let postLoaders, normalLoaders, preLoaders;
            
            // 被调用3才执行回调函数
            const continueCallback = needCalls(3, err => {
              // 合并postLoaders, normalLoaders, preLoaders 三个数组
              const allLoaders = postLoaders;
              // 根据matchResourceData 调整loader顺序
              if (matchResourceData === undefined) {
                for (const loader of loaders) allLoaders.push(loader);
                for (const loader of normalLoaders) allLoaders.push(loader);
              } else {
                for (const loader of normalLoaders) allLoaders.push(loader);
                for (const loader of loaders) allLoaders.push(loader);
              }

              // 把当前方法中创建的loaders、resource等等合并到传入的resolveData.createData
              Object.assign(data.createData, {
                layer:
                  layer === undefined ? contextInfo.issuerLayer || null : layer, // null
                request: stringifyLoadersAndResource(
                  allLoaders,
                  resourceData.resource
                ), // "/Users/19080088/Desktop/student/webpack/node_modules/babel-loader/lib/index.js!/Users/19080088/Desktop/student/webpack/debug/src/index.js",
                userRequest, // "/Users/19080088/Desktop/student/webpack/debug/src/index.js"
                rawRequest: request, //"./src/index.js",
                loaders: allLoaders, //  "/Users/19080088/Desktop/student/webpack/node_modules/babel-loader/lib/index.js"
                resource: resourceData.resource, //"/Users/19080088/Desktop/student/webpack/debug/src/index.js",
                matchResource: matchResourceData
                  ? matchResourceData.resource
                  : undefined, // undefined
                resourceResolveData: resourceData.data, // ”入口“文件对象 resourceResolveData
                settings, // type: "javascript/auto",
                type,  //"javascript/auto",
                parser: this.getParser(type, settings.parser), 	// parser: { hooks: {} sourceType: "auto", },
                generator: this.getGenerator(type, settings.generator), // getGenerator: {}
                resolveOptions // undefined
              });
              // 执行hooks.resolve绑定回调函数
              callback();
            })
          })
          // 默认调用resolveRequestArray方法记载loader, 因为在很多时候我们配置的
          this.resolveRequestArray(
            contextInfo,
            context,
            elements,
            loaderResolver,
            resolveContext,
            (err, result) => {
              if (err) return continueCallback(err);
              loaders = result;
              continueCallback();
            }
          );

          // 通过loaderResolver.resolve加载loader，如果当前模块没有匹配的loader

          // resource with scheme
          if (scheme) {
          } 
          // resource without scheme and without path
          else if (/^($|\?|#)/.test(unresolvedResource)) {
          }
          // resource without scheme and with path
          else {

            // 创建normalResolver 实例
            const normalResolver = this.getResolver(
              "normal",
              dependencyType
                ? cachedSetProperty(
                    resolveOptions || EMPTY_RESOLVE_OPTIONS,
                    "dependencyType",
                    dependencyType
                  )
                : resolveOptions
            );
            // 内部会调用normalResolver.resolve根据路径来生成需要的source(resolvedResourceResolveData)资源，主要包含：
            this.resolveResource(contextInfo,
              context,
              unresolvedResource,
              normalResolver,
              resolveContext,
              (err, resolvedResource, resolvedResourceResolveData) => {
                if (resolvedResource !== false) {
                  resourceData = {
                    resource: resolvedResource,
                    data: resolvedResourceResolveData,
                    ...cacheParseResource(resolvedResource)
                  };
                }
                continueCallback();
              }
            )
          }
          
        }
      )
    }
    getResolver(type, resolveOptions) {
      return this.resolverFactory.get(type, resolveOptions);
    }
  }
```

在执行`hooks.resolve`中会用到`resolverFactory`实例上的`resolve`方法，这里又会涉及到`enhanced-resolve`执行过程，`enhanced-resolve`内部的运行这里就不细究了。`hooks.resolve`绑定的回调函数执行步骤大致如下：

- 解构传入的`resolveData`，对必要的属性进行处理；通过`getResolver("loader")`生成`loaderResolver`实例，默认会调用一个`resolveRequestArray`方法，这个方法内部会调用`loaderResolver`.
- 因为默认调用`resolveRequestArray`时候，element(要加载的loader)为0，所以直接走到通过`normalResolver`来加载文件资源。
- `normalResolver`创建也是通过`getResolver("normal", options)`来创建，创建完成之后直接调用`this.resolveResource`来解析入口文件。
- `this.resolveResource(..., normalResolver)`内部会直接调用`normalResolver.resolve`来对文件进行读取、依赖收集、组装对象，`resolve`内部也是走到了`enhanced-resolve`内部的操作。
- `normalResolver.resolve`会返回对应文件生成的**文件信息对象**，执行回调函数又会执行到外部的`continueCallback`方法。

简单总结来说 就是先通过`normalResolver`来解析”入口文件“的**文件信息**。

伪代码调用的顺序如下：

1. 创建`loaderResolver`实例；创建`continueCallback = needCalls(2, err => {})`；处理`options`
2. 执行`resolveRequestArray(...elements)`因为`elements`就是要解析的loader，现在为空；**所以不会解析loader文件**；直接执行回调函数`continueCallback`;
3. 因为`needCalls(2)`传入的第一个参数为`2`所以什么都没做，直接执行后面的判断； 会直接执行`this.resolveResource(..., normalResolver)`；`normalResolver`就是在上面创建的`resolverFactory`实例。
4. `this.resolveResource`内部会直接调用`normalResolver.resolve`会对文件路径进行解析，返回一个`resolvedResourceResolveData`对象。再次调用`continueCallback`方法，现在这次会执行进`continueCallback`中定义的`callback`方法。
5. `callback`方法中会对用户配置的`loaders`进行处理，通过`ruleSet.exec`根据传入的参数过滤要使用的`loader`对象`result`。
6. 根据各个`loader`上的`type`属性，添加到不同的数组中，四个分类：`pre： 前置loader`、`normal： 普通loader`、`inline： 内联loader`、`post： 后置loader`；添加到不同的`postLoaders`, `normalLoaders`, `preLoaders`类型中。
7. 把当前创建的`loaders`、`parser`、`generator`等等合并到传入的`resolveData.createData`对象上；执行`hooks.resolve`中的回调函数。

> 径解析返回的对象大致如下：
resolvedResourceResolveData {
  __innerRequest:'./src/index.js'
  request:undefined
  relativePath:'./src/index.js'
  path:'/Users/19080088/Desktop/student/webpack/debug/src/index.js'
  fragment:''
  module:false
  context:{issuer: '', issuerLayer: null, compiler: undefined}
  descriptionFileData:{name: 'debug', version: '1.0.0', description: '', main: 'start.js', scripts: {…}, …}
}

**NormalModuleFactory.hooks.resolve(callback)**

在通过`normalResolver`解析完成普通文件信息、通过`loaderResolver`解析完成`loaders`文件地址后，这里面主要就是实例化`NormalModule`对象，并且把这个对象传递下；
触发三个钩子`NormalModuleFactory.hooks.resolve`、`NormalModuleFactory.hooks.createModule`、`NormalModuleFactory.hooks.module`

在创建完成`NormalModule`之后，把`factoryResult`包含了`module(NormalModule实例)`的对象返回到`compilation._factorizeModule`的回调函数中。

## 生成chunksGraph

在执行`compilation._factorizeModule`之后执行过程如下：

1. 执行`compilation.addModule/compilation._addModule`，首先会往`compilation.moduleGraph`中会添加当前module之间的关系。然后再往`compilation.modules`中添加当前的`modules`.
2. 再执行`compilation.buildModule/compilation._buildModule`，这个就会执行的`normalModule.build`方法。还触发了`compiler.hooks.buildModule`来对`sourceMap`进行配置。
3. `compilation._buildModule`内部会执行到`module.build(NormalModule实例)`方法，开始处理`module`，通过`runloader`运行`loader`来转换`module`生成`source`和`AST`代码。并且递归处理依赖。
4. 处理完成当前`module`后，递归处理`Dependencies`依赖项，并且在`compliation.moduleGraph`中维护各个`module`之间的关系。

### module.build

下面就根据上面的执行步骤来看**webpack源码**中的实现。

```js
  // ./lib/compilation.js
  // 开始对当前module进行处理
  module.build(
    this.options, // 配置项
    this, // compilation实例
    this.resolverFactory.get("normal", module.resolveOptions), // 生成normalResolver(ResolverFactory实例)
    this.inputFileSystem, // 文件系统
    err => {
      this._modulesCache.store(module.identifier(), null, module, err => {
        if (currentProfile !== undefined) {
          currentProfile.markStoringEnd();
        }
        if (err) {
          this.hooks.failedModule.call(module, err);
          return callback(new ModuleStoreError(module, err));
        }
        this.hooks.succeedModule.call(module);
        return callback();
      }
    }
  )
```

`module.build`会传入当前的`options`和`compilation`实例等等入参，会执行到`normalModule.build`方法。代码如下：

```js
  // ./lib/NormalModules.js
  class NormalModules extends Modules {
    /**
    * @param {WebpackOptions} options webpack options
    * @param {Compilation} compilation the compilation
    * @param {ResolverWithOptions} resolver the resolver
    * @param {InputFileSystem} fs the file system
    * @param {function(WebpackError=): void} callback callback function
    * @returns {void}
    */
    doBuild(options, compilation, resolver, fs, callback) {
      // 生成loaderContext
      const loaderContext = this.createLoaderContext(
        resolver,
        options,
        compilation,
        fs
      );
      // 通过createSource生成source对象；并且调用build中写入的回调函数生成AST
      const processResult = (err, result) => {
        // 创建_source
        this._source = this.createSource(
          options.context,
          this.binary ? asBuffer(source) : asString(source),
          sourceMap,
          compilation.compiler.root
        );
        // 如果经过loader解析已经生成了AST代码，直接赋值给normalModule._ast
        this._ast =
          typeof extraInfo === "object" &&
          extraInfo !== null &&
          extraInfo.webpackAST !== undefined
            ? extraInfo.webpackAST
            : null;
        // 执行回调函数，并且返回
        return callback()
      }
      // 运行loader
      runLoaders(
        {
          resource: this.resource,
          loaders: this.loaders,
          context: loaderContext,
          processResource: (loaderContext, resource, callback) => {
            // 判断是否存在scheme
          }
        }, 
        (err, result) => {
          this.buildInfo.cacheable = result.cacheable;
          // 把loader编译后的result结果传入processResult生成_source
          processResult(err, result.result);
        }
      ) 
    }
    /**
    * @param {WebpackOptions} options webpack options
    * @param {Compilation} compilation the compilation
    * @param {ResolverWithOptions} resolver the resolver
    * @param {InputFileSystem} fs the file system
    * @param {function(WebpackError=): void} callback callback function
    * @returns {void}
    */
    build(options, compilation, resolver, fs, callback) {
      // 初始化参数
      this.buildInfo = {
        cacheable: false,
        parsed: true,
        fileDependencies: undefined,
        contextDependencies: undefined,
        missingDependencies: undefined,
        buildDependencies: undefined,
        valueDependencies: undefined,
        hash: undefined,
        assets: undefined,
        assetsInfo: undefined
      };
      // 首先会执行doBuild中的代码，才会执行callback中的代码
      return this.doBuild(options, compilation, resolver, fs, err => {
        // 对通过parser.parse处理完成AST代码进行处理
        const handleParseResult = result => {
          // 对依赖进行排序
          this.dependencies.sort(
            concatComparators(
              compareSelect(a => a.loc, compareLocations),
              keepOriginalOrder(this.dependencies)
            )
          );
          // 初始化buildHash hex格式
          this._initBuildHash(compilation);
          this._lastSuccessfulBuildMeta = this.buildMeta;
          return handleBuildDone();
        };
        const handleBuildDone = () => {
          // 对buildInfo.fileDependencies、buildInfo.missingDependencies、buildInfo.contextDependencies中的依赖项进行检测
          // 通过fileSystemInfo读取依赖文件内容
          compilation.fileSystemInfo.createSnapshot(
            startTime,
            this.buildInfo.fileDependencies,
            this.buildInfo.contextDependencies,
            this.buildInfo.missingDependencies,
            snapshotOptions,
            (err, snapshot) => {
              // 重置当前buildInfo 三个依赖项
              this.buildInfo.fileDependencies = undefined;
              this.buildInfo.contextDependencies = undefined;
              this.buildInfo.missingDependencies = undefined;
              // 把snapshot存储到buildInfo中
              this.buildInfo.snapshot = snapshot;
              // 执行回调函数
              callback()
            }
          )
        }
        let result;
        try {
          // 对读取的source来生成AST代码
          result = this.parser.parse(this._ast || this._source.source(), {
            current: this,
            module: this,
            compilation: compilation,
            options: options
          });
        } catch (e) {
          handleParseError(e);
          return;
        }
        // 转换完成进行递归处理
        handleParseResult(result);
      })
    }
  }
```

上面代码执行过程如下：

1. `doBuild`方法内部通过`createLoaderContext`创建`loaderContext`。`loaderContext` 对象和这个 `module` 是**一一对应**的关系，而这个 `module` 所使用的**所有 loaders 都会共享这个 loaderContext 对象**，每个 `loader`执行的时候上下文就是这个 `loaderContext` 对象，所以可以在我们写的 `loader` 里面通过 `this` 来访问。
2. `runLoaders`是`loader-runner`独立的npm包来提供，如果对loader的实现感兴趣的可以看我另一篇文章[loader-runner 详解](./loader.md)。在`runloaders`的回调函数中会返回当前`loader`对`module`代码的解析结果`result`。
3. 在生成`result`之后会调用`processResult`方法，通过`createSource`来生成`_soruce`对象。`createSource`内部判断是要生成的**source类型**，分为三类`RawSource(只包含源码)`、`SourceMapSource(源码内容、sourceMap内容、sourceMap路径)`、`OriginalSource(源码内容、sourceMap路径)`有兴趣可以看一下实现。判断是否生成ast代码，如果存在就保存。执行`doBuild`传入的回调函数。
4. 在`callback`回调函数中，首先通过`parser.parse(source/ast)`来生成`AST(抽象语法树)`，这里的`parser`就是`JavascriptParser`实例，内部也是通过`acorn`来实现。通过`parser.parse`转换的代码已经解析完成`dependencies`，并且把`dependencies`分了为两个数组存储，分别是`blocks(异步依赖)`、`dependencies`同步数组。
5. `parser.parse(source/ast)`执行完成返回`result`对象后，通过`_initBuildHash`创建`buildHash`，处理了`fileDependencies`等依赖文件，执行回调函数。

在执行到`doBuild`回调方法中的`parser.parse`会在回到`compilation`中的`module.build`中的回调函数。