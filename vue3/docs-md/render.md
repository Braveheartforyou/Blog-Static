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
  const app 
```