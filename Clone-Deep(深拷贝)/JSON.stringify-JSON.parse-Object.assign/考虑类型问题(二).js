// 数据类型判断
function getType(attr) {
  let type = Object.prototype.toString.call(attr);
  let newType = type.substr(8, type.length - 9);
  return newType;
}

// 转换函数
function StringIfy(obj) {
  // 如果是非object类型 or null的类型直接返回 原值的String
  if (typeof obj !== "object" || getType(obj) === null) {
    return String(obj);
  }
  // 声明一个数组
  let json = [];
  // 判断当前传入参数是对象还是数组
  let arr = obj ? getType(obj) === "Array" : false;
  // 循环对象属性
  for (let key in obj) {
    // 判断属性是否在对象本身上
    if (obj.hasOwnProperty(key)) {
      // 获取属性并且判断属性值类型
      let item = obj[key];
      if (/Symbol|Function|Undefined/.test(getType(item))) {
        delete obj[key];
        continue;
     }
      // 如果为object类型递归调用
      if (getType(obj) === "Object") {
        // consoarrle.log(item)
        item = StringIfy(item);
      }
      let IsQueto =
        getType(item) === "Number" ||
        getType(item) === "Boolean" ||
        getType(item) === "Null"
          ? ""
          : '"';
      // 拼接数组字段
      json.push((arr ? IsQueto : '"' + key + '": "') + String(item) + IsQueto);
    }
  }
  console.log(arr, String(json));
  // 转换数组字段为字符串
  return (arr ? "[" : "{") + String(json) + (arr ? "]" : "}");
}

// 测试代码
StringIfy({ name: { name: "abc" } }); // "{"name": "{"name": "abc"}"}"
StringIfy([1, 2, 4]); // "["1","2","4"]"
