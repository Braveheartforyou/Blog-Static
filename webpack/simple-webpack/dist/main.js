
      (function(modules) {
        function require(fileName) {
          const fn = modules[fileName];

          const module = { exports: {} };

          fn(require, module, module.exports);

          return module.exports;

        }
        require('/Users/admin/Desktop/velen/student/Blog-Static/webpack/simple-webpack/src/index.js');
      })({'/Users/admin/Desktop/velen/student/Blog-Static/webpack/simple-webpack/src/index.js': function (require, module, exports) { "use strict";

var _greeting = require("./greeting.js");

document.write((0, _greeting.greeting)('Jane')); /*
                                                  * @Descripttion: 
                                                  * @Author: 
                                                  * @Date: 2021-01-17 13:18:20
                                                  * @LastEditors: Please set LastEditors
                                                  * @LastEditTime: 2021-01-17 22:28:17
                                                  */ },'./greeting.js': function (require, module, exports) { "use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.greeting = greeting;
/*
 * @Descripttion: 
 * @Author: 
 * @Date: 2021-01-17 13:18:31
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2021-01-17 13:19:29
 */
function greeting(name) {
  return 'hello' + name;
} },})
    