## computed

computed是一个函数，可以接受一个入参：

- 可以是一个**函数**，那个这个函数要符合`getter`函数，必须要有返回值。作用域问题要使用**箭头函数**。
- 可以是一个**对象**，这个对象要有`get`、`set`函数，`get`和`set`也都要扶着`getter`和`setter`的使用方式

返回一个`不变的响应式ref对象`。

> 注意：
`computed` 返回的`ref`对象，是一个特殊的`ComputedRef 类型`的 `ref对象`，这个对象的`value`值**不能修改**.
如果想修改返回的`ref`对象，可以通过传入`{ get: Function, set: Function }` 来设置`set`函数执行逻辑

## 示例代码

### 传入getter函数

```javascript

const count = ref(1) 
const stateCompute = computed(() => count.value + 1)
watchEffect(() => {
    console.log('watchEffect', stateCompute)
 })
 count.value = 3
 count.value = 6
 console.log(stateCompute.value)
```

### 传入{ get: () => {}, set: () => {} } 对象

```javascript

const count = ref(1) 
const stateCompute = computed({
   get: () => count.value + 1,
   set: value => {
       count.value = value - 1
   }
})
watchEffect(() => {
    console.log('watchEffect', stateCompute)
 })
 console.log(stateCompute.value)
 stateCompute.value = 6
 console.log(stateCompute.value)

```

## 源码简析

源码在： **vue-next(项目) => packages(文件夹) => reacitvity(文件夹) => src (文件夹) => computed.ts(文件): 64 ~ 92 行。**

```js
export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>
export function computed<T>(options: WritableComputedOptions<T>): WritableComputedRef<T>
// computed方法传入一个 getterOrOptions，这个值可以为 ComputedGetter 或者 WritableComputedOptions类型的
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
) {
  // 声明 getter、setter方法，方法的格式是ComputedGetter 类型的
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T>
  // 通过isFunction校验参数getterOrOptions 是否为一个方法； isFunction 就是通过 (typeof getterOrOptions) === ‘function’
  if (isFunction(getterOrOptions)) {
    // 如果getterOrOptions是一个函数，就把getterOrOptions 赋值给 getter
    getter = getterOrOptions
    // setter在测试环境调用执行内部警告
    setter = __DEV__
      ? () => {
          console.warn('Write operation failed: computed value is readonly')
        }
      : NOOP
  } else {
    // 如果getterOrOptions不是一个函数，就把getterOrOptions.get 赋值给 getter； 把getterOrOptions.set 赋值给setter
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }
  // 再返回一个 新的 ComputedRefImpl 实例 ，入参 刚才赋值的getter 和 setter ， isFunction(getterOrOptions) || !getterOrOptions.set 判断入参为 true or false
  return new ComputedRefImpl(
    getter,
    setter,
    isFunction(getterOrOptions) || !getterOrOptions.set
  ) as any
}

```

接下来主要关注 ComputedRefImpl 类的实现，在同文件下 23 ~ 48行，代码如下：

```js
class ComputedRefImpl<T> {
  private _value!: T
  private _dirty = true

  public readonly effect: ReactiveEffect<T>

  public readonly __v_isRef = true;
  public readonly [ReactiveFlags.IS_READONLY]: boolean
  // 构造函数传入三个参数 getter setter isReadonly
  constructor(
    getter: ComputedGetter<T>,
    // 默认_setter 是一个只读模式
    private readonly _setter: ComputedSetter<T>,
    isReadonly: boolean
  ) {
    // effect 方法会创建 一个 reactiveEffect 函数，这个函数会进行收集依赖； 但是因为 这里传入了scheduler 所以会直接返回 scheduler 函数
    this.effect = effect(getter, {
      // lazy 为 false 会默认执行一次依赖收集
      lazy: true,
      scheduler: () => {
        // 如果当前对象的_dirty 为false的话 执行以下方法
        if (!this._dirty) {
          // _dirty 设置为 true
          this._dirty = true
          // 通过trigger进行更新操作，更新value的值
          trigger(toRaw(this), TriggerOpTypes.SET, 'value')
        }
      }
    })

    this[ReactiveFlags.IS_READONLY] = isReadonly
  }
  // 拦截get value 的值
  get value() {
    // 如果是在_dirty 为true, 执行下面操作
    if (this._dirty) {
      // 当前的this._value 为 this.effect()会执行上面定义的 trigger
      this._value = this.effect()
      // 设置this._dirty 为 false
      this._dirty = false
    }
    // 通过track 进行依赖手机
    track(toRaw(this), TrackOpTypes.GET, 'value')
    // 返回当前的值
    return this._value
  }
  // 拦截set value 操作
  set value(newValue: T) {
    // 执行传入的或者默认的_setter操作
    this._setter(newValue)
  }
}
```

所以`new ComputedRefImpl()`会返回一个拦截了value 属性的 `get`、`set`方法特殊的`ComputedRef`对象。

`ComputedRef`对象，会收集传入`内部getter`的依赖，默认不能修改`value`的值，如果想修改`value`的值，要传入`setter`方法.