/*
 * @Descripttion: 
 * @Author: 19080088
 * @Date: 2021-01-18 11:48:52
 * @LastEditors: 19080088
 * @LastEditTime: 2021-01-18 14:13:05
 */

const {
  SyncHook,
  AsyncSeriesHook
} = require('tapable');

module.exports = class Compiler {
  constructor () {
    this.hooks = {
      accelerate: new SyncHook(['newspeed']),
      brake: new SyncHook(),
      calculateRoutes: new AsyncSeriesHook(["source", "target", "routesList"])
    }
  }

  run () {
    this.accelerate(10);
    this.brake();
    this.calculateRoutes('Async', 'hook', 'demo');
  }

  brake () {
    // 触发同步钩子 brake
    this.hooks.brake.call();
  }

  accelerate (speed) {
    // 触发同步钩子 accelerate
    this.hooks.accelerate.call(speed);
  }

  calculateRoutes () {
    // 触发异步钩子 calculateRoutes
    this.hooks.calculateRoutes.promise(...arguments).then(() => {
    }, err => {
      console.error('err: ', err);
    })
  }
}