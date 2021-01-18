/*
 * @Descripttion: 
 * @Author: 19080088
 * @Date: 2021-01-18 11:49:00
 * @LastEditors: 19080088
 * @LastEditTime: 2021-01-18 14:17:09
 */
const Compiler = require('./compiler');
// 声明一个MyPlugin类  MyPlugin要有一个apply方法，在compiler调用
class MyPlugin {
  constructor () {

  }
  apply (compiler) {
    compiler.hooks.brake.tap('WarningLampPlugin', () => console.log('WarningLampPlugin'));
    compiler.hooks.accelerate.tap('LoggerPlugin', (speed) => console.log(`LoggerPlugin ${speed}`));
    compiler.hooks.calculateRoutes.tapPromise("calculateRoutes tapAsync", (source, target, routesList) => {
      return new Promise((resolve,reject)=>{
          setTimeout(()=>{
              console.log(`tapPromise to ${source} ${target} ${routesList}`)
              resolve();
          },1000)
      });
    });
  }
}

const myPlugin = new MyPlugin();
console.log('myPlugin: ', myPlugin);

const options = {
  plugins: [myPlugin]
};

const compiler = new Compiler();

for (const plugins of options.plugins) {
  if (typeof plugins === 'function') {
    plugins.call(compiler, compiler);
  } else {
    // 调用myPlugin上的 apply方法，并且传入 compiler 实例，创建绑定钩子函数
    plugins.apply(compiler)
  }
    
}
// 执行触发绑定钩子的函数
compiler.run();