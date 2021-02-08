## provide/inject

在`setup()`中使用`provide`，`provide/inject`类似React中的context，可以提供一个传到深层嵌套的子组件数据的方法。和SFC中的使用方式还是有点不同。

### 传入响应式对象

`provide`函数允许你通过两个参数定义property:

1. property的name(String类型)
2. property的value

`inject`函数又两个参数：

1. 要`inject`的`property`的名称
2. 一个默认的值（可选）

两个组件，一个是父组件`parent.vue`和子组件`children.vue`，在`parent.vue`中通过`provide`提供数据，`children.vue`中通过`inject`来接受数据。

`parent.vue`代码如下：

```html
<template>
  <div style="border: 10px solid red">
    <div>{{theme.name}}</div>
    <div>{{theme.color}}</div>
    <!-- 两秒之后改变 -->
    <div>{{state}}</div>
    <children />
  </div>
</template>

<script>
import { reactive, ref, provide } from 'vue'
import children from './children'
export default {
  name: '',
  components: {
    children
  },
  setup () {
    // 创建响应式对象
    const theme = reactive({
      name: 'drak',
      color: 'block'
    })
    // 创建响应式对象
    const state = ref(0)
    // 通过provide
    provide('theme', theme)
    provide('count', state)
    // 传入的值是响应式的
    setTimeout(() => {
      state.value = 2
    }, 2000)
    return {
      theme,
      state
    }
  }
};
</script>

```

`children.vue`代码如下：

```html
<template>
  <div>{{theme.color}}</div>
  <div>{{theme.name}}</div>
  <!-- 两秒之后改变 -->
  <div>{{count}}</div>
</template>

<script>
import { inject } from 'vue'
export default {
  name: 'children',
  setup () {
    const count = inject('count')
    const theme = inject('theme')
    return {
      count,
      theme
    }
  }
};
</script>
```

如果`provide`提供的是**响应式对象**，那么它的子组件中接受的值也是**响应式**的。

> 在注入者组件内部不要修改提供者提供的响应式对象。建议尽可能，在提供者内保持响应式 property 的任何更改。

### 修改响应式对象

修改响应式对象，尽可能的都在`提供者组件(provide)`内部修改，如果在`注入者组件(inject)`内部修改`提供者组件(provide)`提供的数据就会报错。

```js
children.vue?79da:23 Uncaught (in promise) TypeError: Cannot set property 'count' of undefined
    at setup (children.vue?79da:23)
```

如果我们想修改`提供者组件(provide)`提供的响应式对象，要怎么做？

可以再提供一个`updateCount`函数，来支持修改响应式对象。修改代码如下：

`parent.vue`

```html
  <template>
  <div style="border: 10px solid red">
    <div>{{theme.name}}</div>
    <div>{{theme.color}}</div>
    <div>{{state}}</div> // 点击之后变为 22
    <children />
  </div>
</template>

<script>
import { reactive, ref, provide, readonly } from 'vue'
import children from './children'
export default {
  name: '',
  components: {
    children
  },
  setup () {
    const theme = reactive({
      name: 'drak',
      color: 'block'
    })
    const state = ref(0)
    provide('theme', readonly(theme))
    provide('count', readonly(state))
    // 新增一个更新count的值
    const updateCount = (newCount) => {
      state.value = newCount
    }
    provide('updateCount', updateCount)
    return {
      theme,
      state
    }
  }
};
</script>
```

`children.vue`修改

```html
<template>
  <div>{{theme.color}}</div>
  <div>{{theme.name}}</div>
  <div>{{count}}</div> // 点击之后变为 22
  // 触发更新时间
  <button @click="updateCount(22)">更新count值</button>
</template>

<script>
import { inject } from 'vue'
export default {
  name: 'children',
  setup () {
    const count = inject('count')
    const theme = inject('theme')
    const updateCount = inject('updateCount')
    return {
      count,
      theme,
      updateCount
    }
  }
};
</script>
```

通过传入一个更新响应式对象的方法实现对`提供者组件(provide)`中的数据进行修改。

> 注意： 对provide 提供的响应式对象尽量通过readonly包裹，防止再子组件中修改。