/*
 * @Descripttion: 
 * @Author: 19080088
 * @Date: 2021-01-18 10:51:18
 * @LastEditors: 19080088
 * @LastEditTime: 2021-01-18 11:57:17
 */

const { 
  SyncHook,
  AsyncSeriesHook,
  AsyncParallelHook
} = require('tapable');

// 实例化同步事件 hooks
const hooks = new SyncHook(['arg1', 'arg2', 'arg3']);

// 绑定hooks执行，调用名为‘hook1’的函数
hooks.tap('hook2', (arg1, arg2, arg3) => {
  console.log('arg1, arg2, arg3: hook2', arg1, arg2, arg3);
});
// 绑定hooks执行，调用名为‘hook1’的函数
hooks.tap('hook1', (arg1, arg2, arg3) => {
  console.log('arg1, arg2, arg3: hook1', arg1, arg2, arg3);
});

// 触发hooks事件
hooks.call(1, 2, 3);
hooks.call();


class Car {
  constructor() {
    this.hooks = {
      accelerate: new SyncHook(['newspeed']),
      brake: new AsyncParallelHook(["source", "target", "routesList"]),
      calculateRoutes: new AsyncSeriesHook(["source", "target", "routesList"])
    }
  }
}

const testCar = new Car();

// 绑定同步钩子，不传参
testCar.hooks.accelerate.tap('loginPlugin', () => { console.log('loginPlugin') });
// 绑定同步钩子，传参
testCar.hooks.accelerate.tap('warningLoginPlugin', (warning) => { console.log(warning) });


// 绑定异步钩子 calculateRoutes2
testCar.hooks.calculateRoutes.tapPromise('calculateRoutes2', (source, target, routesList, callback) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(`calculateRoutes2 ===== tapPromise to ${source} ${target} ${routesList}`)
      resolve();
    }, 1000);
  });
});

// 绑定异步钩子 calculateRoutes1
testCar.hooks.calculateRoutes.tapPromise('calculateRoutes1', (source, target, routesList, callback) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(`calculateRoutes1 ===== tapPromise to ${source} ${target} ${routesList}`)
      resolve();
    }, 1000);
  });
});

// 触发异步钩子calculateRoutes
console.time('cost');
testCar.hooks.calculateRoutes.promise('Async', 'hook', 'demo').then(() => {
  console.timeEnd('cost');
}, err => {
  console.error(err);
  console.timeEnd('cost');
});


testCar.hooks.brake.tapPromise('brake1', (source, target, routesList, callback) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(`brake1 ===== tapPromise to ${source} ${target} ${routesList}`)
      resolve();
    }, 1000);
  });
});
testCar.hooks.brake.tapAsync('brake2', (source, target, routesList, callback) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(`brake2 ===== tapPromise to ${source} ${target} ${routesList}`)
      resolve();
    }, 1000);
  });
});
testCar.hooks.brake.tap('brake3', (source, target, routesList, callback) => {
  console.log(`brake3 ===== tap to ${source} ${target} ${routesList}`)
});

// 触发异步钩子calculateRoutes
console.time('brake');
testCar.hooks.brake.promise('Async', 'hook', 'demo').then(() => {
  console.timeEnd('brake');
}, err => {
  console.error(err);
  console.timeEnd('brake');
});