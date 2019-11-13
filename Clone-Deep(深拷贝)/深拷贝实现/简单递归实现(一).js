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
function cloneDeep(target) {
  // 判断是否传入类型为Object
  if (typeof target !== "object") {
    return target;
  }
  // 声明新对象
  let newTarget = getType(target) === "Array" ? [] : {};
  // 循环对象 递归复制给新对象
  for (let key in target) {
    // 判断属性是否在对象本身上
    if (target.hasOwnProperty(key)) {
      // 递归调用
      newTarget[key] = cloneDeep(target[key]);
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
    age: function() {},
    sym: Symbol("setter")
  }
};
const targetArray = [1, 2, 3, { name: "123", age: 789 }];
console.log(cloneDeep(target)); // {val1: 1, val2: undefined, val4: "target", val5: {…}}
console.log(cloneDeep(targetArray)); // [1, 2, 3, {…}]
