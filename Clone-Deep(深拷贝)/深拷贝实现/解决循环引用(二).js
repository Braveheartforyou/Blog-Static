/**
 * 获取当前类型
 * @param {All} attr 可以为任意类型的值
 * @return {String} newType 返回一个类型字符串
 * @example (getType(null) === 'Object') ===> true
 */
function getType(attr) {
  let type = Object.prototype.toString.call(attr);
  let newType = type.substr(8, type.length - 9);
  return newType;
}

/**
 * 递归实现深拷贝
 * @param {Object} target 要拷贝的对象
 * @return {Object} newTarget 拷贝生成的对象
 */
function cloneDeep(target, map = new WeakMap()) {
  // 判断是否传入类型为Object
  if (typeof target !== "object") {
    return target;
  }
  // 声明新对象
  let newTarget = getType(target) === "Array" ? [] : {};

  // <!------新增代码开始------!>
  // 查询map中是否有存在原对象（target），如果存在直接返回
  if (map.get(target)) {
    return target;
  }
  // 如果map中不存在原对象（target），则储存进map中
  map.set(target, newTarget);
  // <!------新增代码结束------!>

  // 循环对象 递归复制给新对象
  for (let key in target) {
    // 判断属性是否在对象本身上
    if (target.hasOwnProperty(key)) {
      // 递归调用
      newTarget[key] = cloneDeep(target[key], map);
    }
  }
  // 返回新对象
  return newTarget;
}

// 测试代码

const target = {
  val1: 1,
  val2: undefined,
  val4: "target",
  val5: {
    name: "target",
    age: function() {
      console.log("永远18岁");
    },
    sym: Symbol("setter")
  }
};

target.target = target;
console.log(cloneDeep(target)); // 不会报错
