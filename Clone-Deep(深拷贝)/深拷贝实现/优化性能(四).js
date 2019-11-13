// <!------------工具函数开始----------------------------!>
// 创建数据
function createData(deep, breadth) {
  var data = {};
  var temp = data;

  for (var i = 0; i < deep; i++) {
    temp = temp["data"] = {};
    for (var j = 0; j < breadth; j++) {
      temp[j] = j;
    }
  }
  return data;
}
// 封装循环函数
function arrayEach(array, iteratee) {
  let index = -1;
  // 获取数组长度
  const length = array.length;
  // 循环体
  while (++index < length) {
    // 执行回调
    if (iteratee(array[index], index, array) === false) {
      break;
    }
  }
  return array;
}
// 获取类型
function getType(attr) {
  let type = Object.prototype.toString.call(attr);
  let newType = type.substr(8, type.length - 9);
  return newType;
}
// 判断是否为引用类型
function isObject(value) {
  // 储存传入值的类型
  const type = typeof value;
  // 过滤null
  return value != null && (type === "object" || type === "function");
}
// 克隆function
function cloneFunc(value) {
  const isFunc = typeof value === "function";
  if (isFunc) {
    return value;
  }
}

// 克隆symbol
function cloneSymbol(symbol) {
  // 保存方法
  const symbolValueOf = Symbol.prototype.valueOf;
  // 返回key
  return Object(symbolValueOf.call(symbol));
}

// 克隆RegExp
function cloneRegExp(regexp) {
  const reFlags = /\w*$/;
  const result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
  result.lastIndex = regexp.lastIndex;
  return result;
}

// 不可循环的类型 Number/String/Date/Boolean
function cloneStatic(target) {
  // 获取构造函数
  const Ctor = target.constructor;
  // 实例化一个同类型的属性
  return new Ctor(target);
}
// <!------------工具函数结束----------------------------!>
// <!------------克隆逻辑开始----------------------------!>
// 声明一个函数
function cloneDeep(target, map = new WeakMap()) {
  // 判断类型
  // console.log(isObject(target));
  if (!isObject(target)) {
    return target;
  }
  // console.log(111);
  let newTarget = {};
  switch (getType(target)) {
    case "Number":
    case "String":
    case "Boolean":
    case "Date":
      return cloneStatic(target);
    case "RegExp":
      return cloneRegExp(target);
    case "Function":
      return cloneFunc(target);
    case "Array":
      newTarget = [];
      break;
    case "Map":
      newTarget = new Map();
      break;
    case "Set":
      newTarget = new Set();
      break;
  }

  // 查询map中是否有存在原对象（target），如果存在直接返回
  if (map.has(target)) {
    return target;
  }
  // 如果map中不存在原对象（target），则储存进map中
  map.set(target, newTarget);

  // 拷贝Map
  if (getType(target) === "Map") {
    // 循环复制到新Map
    target.forEach((value, key) => {
      // 因为值有可能是一个对象、数组，所以要递归调用
      newTarget.set(key, cloneDeep(value, map));
    });
    return newTarget;
  }
  // 拷贝Set
  if (getType(target) === "Set") {
    // 循环复制到新Map
    target.forEach((value, key) => {
      // 因为值有可能是一个对象、数组，所以要递归调用
      newTarget.add(key, cloneDeep(value, map));
    });
    return newTarget;
  }

  // // 循环对象 递归复制给新对象
  // for (let key in target) {
  //   // 判断属性是否在对象本身上
  //   if (target.hasOwnProperty(key)) {
  //     // 递归调用
  //     newTarget[key] = cloneDeep(target[key], map); // <!------新增代码 参数map------!>
  //   }
  // }
  const keys = getType(target) === "Array" ? undefined : Object.keys(target);
  arrayEach(keys || target, (value, key) => {
    if (keys) {
      key = value;
    }
    newTarget[key] = cloneDeep(target[key], map);
  });
  // 返回新对象
  return newTarget;
}
// <!------------克隆逻辑结束----------------------------!>

// 测试代码

// 实例化symbol
let oneSymbol = Symbol("name");
// 实例化Map
let newMap = new Map();
newMap.set("name", { name: "everybody" });
// 实例化Set
let newSet = new Set();
newSet.add("age", { age: 18 });
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
  },
  val32: new Boolean(true),
  val23: new String(true),
  val443: new Number(true),
  date: new Date(),
  reg: /\d+/,
  empty: null,
  newMap,
  newSet,
  arrowFunc: () => {
    console.log("test111");
  },
  deepObj: createData(10, 100)
};
target[oneSymbol] = "name";
console.time();
const ss = cloneDeep(target);
console.timeEnd();

console.log(ss);
