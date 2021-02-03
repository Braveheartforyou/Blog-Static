## shallowReactive

**源码在： vue-next(项目) => packages(文件夹) => reacitvity(文件夹) => src (文件夹) => reactive.ts(文件): 103 ~ 110 行。**

```js

export function shallowReactive<T extends object>(target: T): T {
 return createReactiveObject(
 target,
 false,
 shallowReactiveHandlers,
 shallowCollectionHandlers
 )
}
```

主要关注 `shallowReactiveHandlers` 方法， 在同目录底下`baseHandlers.ts` 文件中声明 *217 ~ 224* 行。

```js
export const shallowReactiveHandlers: ProxyHandler<object> = extend(
 {},
 mutableHandlers,
 {
 get: shallowGet,
 set: shallowSet
 }
)
```

主要关注 设置的 `get: sahllowGet` 方法， `sahllowGet` 在同文件下 *36* 行，调用 `createGetter(false, true)` 方法 .

- 第一个参数表示 是否为 `isReadonly` 是为只读模式；
- 第二个参数表示 是否为 `shallow` 只做浅层代理。

`createGetter`方法在同文件夹底下的 72行到124结束

```js

function createGetter(isReadonly = false, shallow = false) {
 return function get (target: Target, key: string | symbol, receiver: object) {
     // ...省略

   const res = Reflect.get(target, key, receiver)
   if (shallow) {
       return res
    }
     //  ...省略
 }
}
```

如果`shallow`传入为 `true`的话就会返回 一个 `res (新创建的浅响应对象)`。