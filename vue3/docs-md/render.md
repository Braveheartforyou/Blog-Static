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
        // 通过createVNode 创建VNode节点，
        // 如果第二个参数通过isVNode函数判断为VNode类型，把propsOrChildren作为children传入createVNode中
        return createVNode(type, null, [propsOrChildren])
      }
      // props without children
      // 如果第二个参数propsOrChildren不是一个VNode对象，propsOrChildren作为props传入createVNode
      return createVNode(type, propsOrChildren)
    } else {
      // omit props
      // 不满足 propsOrChildren类型为Object，并且不是Array。直接把propsOrChildren当做children传入createVNode
      return createVNode(type, null, propsOrChildren)
    }
  } else {
    // 如果参数超过三个参数的话 进行裁剪参数
    if (l > 3) {
      children = Array.prototype.slice.call(arguments, 2)
    } else if (l === 3 && isVNode(children)) {
      // 参数为个数3，并且children参数类型为VNode，用数组包裹一层children
      children = [children]
    }
    // type类型为标签类型、propsOrChildren 为 props、children为子组件列表
    return createVNode(type, propsOrChildren, children)
  }
}
```

在源码中知道了`h函数`中的执行逻辑，下面就要看`createVNode`中的执行逻辑。

## createVNode函数

源码在： **vue-next(项目) => packages(文件夹) => runtime-core(文件夹) => src (文件夹) => vnode.ts(文件): 313 ~ 453 行。**

```js
// 导出一个createVNode函数
// 如果是dev环境，调用createVNodeWithArgsTransform 对传入参数进行转换
// 返回一个_createVNode函数
export const createVNode = (__DEV__
  ? createVNodeWithArgsTransform
  : _createVNode) as typeof _createVNode

// 进行参数转换返回一个_createVNode
const createVNodeWithArgsTransform = (
  ...args: Parameters<typeof _createVNode>
): VNode => {
  return _createVNode(
    ...(vnodeArgsTransformer
      ? vnodeArgsTransformer(args, currentRenderingInstance)
      : args)
  )
}

// 声明一个_createVNode函数
// 接受6个参数
function _createVNode(
  type: VNodeTypes | ClassComponent | typeof NULL_DYNAMIC_COMPONENT,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null,
  patchFlag: number = 0,
  dynamicProps: string[] | null = null,
  isBlockNode = false
): VNode {
  if (!type || type === NULL_DYNAMIC_COMPONENT) {
    if (__DEV__ && !type) {
      warn(`Invalid vnode type when creating vnode: ${type}.`)
    }
    type = Comment
  }

  if (isVNode(type)) {
    // createVNode receiving an existing vnode. This happens in cases like
    // <component :is="vnode"/>
    // #2078 make sure to merge refs during the clone instead of overwriting it
    const cloned = cloneVNode(type, props, true /* mergeRef: true */)
    if (children) {
      normalizeChildren(cloned, children)
    }
    return cloned
  }

  // class component normalization.
  if (isClassComponent(type)) {
    type = type.__vccOpts
  }

  // class & style normalization.
  if (props) {
    // for reactive or proxy objects, we need to clone it to enable mutation.
    if (isProxy(props) || InternalObjectKey in props) {
      props = extend({}, props)
    }
    let { class: klass, style } = props
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass)
    }
    if (isObject(style)) {
      // reactive state objects need to be cloned since they are likely to be
      // mutated
      if (isProxy(style) && !isArray(style)) {
        style = extend({}, style)
      }
      props.style = normalizeStyle(style)
    }
  }

  // encode the vnode type information into a bitmap
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : __FEATURE_SUSPENSE__ && isSuspense(type)
      ? ShapeFlags.SUSPENSE
      : isTeleport(type)
        ? ShapeFlags.TELEPORT
        : isObject(type)
          ? ShapeFlags.STATEFUL_COMPONENT
          : isFunction(type)
            ? ShapeFlags.FUNCTIONAL_COMPONENT
            : 0

  if (__DEV__ && shapeFlag & ShapeFlags.STATEFUL_COMPONENT && isProxy(type)) {
    type = toRaw(type)
    warn(
      `Vue received a Component which was made a reactive object. This can ` +
        `lead to unnecessary performance overhead, and should be avoided by ` +
        `marking the component with \`markRaw\` or using \`shallowRef\` ` +
        `instead of \`ref\`.`,
      `\nComponent that was made reactive: `,
      type
    )
  }

  const vnode: VNode = {
    __v_isVNode: true,
    [ReactiveFlags.SKIP]: true,
    type,
    props,
    key: props && normalizeKey(props),
    ref: props && normalizeRef(props),
    scopeId: currentScopeId,
    children: null,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag,
    patchFlag,
    dynamicProps,
    dynamicChildren: null,
    appContext: null
  }

  // validate key
  if (__DEV__ && vnode.key !== vnode.key) {
    warn(`VNode created with invalid key (NaN). VNode type:`, vnode.type)
  }

  normalizeChildren(vnode, children)

  // normalize suspense children
  if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
    const { content, fallback } = normalizeSuspenseChildren(vnode)
    vnode.ssContent = content
    vnode.ssFallback = fallback
  }

  if (
    shouldTrack > 0 &&
    // avoid a block node from tracking itself
    !isBlockNode &&
    // has current parent block
    currentBlock &&
    // presence of a patch flag indicates this node needs patching on updates.
    // component nodes also should always be patched, because even if the
    // component doesn't need to update, it needs to persist the instance on to
    // the next vnode so that it can be properly unmounted later.
    (patchFlag > 0 || shapeFlag & ShapeFlags.COMPONENT) &&
    // the EVENTS flag is only for hydration and if it is the only flag, the
    // vnode should not be considered dynamic due to handler caching.
    patchFlag !== PatchFlags.HYDRATE_EVENTS
  ) {
    currentBlock.push(vnode)
  }

  return vnode
}
```

