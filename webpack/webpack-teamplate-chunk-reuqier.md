## webapck中module相关

> **webpack版本为 5.28.0**

这片文章记录webpack中和module相关的内容，从`compiler.hooks.make`添加入口文件收集，到`loader`加载执行，再到生成`chunkGraph`然后通过`tempalte`输出chunk文件。

### enhanced-resolve/ResolverFactory

`enhanced-resolve`用来做路径解析，在webpack中的路径解析就是用的`enhanced-resolve`来做的。路径解析的实现是在`ResolverFactory`类中实现的。
 
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
