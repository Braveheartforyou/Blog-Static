## watchEffect使用

watchEffect是一个函数，接受两个参数，一个是`effect：WatchEffect`对象，另一个是`options：WatchOptionsBase`。

```js
  export type WatchEffect = (onInvalidate: InvalidateCbRegistrator) => void
  export interface WatchOptionsBase {
    flush?: 'pre' | 'post' | 'sync'
    onTrack?: ReactiveEffectOptions['onTrack']
    onTrigger?: ReactiveEffectOptions['onTrigger']
  }

  // Simple effect.
  export function watchEffect(
    effect: WatchEffect,
    options?: WatchOptionsBase
  ): WatchStopHandle {
    return doWatch(effect, null, options)
  }
```

watchEffect不需要指定要侦听的对象，会里自动收集`effect函数`中使用到的响应式对象的依赖，并且会自动执行一次`effect函数`。

watchEffect中的回调函数是惰性执行。

```js

const count = ref(0)

watchEffect(() => console.log(count.value))
// -> logs 0  

count.value++
// -> logs 0
```

## watch

`setup`中的`watch`和`component`上的`$watch`是相同的。`watch`需要指定侦听特定的数据源，并在回调函数中执行操作。`watch`帧听一个源或者多个源。代码实例如下：

```js
  const state = reacive({
    count: 0
  })

  watch(
    () => state.count, // 第一个参数只能是 一个reactive对象、一个ref对象、一个数组；或者 getter/effect Functions
    (state, preState) => {
      console.log('state, preState: ', state, preState);
      // 'state, preState: ' 1, 0
    }
  )
  state.count++
```

> 注意watch的source 必须是一个reactive对象、一个ref对象、一个数组；或者 getter/effect Functions 其中一个

`watch`也支持侦听多个source，如下：

```js
  const state = reacive({
    sum: 0
  })
  const count = ref(0)
  watch(
    [state, count], // 第一个参数只能是 一个reactive对象、一个ref对象、一个数组；或者 getter/effect Functions
    ([state, preState], [count, preCount]) => {
      console.log('state, preState: ', state.count, preState, count.count, preCount);
    }
  )
  state.sum++ // HelloWorld.vue?fdab:83 state, preState:  1 0 1 0
  count.value++
  state.count++ // HelloWorld.vue?fdab:83 state, preState:  1 0 1 0
  count++ // state, preState:  1 1 1 0

```