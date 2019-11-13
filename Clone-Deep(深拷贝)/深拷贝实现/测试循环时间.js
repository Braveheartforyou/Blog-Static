// 生成数据
let initData = [];
var len = 100000;
for (let i = 0; i < len; i++) {
    let item = {
        name: 'name',
        age: 18,
        sex: 'man',
        class: 'first'
    };
    initData.push(item);
}
var sum = 0;

// 记录for循环时间
console.time();
for (let i = 0; i < len; i++) {
    sum += initData[i].age;
}
console.timeEnd();

// 记录for...in循环时间
console.time();
for (let item in initData) {
    sum += initData[item];
}
console.timeEnd();

// 记录while循环时间
let i = 0;
console.time();
while (i < len) {
    sum += initData[i].age;
    i++;
}
console.timeEnd();
// 记录forEach循环时间
console.time();
initData.forEach((item, index, soruce) => {
    sum += item;
})
console.timeEnd();