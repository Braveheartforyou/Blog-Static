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
// -> logs 1
```

> watchEffect 不支持 `immediate`、`deep`传入，如果传入会弹出警告，测试环境

### flush入参

`flush`可以赋值为三个值分别为：`'pre'、‘post’、‘sync’`.

- `pre`: 在render执行前执行 (默认值)
- `post`: 在render执行之后执行
- `sync`: 同步执行

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

> watch 不支持 传入`flush`属性

### WatchOptions参数

watchOptions是一个对象包含两个属性`{ immediate: Boolean, deep: Boolean }`， `immediate`表示是否立即执行，`deep`表示是否深度观测。

> 注意watch的source 必须是一个reactive对象、一个ref对象、一个数组；或者 getter/effect Functions 其中一个
watch在侦听`一个reactive对象`和`一个ref对象`执行结果并不相同，在vue 3.0的文档中也没有看到相关的描述。

### reactive对象

传入一个`reactive对象`代码如下：

```js
  const state = reactive({
    name: 'Joe',
    age: 18
  })
  watch(
    state,
    (state, preState) => {
      console.log('state, preState: ', state.age, preState.age); // state.age: 19, preState.age: 19
    }
  )
  state.age++
```

在使用`reactive对象`时，会发`state`，`preState`都为 19.

### ref对象

传入一个`ref对象`代码如下：

```js
  const state = ref(0)
  watch(
    state,
    (state, preState) => {
      console.log('state, preState: ', state, preState); // state.age: 2, preState.age: 1
    }
  )
  state.value++
```

侦听`watch对象`和侦听`ref对象` 显示的结果不相同。

### 侦听多个source

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

## 共同行为

- 停止侦听
- 清除副作用（清除回调函数）


### 停止侦听

当 `watchEffect/watch` 在组件的 `setup() 函数`或`生命周期钩子`被调用时，侦听器会被链接到该组件的生命周期，并在组件卸载时`自动停止`。

在一些情况下，也可以显式调用返回值以停止侦听：

```js
const stop = watchEffect(() => {
  /* ... */
})

// later
stop()
```

### 清除副作用（清除回调函数）

有时候当观察的数据源变化后，我们可能需要对之前所执行的副作用进行清理。举例来说，一个异步操作在完成之前数据就产生了变化，我们可能要撤销还在等待的前一个操作。为了处理这种情况，watchEffect 的回调会接收到一个参数是用来注册清理操作的函数。调用这个函数可以注册一个清理函数。清理函数会在下属情况下被调用：

- 副作用即将重新执行时
- 侦听器被停止(如果在`setup()`或`生命周期钩子函数`中使用了watchEffect,则在卸载组件时)

我们之所以是通过传入一个函数去注册失效回调，而不是从回调返回它（如 React useEffect 中的方式），是因为返回值对于异步错误处理很重要。

```js
const data = ref(null)
watchEffect(async (id) => {
  data.value = await fetchData(id)
})
```

`async function` 隐性地返回一个 `Promise` - 这样的情况下，我们是无法返回一个需要被立刻注册的清理函数的。除此之外，回调返回的 `Promise` 还会被 `Vue` 用于内部的异步错误处理。
在实际应用中，在大于某个频率（请求 pending状态）操作时，可以先取消之前操作，节约资源：
下面是一个用户输入"防抖"效果的示例：

```js
<template>
   <input type="text" v-model="keyword">
</template>

<script>
import { ref, watchEffect } from 'vue'

export default {
  setup() {
    const keyword = ref('')
    const asyncPrint = val => {
      return setTimeout(() => {
        console.log('user input: ', val)
      }, 1000)
    }

    watchEffect(
      onInvalidate => {
        //每一次被触发的时候都会先执行onInvalidate内部逻辑,然后执行onInvalidate外部的逻辑
        // keyword 改变时 或 停止侦听时
        // 取消之前的异步操作
        const timer = asyncPrint(keyword.value)
        onInvalidate(() => clearTimeout(timer))
        console.log('keyword change: ', keyword.value)
      },
      {
        flush: 'post' // 默认'post'，同步'sync'，'pre'组件更新之前
      }
    )

    return {
      keyword
    }
  }
}
</script>
```

