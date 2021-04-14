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

内联 loader 可以通过添加不同前缀，跳过其他类型 loader。

`!` 跳过 `normal loader`。
`-!` 跳过 `pre loader` 和 `normal loader`。
`!!` 跳过 `pre loader、 normal loader` 和 `post loader`。

### loader执行阶段

loader执行阶段又分为两个阶段：

- `pitch`阶段
- `normal execution`阶段

> 如果loader存在`pitch方法`才会存在`pitch`阶段；并且`pitch方法`不是必须的方法。
> `pitch` 是 loader 上的一个方法，它的作用是**阻断 loader 链**。

### 同步、异步

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

### ptich


## loader匹配、路径加载


## runloader


