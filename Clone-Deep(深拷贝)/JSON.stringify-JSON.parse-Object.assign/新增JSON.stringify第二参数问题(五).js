// 数据类型判断
function getType(attr) {
  let type = Object.prototype.toString.call(attr);
  let newType = type.substr(8, type.length - 9);
  return newType;
}
// 转换函数
function StringIfy(obj, replacer) {
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
    // 判断属性是否可枚举
    if (obj.hasOwnProperty(key)) {
      // console.log(key, item);

      // 获取属性并且判断属性值类型
      let item = obj[key];

      let flag = true;
      // 获取第二个参数
      if (replacer) {
        switch (getType(replacer)) {
          case 'Function':
            flag = replacer(key, item);
            break;
          case 'Array':
            flag = replacer.indexOf(key) !== -1;
            break;
        }
      }
      if (!flag) {
        return false;
      }
      if (item === obj) {
        console.error(
          new TypeError("Converting circular structure to JSON")
        );
        return false;
      }
      if (/Symbol|Function|Undefined/.test(getType(item))) {
        delete obj[key];
        continue;
      }
      // 如果为object类型递归调用
      if (getType(item) === "Object") {
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
      json.push(
        (arr ? IsQueto : '"' + key + '": "') + String(item) + IsQueto
      );
    }
  }
  console.log(arr, String(json));
  // 转换数组字段为字符串
  return (arr ? "[" : "{") + String(json) + (arr ? "]" : "}");
}
// 反序列化函数
function ParseJson(opt) {
  return eval("(" + opt + ")");
}
function ParseJsonTwo(opt) {
  return new Function("return " + opt)();
}
// let aa = StringIfy([1, 2, 4]);
// console.log(ParseJson(aa));
// console.log(ParseJsonTwo(aa));
let oJson = {
  name: "oJson",
  age: 20,
  sex: "man",
  calss: "one"
};
JSON.stringify(oJson, ["sex", "name"]); // "{"sex":"man","name":"oJson"}"
// 两个参数 key/value的形式
JSON.stringify(oJson, function(key, value) {
  if (typeof value === "string") {
    return undefined;
  }
  return value;
}); // "{"age":20}"