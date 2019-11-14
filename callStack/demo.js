// "use strict";
// function one () {
//     return two();
// }
// function two () {
//     return three();
// }
// function three () {
//     console.trace();
//     return false;
// }
// one();

// PTC.js
'use strict';

// 计算1-N的累加值（尾递归）
function f(n, sum = 1) {
    if (n <= 1) {
        return sum;
    }
    return f(n - 1, sum + n);
}
const result = f(100000);
console.log(result);