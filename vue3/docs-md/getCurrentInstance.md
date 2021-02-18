## getCurrentInstance

`geuCurrentInstance`可以用来获取内部组件的实例，主要用于高阶用法或库的开发。

`getCurrentInstance`可以用来获取当前实例和当前实例上的一些属性。也可以获挂载的根组件的属性。

```js
import { setup, getCurrentInstance } from 'vue'

export default {
  setup () {
    const instanceDef = getCurrentInstance()
    console.log(instanceDef)
    instanceDef = {
      accessCache: {}, // 当前组件缓存
      // Vue实例化对象，通过createApp创建的实例
      appContext: { 
        app: {}, // 根节点组件
        config: {}, // 全局配置的config
        components: {}, // 子组件列表
        directives: {}, // 自定义指令集
        mixins: {}, // 全局混入
        provides: {}, // 全局提供者
        reload: () => {}
      },
      attrs: {}, // 当前组件属性
      ctx: {}, // 当前组件一些属性和方法
      emit: function () {}, // 广播事件
      parent: {}, // 父组件实例
      props: {}, // Reactive对象
      propsOptions: {}, // props配置
      render: funtion () {}, // render函数
      slots: {}, // solts对象
      subTree: {}, // vnode树状结构
      update: function reactiveEffect {....}, // 触发更新
      vnode: {} // 虚拟dom节点
    }
  }
}

```

上面大致介绍了`getCurrentInstance`可以获取很多当前组件和实例上的方法、属性。