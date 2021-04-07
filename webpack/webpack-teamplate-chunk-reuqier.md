## webapck中module相关

> **webpack版本为 5.28.0**

这片文章记录webpack中和module相关的内容，从`compiler.hooks.make`添加入口文件收集，到`loader`加载执行，再到生成`chunkGraph`然后通过`tempalte`输出chunk文件。

### enhanced-resolve/ResolverFactory

`enhanced-resolve`用来做路径解析，在webpack中的路径解析就是用的`enhanced-resolve`来做的。路径解析的实现是在`ResolverFactory`类中实现的。

webpack中的`ResolverFactory.js`主要是参数解析和初始化插件，`enhanced-resolve`内部的实现先不关注，直接看`ResolverFactory.js`内部的代码实现。

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

真正的`resolver`实例并没有在一开始就实例化，`ResolverFactory`的实例创建实在`compiler`实例化中。在`compiler`实例化之后在通过`createNormalModuleFactory`创建`NormalModuleFactory`实例的时候传入进去。代码如下：

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
        传入ResolverFactory工厂函数
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
