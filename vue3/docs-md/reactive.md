## reactive

**源码在：  vue-next(项目) => packages(文件夹) => reacitvity(文件夹) => src (文件夹) => reactive.ts(文件): 84 ~ 96 行。**

```js

export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>
export function reactive(target: object) {
 // if trying to observe a readonly proxy, return the readonly version.
 
 if (target && (target as Target)[ReactiveFlags.IS_READONLY]) 
{
    return target
 }
 return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers
  )
}
```

1. 传入一个对象是否为能被转换为响应的对象
2. 如果是一个对象 首先检测对象是否被标记为 只读对象`（ReactiveFlags.IS_READONLY）`如果是只读对象，就返回当前对象。
3. 如果不是只读对象，就调用 `createReactiveObject` 方法，并且入参 `createReactiveObject( target, false, mutableHandlers, mutableCollectionHandlers ) `这里就不展开记录了，大概就是通过递归这个对象调用`new Proxy()` 传入不同的参数
