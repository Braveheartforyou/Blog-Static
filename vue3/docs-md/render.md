## render函数

可以不使用`template`模板，在`setup函数`中使用`render函数`和`h(createElement)函数`创建动态模板。

### h 函数

`h函数`就是`createElement`函数，返回一个`虚拟节点（VNode）对象`，包含了要渲染节点的信息。可以接受三个参数：`type`、`props`、`children`.

- `type参数`类型可以是`String | Object | Function`，简单来讲就是 HTML 标签名、组件或异步组件。使用返回 null 的函数将渲染一个注释。**此参数是必需的**。
- `props参数`类型可以是`Object`，简单来讲就是一个对象，与我们将在模板中使用的 attribute、prop 和事件相对应。**可选**。
- `children参数`类型可以是`String | Array | Object`，简单来讲就是子代 VNode，使用 h() 生成，或者使用字符串来获取“文本 VNode”，或带有插槽的对象。**可选**。

### 使用render函数

`render函数`基本上是结合`h函数`进行使用的，使用示例如下所示：

```js
  import { createApp, render, h } from 'vue'
  const app = createApp({
    data () {
      return {
        title: 'hello world'
      }
    },
    render () {
      return h(
        'h1', // 标签名称
        this.title // 标签内容
      )
    }
  })
  app.mount('#app')
```

`render函数`在Vue 3.0中基本上可以用来代替`template模块`，如果两个同时存在还是`render函数`的优先级高。

## h函数源码简析

源码在： **vue-next(项目) => packages(文件夹) => runtime-core(文件夹) => src (文件夹) => h.ts(文件): 161 ~ 184 行。**

```js
// Actual implementation
export function h(type: any, propsOrChildren?: any, children?: any): VNode {
  // 获取入参个数，type为必传参数
  const l = arguments.length
  // 只传了两个参数
  if (l === 2) {
    // propsOrChildren 判断类型为 Object 并且 不是 Array
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // single vnode without props
      // 如果传入的第二个参数是一个 VNode节点
      if (isVNode(propsOrChildren)) {
        // 通过createVNode 创建VNode节点
        return createVNode(type, null, [propsOrChildren])
      }
      // props without children
      return createVNode(type, propsOrChildren)
    } else {
      // omit props
      return createVNode(type, null, propsOrChildren)
    }
  } else {
    if (l > 3) {
      children = Array.prototype.slice.call(arguments, 2)
    } else if (l === 3 && isVNode(children)) {
      children = [children]
    }
    return createVNode(type, propsOrChildren, children)
  }
}
```