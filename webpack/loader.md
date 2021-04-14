## loader

这篇文章中了解一下`webpack`中的`loader`，它是怎么执行的和执行顺序，最后再写一个`loader`来。
`loader`是webpack中也是比较重要的概念，因为**webpack**只能处理`js`类型的代码，比如像`css`就要代码webpack就是不能直接处理的，所以要通过`css-loader`把`css`文件转为`js`代码；`loader`可以看做是一个转换器。

webpack中`loader`路径加载是通过`enhandle-resolve`包来实现的；`loader`的运行是通过`run-loader`来实现的。运行当前模块所有的`loader`时都会传入一个`loaderContext`，在各个loader中都可以通过this来访问这个`loaderContext`。