## loader简介

这篇文章中了解一下`webpack`中的`loader`，它是怎么执行的和执行顺序，最后再写一个`loader`来。
`loader`是webpack中也是比较重要的概念，因为**webpack**只能处理`js`类型的代码，比如像`css`就要代码webpack就是不能直接处理的，所以要通过`css-loader`把`css`文件转为`js`代码；`loader`可以看做是一个转换器。

webpack中`loader`路径加载是通过`enhandle-resolve`包来实现的；`loader`的运行是通过`run-loader`来实现的。运行当前模块所有的`loader`时都会传入一个`loaderContext`，在各个loader中都可以通过this来访问这个`loaderContext`。

`loader`运行大致如下图所示：

![loader_flow](./images/loader_flow.png)

### loader执行顺序

`loader`之间的顺序大致分为4种：

- pre： 前置loader
- normal： 普通loader
- inline： 内联loader
- post： 后置loader

4种loader的执行优先级为：`pre > normal > inline > post` 。
相同优先级的loader执行顺序为：`从右到左，从下到上`。

> 所有一个接一个地进入的 loader，都有两个阶段：
>
> 1. Pitching 阶段: loader 上的 pitch 方法，按照 后置(post)、行内(inline)、普通(normal)、前置(pre) 的顺序调用。更多详细信息，请查看 Pitching Loader。
> 2. Normal 阶段: loader 上的 常规方法，按照 前置(pre)、普通(normal)、行内(inline)、后置(post) 的顺序调用。模块源码的转换， 发生在这个阶段。

什么是内联`loader`？相信很多人都没有用过，看一下webpack官方是怎么介绍的。

> "行内 loader"：loader 被应用在 import/require 行内。

`inline loader`有以下几种配置：

- `!前缀`: 在通过`require/import`引入模块的时候，可以通过加上`!前缀`来**禁用普通(normal)loader**.
- `-!前缀`: 在通过`require/import`引入模块的时候，可以通过加上`-!前缀`来**禁用前置(pre) + 普通通(normal)loader**.
- `!前缀`: 在通过`require/import`引入模块的时候，可以通过加上`!!前缀`来**禁用所有loader**.

> 不应使用内联 loader 和 ! 前缀，因为它是非标准的。它们可能会被 loader 生成代码使用。

### loader执行阶段

loader执行阶段又分为两个阶段：

- `pitch`阶段
- `normal execution`阶段

> 如果loader存在`pitch方法`才会存在`pitch`阶段；并且`pitch方法`不是必须的方法。
> `pitch` 是 loader 上的一个方法，它的作用是**阻断 loader 链**。

### 同步loader、异步loader

假定通过`loader runner`运行多个loader，怎么通知`loader runner`应该要执行下一个`loader`了。 `loader`也会分为`同步模式`和`异步模式`，它们的区分其实就是在调用`callback`的方式。

如果想了解loader中更多的属性和配置可以查看[webpack官方配置](https://webpack.docschina.org/api/loaders/)

**同步loader**

同步loader可以通过两种方式来通知`loader runner`已经完成转换，分别是`return source` 和 `this.callback()`来实现。

无论是 `return` 还是 `this.callbac`k 都可以同步地返回转换后的 `content` 值：

`sync-loader.js`

```js
module.exports = function (content, map, meta) {
  return someSyncOperation(content);
};
```

`this.callback`方法则更灵活，因为它允许传递多个参数，而不仅仅是 `content`。

`sync-loader-with-multiple-results.js`

```js

module.exports = function (content, map, meta) {
  this.callback(null, someSyncOperation(content), map, meta);
  return; // 当调用 callback() 函数时，总是返回 undefined
};

```

**异步loader**

对于异步 `loader`，使用 `this.async` 来获取 `callback` 函数：

`async-loader.js`

```js
module.exports = function (content, map, meta) {
  var callback = this.async();
  someAsyncOperation(content, function (err, result) {
    if (err) return callback(err);
    callback(null, result, map, meta);
  });
};
```

> loader 最初被设计为可以在同步 loader pipelines（如 Node.js ，使用 enhanced-require)，以及 在异步 pipelines（如 webpack）中运行。然而，由于同步计算过于耗时，在 Node.js 这样的单线程环境下进行此操作并不是好的方案，我们建议尽可能地使你的 loader 异步化。但如果计算量很小，同步 loader 也是可以的。

### ptich loader

> loader 总是**从右到左**被调用。有些情况下，loader 只关心 request 后面的 **元数据(metadata)**，并且忽略前一个 loader 的结果。在实际**从右到左**执行 loader 之前，会先 **从左到右** 调用 loader 上的 `pitch` 方法。

`pitch`方法不是必须的。如果`loader`中如果存在`pitch`方法，`loader`的执行阶段就会分为两个阶段**pitch阶段**和**normal execution阶段**。

有三个loader: `loader1`、`loader2`、`loader3`，在webpack.config.js中配置三个loader链如下：

```js
  module.exports = {
    module: {
      rules: [{
        use: ['loader1', 'loader2', 'loader3']
      }]
    }
  }
```

`loader`执行过程如下：

![loader_pitch](./images/loader_pitch.png)


在这个过程中如果任何`loader`上的`pitch`方法有返回值，则会跳过后面所有的`loader`执行，直接进入`normal execution`阶段，并且是从`pitch`的上一个`loader`开始。

假设是在`loader2`中的`pitch`方法有返回值，执行过程如下：

## loader匹配、路径加载

首先通过`ResloverFactory`来创建`normalResolver`和`loaderResolver`用来加载文件信息和loader文件信息。接着`normalResolver(entry)`加载入口文件信息，然后通过`ruleSet.exec(resourceData)`来匹配当前`module`所需要的loader，在通过`loaderResolver`来加载`loader`的路径信息，并且通过`loader.type`对要所有的loader进行排序。

## runloader

`runloader`方法是webpack一个独立的npm包，叫做[loader-runner](https://github.com/webpack/loader-runner)。

在webpack[运行loader源码](https://github.com/webpack/webpack/blob/master/lib/NormalModule.js)如下：

```js
  // ./lib/NormalModule.js
  import { runLoaders } = reuqire('loader-runner')
  class NormalModule extends Module {
    // 在doBuild中运行runLoaders
    doBuild (options, compilation, resolver, fs, callback) {
      // 首先创建loaderContext
      // 想了解loaderContext中都有哪些属性的话请看 https://webpack.docschina.org/api/loaders/#the-loader-context
      const loaderContext = this.createLoaderContext(
        resolver,
        options,
        compilation,
        fs
      );
      // 通过runLoaders运行loaders
      runLoaders(
        {
          resource: this.resource, // 这个模块的路径
          loaders: this.loaders, // 模块所使用的 loaders
          context: loaderContext, // loaderContext 上下文
          readResource: fs.readFile.bind(fs) // 读取文件的 node api
        },
        (err, result) => {
          // do something
        }
      )
    }
  }
```

首先会初始化`loaderContext`对象，这个对象是比较重要的，`loadercontext` 表示在 `loader` 内使用 **this 可以访问的一些方法或属性**。

`loaderContext`中比较重要的几个属性：

- `this.callback`: 可以同步或者异步调用的并返回多个结果的函数。
- `this.async`: 告诉 `loader-runner` 这个 loader 将会异步地回调。返回 `this.callback`。
- `this.data`: 在 `pitch 阶段`和 `normal 阶段`之间共享的 `data` 对象。
- `this.loaders`: 所有 `loader 组成`的数组。它在 pitch 阶段的时候是可以写入的。
- `this.loaderIndex`: 当前 loader 在 loader 数组中的**索引**。
- `this.hot`: loaders 的 HMR（热模块替换）相关信息。


