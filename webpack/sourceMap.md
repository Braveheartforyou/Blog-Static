## SourceMap

> **webpack版本为 5.28.0**

`sourceMap`对现在的项目来说也是比较重要的，因为在打包完成之后的代码是经过`混淆`、`压缩`的，不能很好的进行定位。如果想看到准确的代码位置，`Source Maps（源映射）` 通过提供原始代码和转换后代码之间的映射 来解决这个问题。

本篇文章大致小节如下：

- 历史渊源
- 使用`sourceMap`
- `sourceMap`组成部分
- webpack源码中的`sourceMap`(源码角度)
- `sourceMap`的作用

### 历史渊源

在2009年google的一篇[文章](https://googlecode.blogspot.com/2009/11/introducing-closure-tools.html)中，在介绍[Cloure Compiler](https://developers.google.com/closure/compiler/?hl=zh-CN)（一款js压缩优化工具，可类比于uglify-js）时，google也顺便推出了一款调试工具：firefox插件Closure Inspector，以方便调试编译后代码。这就是sourcemap的最初代啦！

> You can use the compiler with Closure Inspector , a Firebug extension that makes debugging the obfuscated code almost as easy as debugging the human-readable source.

2010年，在第二代即 [Closure Compiler Source Map 2.0](https://docs.google.com/document/d/1xi12LrcqjqIHTtZzrzZKmQ3lbTv9mKrN076UB-j3UZQ/edit?hl=en_US) 中，sourcemap确定了统一的json格式及其余规范，已几乎具有现在的雏形。最大的差异在于mapping算法，也是sourcemap的关键所在。第二代中的mapping已决定使用base 64编码，但是算法同现在有出入，所以生成的.map相比现在要大很多。
2011年，第三代即 [Source Map Revision 3.0](https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit?hl=en_US&pli=1&pli=1#heading=h.3l2f9su3ov2l) 出炉了，这也是我们现在使用的sourcemap版本。从文档的命名看来，此时的sourcemap已脱离Clousre Compiler，演变成了一款独立工具，也得到了浏览器的支持。这一版相较于二代最大的改变是mapping算法的压缩换代，使用VLQ编码生成base64前的mapping，大大缩小了.map文件的体积。

Sourcemap发展史的有趣之处在于，它作为一款辅助工具被开发出来。最后它辅助的对象日渐式微，而它却成为了技术主体，被写进了浏览器中。

> sourcemap v1最开始生成的sourcemap文件大概有转换后文件的10倍大。sourcemap v2将之减少了50%，v3又在v2的基础上减少了50%。所以目前133k的文件对应的sourcemap文件大小大概在300k左右。

### 浏览器中使用sourceMap

怎么在浏览器中使用`sourceMap`，chrome浏览器中默认是开启了`soruce Map`功能。如果被关闭可以手动开启，下图所示：

![soruce Map](./images/sourceMap.jpg)

> Mac OS 系统中的 Google Chrome 版本 Version 89.0.4389.90 (Official Build) (x86_64)

**创建项目**

可以通过`vue-cli`脚手架创建一个vue项目，也可以通过我自己的脚手架`vuetemplates-cli`来创建项目，执行命令如下：

```bash
  # 全局安装脚手架
  $ npm install -g vuetemplates-cli
  # 初始化项目
  $ vuetemplates init template-spa my-project-name
  # 切换目录
  $ cd my-project-name
  # 安装npm
  $ npm install
```

安装完成后，修改`./build/webpack.prod.js`如下：

```js
  {
    devtool: 'source-map'
  }
```

在`src`文件夹下创建`soureMap_test.js`文件，写入：

```js
  export default {
    name: 'I AM CHRIS'
  }
```

在`mian.js`通过`import ('./soureMap_test.js')`。

修改完成后执行运行命令：

```bash
  # 命令会进行打包、启动一个端口7087
  npm run start
```

这样就可以再浏览器端看到通过`sourceMap`映射显示出来的源码。如果代码运行报错的时候，就可以很精准的定位到错误代码的源代码位置，而不是打包之后的代码。

## sourceMap组成部分

在上面运行`npm run start`后会进行打包，打包的资源会在`./dist/public/static/js/**.map`，这里就以`soureMap_test.xxxx.js.map`为样例。

```json
// ./dist/public/static/js/soureMap_test.xxxx.js.map
{
  "version": 3,
  "sources": [ "webpack:///./src/soureMap_test.ts" ],
  "names": [ "name" ],
  "mappings": "qJACe,CACbA,KAAM",
  "file": "public/static/js/soureMap_test.bb71f1d9.js",
  "sourcesContent": [ "\nexport default {\n  name: 'I AM CHRIS'\n}" ],
  "sourceRoot": ""
}
```

**sourceMap格式**

```json
{ 
  "version": 3, // source map 的版本。
  "sources": [], // 转换前的文件，该项是一个数组，表示可能存在多个文件合并。
  "names": [], // 转换前的所有变量名和属性名。
  "mappings": "", // 记录位置信息的字符串。
  "file": "", // 转换后的文件名。
  "sourcesContent": [""] // 转换前文件的内容，当没有配置 sources 的时候会使用该项。
}
```

主要关注`mappings`中的字段`qJACe,CACbA,KAAM`.
以分号`;`来表示一行位置信息；以`,`表示一列位置信息；

## sourceMap实现映射

在分析`sourceMap`映射关系的时候，就以一个简单的示例来分析，如果加上`babel`转换的话会比较复杂。

```bash
  I AM CHRIS ——> 处理转换 ——> CHRIS I AM
```

从`I AM CHRIS`通过一系列转换到`sourceMap`中保存了那些映射关系。

### 最简单粗暴的方法

将输出文件中每个字符位置对应在输入文件名中的原位置保存起来，并一一进行映射。上面的这个映射关系应该得到下面的表格:

| 字符 | 输出位置 | 在输入中的位置 | 输入的文件名 |
|:------------:|:------------:|:-----------:|:---------------:|
| c | 行1，列1 | 行1,列6 |  输入文件1.txt |
| h | 行1，列2 | 行1,列7 |  输入文件1.txt |
| f | 行1，列3 | 行1,列8 |  输入文件1.txt |
| i | 行1，列4 | 行1,列9 |  输入文件1.txt |
| s | 行1，列5 | 行1,列10 |  输入文件1.txt |
| i | 行1，列7 | 行1,列1 |  输入文件1.txt |
| a | 行1，列9 | 行1,列3 |  输入文件1.txt |
| m | 行1，列10 | 行1,列4 |  输入文件1.txt |

*备注: 由于输入信息可能来自多个文件，所以这里也同时记录输入文件的信息。*

将上面表格整理成映射表的话，看起来就像这样(使用`"|"`符号分割字符)

`mappings: "1|1|输入文件1.txt|1|6,1|2输入文件1.txt|1|7,1|3|输入文件1.txt|1|8,1|4|输入文件1.txt|1|9,1|5|输入文件1.txt|1|10,1|7|输入文件1.txt|1|1,1|9|输入文件1.txt|1|3,1|10|输入文件1.txt|1|4"`（长度：144）

这种方法确实能将处理后的内容还原成处理前的内容，但是随着内容的增加，转换规则的复杂，这个编码表的记录将飞速增长。目前仅仅10个字符，映射表的长度已经达到了144个字符。如何进一步优化这个映射表呢？

> 备注：`mappings: "输出文件行位置|输出文件列位置|输入文件名|输入文件行号|输入文件列号,....."`

### 优化手段1:不要输出文件中的行号

在经历过压缩和混淆之后，代码基本上不会有多少行（**特别是JS，通常只有1到2行**）。这样的话，就可以在上节的基础上移除输出位置的行数，使用`";"`号来标识新行。 那么映射信息就变成了下面这样

`mappings: "1|输入文件1.txt|1|6,2|输入文件1.txt|1|7,3|输入文件1.txt|1|8,4|输入文件1.txt|1|9,5|输入文件1.txt|1|10,7|输入文件1.txt|1|1,9|输入文件1.txt|1|3,10|输入文件1.txt|1|4; 如果有第二行的话"`（长度：129）

> 备注： `mappings: "输出文件列位置|输入文件名|输入文件行号|输入文件列号,....."`

### 优化手段2：提取输入文件名

由于可能存在多个输入文件，且描述输入文件的信息比较长，所以可以将输入文件的信息存储到一个数组里，记录文件信息时，只记录它在数组里的索引值就好了。 经过这步操作后，映射信息如下所示：

```js
{
  sources: ['输入文件1.txt'],
  mappings: "1|0|1|6,2|0|1|7,3|0|1|8,4|0|1|9,5|0|1|10,7|0|1|1,9|0|1|3,10|0|1|4;" // (长度：65)
}
```

经过转换后mappings字符数从129下降到了65。`0`就表示是`sources[0]`的值。

> 备注： `mappings: "输出文件列位置|输入文件名索引|输入文件行号|输入文件列号,....."`

### 优化手段3: 可符号化字符的提取

经过上一步的优化，`mappings`字符数有了很大的下降，可见提取信息是一个很有用的简化手段，那么还有什么信息是能够提取的么？
当然。已输出文件中的`Chris`字符为例，当我们找到了它的首字符`C`在源文件中的位置(**行1,列6**)时，就不需要再去找剩下的`hris`的位置了，因为`Chris`可以作为一个整体来看待。想想源码里的变量名，函数名，都是作为一个整体存在的。
现在可以把作为整体的字符提取并存储到一个数组里，然后和文件名一样，在`mapping`里只记录它们的索引值。这样就避免了每一个字符都要记的窘境，大大缩减`mappings`的长度。

添加一个包含所有可符号化字符的数组：

`names: ['I', 'am', 'Chris']`

那么之前`Chris`的映射就从

`1|0|1|6,2|0|1|7,3|0|1|8,4|0|1|9,5|0|1|10`

变成了

`1|0|1|6|2`

最终的映射信息变成了:

```js
{
  sources: ['输入文件1.txt'],
  names: ['I', 'am', 'Chris'],
  mappings: "1|0|1|6|2,7|0|1|1|0,9|0|1|3|1" // (长度: 29)
}
```

> 备注：
> 1. `“I am Chris"`中的`"I"`抽出来放在数组里，其实意义不大，因为它本身也就只有一个字符。但是为了演示方便，所以拆出来放在数组里。
> 2. mappings: "输出文件列位置|输入文件名索引|输入文件行号|输入文件列号|字符索引,....."

### 优化手段4: 记录相对位置

前面记录位置信息（主要是列）时，记录的都是绝对位置信息，设想一下，当文件内容比较多时，这些数字可能会变的很大，这个问题怎么解决呢？ 可以通过只记录相对位置来解决这个问题（除了第一个字符）。 来看一下具体怎么实现的，以之前的mappings编码为例:

`mappings: "1(输出列的绝对位置)|0|1|6(输入列的绝对位置)|2,7(输出列的绝对位置)|0|1|1(输入列的绝对位置)|0,9(输出列的绝对位置)|0|1|3(输入列的绝对位置)|1"`

转换成只记录相对位置

`mappings: "1(输出列的绝对位置)|0|1|6(输入列的绝对位置)|2,6(输出列的相对位置)|0|1|-3(输入列的相对位置)|0,2(输出列的相对位置)|0|1|-2(输入列的绝对位置)|1"`

从上面的例子可能看不太出这个方法的好处，但是当文件慢慢大起来，使用相对位置可以节省很多字符长度，特别是对于记录输出文件列信息的字符来说。

> 上面记录相对位置后，我们的数字中出现了负值，所以之后解析Source Map文件看到负值就不会感到奇怪了
另外一点我的思考，对于输出位置来说，因为是递增的，相对位置确实有减小数字的作用，但对于输入位置，效果倒未必是这样了。拿上面映射中最后一组来说，原来的值是 10|0|1|0|2，改成相对值后为 6|0|1|-9|1。第四位的值即使去掉减号，因为它在源文件中的位置其实是不确定的，这个相对值可以变得很大，原来一位数记录的，完全有可能变成两位甚至三位。不过这种情况应该比较少，它增加的长度比起对于输出位置使用相对记法后节约的长度要小得多，所以总体上来说空间是被节约了的

### 优化手段5: VLQ编码

经过上面几步操作之后，现在最应该优化的地方应该就是用来分割数字的`"|"`号了。 这个优化应该怎么实现呢？ 在回答之前，先来看这样一个问题——如果你想顺序的记录4组数字，最简单的就是用`"|"`号进行分割。

`1|2|3|4`

如果每个数字只有1位的话，可以直接表示成

`1234`

但是很多时候每个数字不止有1位，比如

`12|3|456|7`

这个时候，就一定得用符号把各个数字分割开，像我们上面例子中一样。还有好的方法嘛？ 通过VLQ编码的方式，你可以很好的处理这种情况，先来看看VLQ的定义：

#### VLQ定义

> A variable-length quantity (VLQ) is a universal code that uses an arbitrary number of binary octets (eight-bit bytes) to represent an arbitrarily large integer.
翻译一下：VLQ是用任意个2进制字节组去表示一个任意数字的编码形式。

[VLQ](https://en.wikipedia.org/wiki/Variable-length_quantity)的编码形式很多，这篇文章中要说明的是下面这种：

![VLQ](https://user-gold-cdn.xitu.io/2019/6/17/16b658c9d42e7bd4?imageView2/0/w/1280/h/960/format/webp/ignore-error/1)

- 一个组包含6个二进制位。
- 在每组中的第一位C用来标识其后面是否会跟着另一个VLQ字节组,值为0表示其是最后一个VLQ字节组，值为1表示后面还跟着另一个VLQ字节组。
- 在第一组中，最后1位用来表示符号，值为0则表示正数，为1表示负数。其他组的最后一位都是表示数字。
- 其他组都是表示数字。

**这种编码方式也称为Base64 VLQ编码，因为每一个组对应一个Base64编码。**

#### 小例子说明VLQ

现在我们用这套VLQ编码规则对`12|3|456|7`进行编码，先将这些数字转换为二进制数。

```js
12  ——> 1100
3   ——> 11
456 ——> 111001000
7   ——> 111
```

- 对12进行编码

12需要1位表示符号，1位表示是否延续，剩下的4位表示数字

| B5(C) | B4 | B3 | B2 | B1 | B0 |
|:----:|:----:|:----:|:----:|:----:|:----:|
| 0 |1 | 1 | 0 | 0 | 0 |

对3进行编码

| B5(C) | B4 | B3 | B2 | B1 | B0 |
|:----:|:----:|:----:|:----:|:----:|:----:|
| 0 | 0 | 0 | 1 | 1 | 0 |

对456进行编码

从转换关系中能够看到，`456`对应的二进制已经超过了6位，用1组来表示肯定是不行的，这里需要用两组字节组来表示。先拆除最后4个数`(1000)`放入第一个字节组，剩下的放在跟随字节组中。

| B5(C) | B4 | B3 | B2 | B1 | B0 | | B5(C) | B4 | B3 | B2 | B1 | B0 |
|:----:|:----:|:----:|:----:|:----:|:----:|:--:|:----:|:----:|:----:|:----:|:----:|:----:|
| 1 | 1 | 0 | 0 | 0 | 0 |    | 0 | 1 | 1 | 1 | 0 | 0 |

对7进行编码

| B5(C) | B4 | B3 | B2 | B1 | B0 |
|:----:|:----:|:----:|:----:|:----:|:----:|
| 0 | 0 | 1 | 1 | 1 | 0 |

最后得到下列VLQ编码:

`011000 000110 110000 011100 001110`

通过Base64进行转换之后：

![base64对应码](https://user-gold-cdn.xitu.io/2019/6/17/16b658ca2f5f0e2d?imageView2/0/w/1280/h/960/format/webp/ignore-error/1)

最终得到下列结果:

`YGwcO`

#### 转换之前的例子

通过上面这套VLQ的转换流程转换之前的例子，先来编码`1|0|1|6|2`. 转换成VLQ为：

```js
1 ——> 1(二进制) ——> 000010(VLQ)
0 ——> 0(二进制) ——> 000000(VLQ)
1 ——> 1(二进制) ——> 000010(VLQ)
6 ——> 110(二进制) ——> 001100(VLQ)
2 ——> 10(二进制) ——> 000100(VLQ)
```

合并后编码为:

`000010 000000 000010 001100 000100`

转换成Base64:

`BABME`

其他也是按这种方式编码，最后得到的`mapping`文件如下：

```js
{
  sources: ['输入文件1.txt'],
  names: ['I', 'am', 'Chris'],
  mappings: "BABME,OABBA,SABGB" // (长度: 17)
}
```

## webpack中的sorceMap

webpack中通过`devtool`配置进行控制`sourceMap.map`文件的生成，可以大致把`devtool`大致分为以下几类：

*The pattern is: [inline-|hidden-|eval-][nosources-][cheap-[module-]]source-map.*

- eval：打包后的模块都使用 `eval()` 执行，行映射可能不准；不产生独立的 map 文件， 四中带有 eval 的对比请看[四种 eval 对比](https://webpack.docschina.org/configuration/devtool/).
- source-map： 生成一个单独的 `source map` 文件，即 `.map` 文件。（注意与 `source map` 这个统称概念区分）
- cheap：`source map` 没有列映射(column mapping)，忽略 `loader source map`。
- module：将 `loader source map` 简化为每行一个映射(mapping)，比如 jsx to js ，babel 的 source map，**增加第三方库的 error、warning 追踪**。
- inline：`source map` 通过 `Data URLs` 的方式添加到 `bundle` 中。
- hidden：不会为 `bundle` 添加引用注释。
- nosources：`source map` 不包含 `sourcesContent`(源代码内容)。

> `**-hidden-**`或`**-hidden-**`对线上环境来说是非常重要的配置，既能收集堆栈信息又可以不暴露自己的源码映射。

下面以`devtool: source-map`为配置项，以webpack源码的角度来看一下，是怎么生成`soruceMap`的。

全部的主流程如下：

- runLoaders
- babel-loader
- babel-loader/transfrom
- @babel-core/transfrom
- @babel-core/_transformation.run
- @babel-core/_generate.default


### webpack中是如何生成sourceMap

我们这里的调试代码还是通过[调试webpack代码](./debug.md)这边文档里面的代码做实例。在这个实例中的`webpack.config.js`中有配置过`devtool: 'source-map'`。先把主要的讲清楚：

- webpack中的`source-map`是在运行`runLoader`时生成，也就是在`bable-loader`中生成的`source-map`.
- `bable-loader`也是通过`(mozilla的source-map)[https://github.com/mozilla/source-map]`生成的。

调试`webpack`中的源码时非常复杂和繁琐的，在大部分时候也是没有意义的，因为很少有人会想了解这部分内容因为够用就行。

如果想了解[webpack 编译流程](./create-compiler.md)可以看这边文章。因为`loader`位置解析和`loaderContext`也是比较复杂的，这里就不展开了，如果有机会后面会再写一篇`loader`的解析。

### runLoaders

这里直接从`runLoaders`，在这个时候就会调用对应的`loader`来解析`source`文件，代码如下：

**webpack源码 ./lib/NormalModule.js**

```js
const { getContext, runLoaders } = require("loader-runner");
  // webpack源码
  // ./lib/NormalModule.js
  doBuild(options, compilation, resolver, fs, callback) {
    // 调用this.createLoaderContext 创建 loaderContext
    const loaderContext = this.createLoaderContext(
      resolver,
      options,
      compilation,
      fs
    );

    const processResult = (err, result) => {

      // 省略

      callback(err)
    }
    // 执行对应钩子
    try {
      hooks.beforeLoaders.call(this.loaders, this, loaderContext);
    } catch (err) {
      processResult(err);
      return;
    }
    // 运行runLoaders
    runLoaders(
      {
        // 指向的入口文件地址 '/Users/admin/Desktop/velen/student/webpack/debug/src/index.js'
        resource: this.resource,
        // babel-loader
        loaders: this.loaders,
        // loaderContext 包含了 compiler、compilation、文件地址等等
        context: loaderContext,
        processResource: (loaderContext, resource, callback) => {
          const scheme = getScheme(resource);
          if (scheme) {
            hooks.readResourceForScheme
              .for(scheme)
              .callAsync(resource, this, (err, result) => {
                if (err) return callback(err);
                if (typeof result !== "string" && !result) {
                  return callback(new UnhandledSchemeError(scheme, resource));
                }
                return callback(null, result);
              });
          } else {
            loaderContext.addDependency(resource);
            fs.readFile(resource, callback);
          }
        }
      },
      (err, result) => {
        if (!result) {
          return processResult(
            err || new Error("No result from loader-runner processing"),
            null
          );
        }
        // 省略代码
        // 执行传入的回调函数
        processResult(err, result.result);
      }
    );
  }

```

调用`runLoaders`并且传入要处理的源码`source`、`loaders`、`context`，在后续调用loader时候要使用到。 `runLoaders`是另一个npm包`loader-runner`，在我开发自己的`loader`时可以使用`loader-runner`来调试。

`runLoaders`就会走到`node_modules/babel-loader/lib/index.js`，执行`_loader`进行`loaderOptions`的配置，然后会调用`transform(source, options)`进行转换代码。代码如下：

#### _loader()

**node_moduels/babel-loader/lib/index.js**

```js
  // node_moduels/babel-loader/lib/index.js
  // 注意transform是babel-loader下的
  const transform = require("./transform");
  function _loader() {
    _loader = _asyncToGenerator(function* (soruce, inputSourceMap, overrids) {
      // 处理loaderOptions
      // 省略代码

      // 对传入的sourceMap参数进行判断
      const programmaticOptions = Object.assign({}, loaderOptions, {
        // '/Users/admin/Desktop/velen/student/webpack/debug/src/index.js'
        filename,
        // undefined
        inputSourceMap: inputSourceMap || undefined,
        // Set the default sourcemap behavior based on Webpack's mapping flag,
        // but allow users to override if they want.
        sourceMaps: loaderOptions.sourceMaps === undefined ? this.sourceMap : loaderOptions.sourceMaps,
        // Ensure that Webpack will get a full absolute path in the sourcemap
        // so that it can properly map the module back to its internal cached
        // modules.
        sourceFileName: filename
      }); // Remove loader related options
      // 一系列参数处理
      if (config) {
        // 参数配置
        // 判定是否有缓存
        if (cacheDirectory) {
          // 省略
        } else {
          // 执行transform 方法传入 源字符串和配置对象
          result = yield transform(source, options);
        }
      }
      // 等上面的transform异步方法执行完成后
      if (result) {
        if (overrides && overrides.result) {
          result = yield overrides.result.call(this, result, {
            source,
            map: inputSourceMap,
            customOptions,
            config,
            options
          });
        }

        const {
          code,
          map,
          metadata
        } = result;
        metadataSubscribers.forEach(subscriber => {
          subscribe(subscriber, metadata, this);
        });
        return [code, map];
      }
    })
    return _loader.apply(this, arguments);
  }

```

首先讲一下大致流程，因为`babel-loader`中也有很多异步流程，所以很难梳理清楚很细节的执行流程，这里主要看一下主流程：

- 调用`_loader`方法，`_loader`方法内部有一个通过`_asyncToGenerator`包裹的方法
- 对`loaderOptions`进行一系列的配置，如果在`webpack.config.js`其中对`babel-loader`配置了，会进行合并
- `loaderOptions`处理完成之后判断是否存在缓存，如果不存在调用`result = yield transform(source, options);`，`transform`是一个异步的，等这个异步完成再进行后面的操作

> 同时注意`babel-loader`中使用了很多`Generator`来保证代码异步执行的顺序，如果有兴趣可以看我另一篇文章[前端generator](./generator.md)

#### transform(source, options)

**node_moduels/babel-loader/lib/transform.js**

```js
  // **node_moduels/babel-loader/lib/transform.js**
  // 引入babel的核心包
  const babel = require("@babel/core");
  // 通过promisify把babel.transform转换为promise函数
  const transform = promisify(babel.transform);

  module.exports = /*#__PURE__*/function () {
    var _ref = _asyncToGenerator(function* (source, options) {
      let result;
        try {
          // 调用babel上的transform方法 把源码转为ast抽象语法树
          result = yield transform(source, options);
        } catch (err) {
          throw err.message && err.codeFrame ? new LoaderError(err) : err;
        }
        if (!result) return null;
        // 解构返回结果result
        const {
          ast,
          code,
          map,
          metadata,
          sourceType
        } = result;

        if (map && (!map.sourcesContent || !map.sourcesContent.length)) {
          map.sourcesContent = [source];
        }
        // 返回解构的值
        return {
          ast,
          code,
          map,
          metadata,
          sourceType
        };
    });
    return function (_x, _x2) {
        return _ref.apply(this, arguments);
      };
    }
  }();
```

在`@babel/core/lib/index.js`中通过`Object.defineProperty`对`transform`方法进行了劫持。在执行`promisify(babel.transform);`时候就会执行`_transform.transform;`
在`transfrom`文件中是一个**自执行方法**，`transform()`内部执行如下：

- 引入`@babel/core`包，并且把`promisify(babel.transform);`转换为`promise`类型的函数
- 在导出默认