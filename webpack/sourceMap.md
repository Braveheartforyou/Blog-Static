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

**简便调试代码**

如果感觉这样模板太麻烦的话，可以直接用[debug webpack 配置](./debug.md)中的代码进行调试。

修改`debug/src/index.js`代码如下：

```js
  'I AM CHRIS'
```

启动vscode中的调试就可以了。

## sourceMap组成部分

用上面简便的调试方法，启动`vscode`中的调试或者直接`node ./debug/start.js`来运行webpack，会在`debug/dist/main.js.map`.

```json
// ./debug/dist/main.js.map
{
  "version": 3,
  "sources": [ "webpack://debug/./src/index.js" ],
  "names": [],
  "mappings": ";;;;;AAAA,a",
  "file": "main.js",
  "sourcesContent": [ "'I AM CHRIS'" ],
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

主要关注`mappings`中的字段`;;;;;AAAA,a`.
以分号`;`来表示一行位置信息；以`,`表示一列位置信息；

## sourceMap实现映射

在分析`sourceMap`映射关系的时候，就以一个简单的示例来分析，如果加上`babel`转换的话会比较复杂。

```bash
  I AM CHRIS ——> 处理转换 ——> CHRIS I AM
```

从`I AM CHRIS`通过一系列转换到`sourceMap`中保存了那些映射关系。

> 注意底下只是理论分析，真实的`source-map`和`webpack`并不按照一下部分分析的。

### 最简单粗暴的方法

将输出文件中每个字符位置对应在输入文件名中的原位置保存起来，并一一进行映射。上面的这个映射关系应该得到下面的表格:

| 字符 | 输出位置 | 在输入中的位置 | 输入的文件名 |
|:------------:|:------------:|:-----------:|:---------------:|
| C | 行1，列1 | 行1,列6 |  sourceMap.js |
| H | 行1，列2 | 行1,列7 |  sourceMap.js |
| F | 行1，列3 | 行1,列8 |  sourceMap.js |
| I | 行1，列4 | 行1,列9 |  sourcemap.js |
| S | 行1，列5 | 行1,列10 |  sourcemap.js |
| I | 行1，列7 | 行1,列1 |  sourcemap.js |
| A | 行1，列9 | 行1,列3 |  sourcemap.js |
| M | 行1，列10 | 行1,列4 |  sourcemap.js |

*备注: 由于输入信息可能来自多个文件，所以这里也同时记录输入文件的信息。*

将上面表格整理成映射表的话，看起来就像这样(使用`"|"`符号分割字符)

`mappings: "1|1|sourcemap.js|1|6,1|2输入文件1.txt|1|7,1|3|sourcemap.js|1|8,1|4|sourcemap.js|1|9,1|5|sourcemap.js|1|10,1|7|sourcemap.js|1|1,1|9|sourcemap.js|1|3,1|10|sourcemap.js|1|4"`（长度：144）

这种方法确实能将处理后的内容还原成处理前的内容，但是随着内容的增加，转换规则的复杂，这个编码表的记录将飞速增长。目前仅仅10个字符，映射表的长度已经达到了144个字符。如何进一步优化这个映射表呢？

> 备注：`mappings: "输出文件行位置|输出文件列位置|输入文件名|输入文件行号|输入文件列号,....."`

### 优化手段1:不要输出文件中的行号

在经历过压缩和混淆之后，代码基本上不会有多少行（**特别是JS，通常只有1到2行**）。这样的话，就可以在上节的基础上移除输出位置的行数，使用`";"`号来标识新行。 那么映射信息就变成了下面这样

`mappings: "1|sourcemap.js|1|6,2|sourcemap.js|1|7,3|sourcemap.js|1|8,4|sourcemap.js|1|9,5|sourcemap.js|1|10,7|sourcemap.js|1|1,9|sourcemap.js|1|3,10|sourcemap.js|1|4; 如果有第二行的话"`（长度：129）

> 备注： `mappings: "输出文件列位置|输入文件名|输入文件行号|输入文件列号,....."`

> 注意: `mozilla/source-map`在`addMapping`时，不能省略`行号`不然会报错。

### 优化手段2：提取输入文件名

由于可能存在多个输入文件，且描述输入文件的信息比较长，所以可以将输入文件的信息存储到一个数组里，记录文件信息时，只记录它在数组里的索引值就好了。 经过这步操作后，映射信息如下所示：

```js
{
  sources: ['sourcemap.js'],
  mappings: "1|0|1|6,2|0|1|7,3|0|1|8,4|0|1|9,5|0|1|10,7|0|1|1,9|0|1|3,10|0|1|4;" // (长度：65)
}
```

经过转换后mappings字符数从129下降到了65。`0`就表示是`sources[0]`的值。

> 备注： `mappings: "输出文件列位置|输入文件名索引|输入文件行号|输入文件列号,....."`

### 优化手段3: 可符号化字符的提取

经过上一步的优化，`mappings`字符数有了很大的下降，可见提取信息是一个很有用的简化手段，那么还有什么信息是能够提取的么？
当然。已输出文件中的`CHRIS`字符为例，当我们找到了它的首字符`C`在源文件中的位置(**行1,列6**)时，就不需要再去找剩下的`hris`的位置了，因为`CHRIS`可以作为一个整体来看待。想想源码里的变量名，函数名，都是作为一个整体存在的。
现在可以把作为整体的字符提取并存储到一个数组里，然后和文件名一样，在`mapping`里只记录它们的索引值。这样就避免了每一个字符都要记的窘境，大大缩减`mappings`的长度。

添加一个包含所有可符号化字符的数组：

`names: ['I', 'AM', 'CHRIS']`

那么之前`CHRIS`的映射就从

`1|0|1|6,2|0|1|7,3|0|1|8,4|0|1|9,5|0|1|10`

变成了

`1|0|1|6|2`

最终的映射信息变成了:

```js
{
  sources: ['sourcemap.js'],
  names: ['I', 'AM', 'CHRIS'],
  mappings: "1|0|1|6|2,7|0|1|1|0,9|0|1|3|1" // (长度: 29)
}
```

> 备注：
> 1. `“I AM CHRIS"`中的`"I"`抽出来放在数组里，其实意义不大，因为它本身也就只有一个字符。但是为了演示方便，所以拆出来放在数组里。
> 2. mappings: "输出文件列位置|输入文件名索引|输入文件行号|输入文件列号|字符索引,....."

> 注意：在`babel-loader`中的使用的`source-map`不会提取字符串，会提取变量。也就是说`'I AM CHRIS'`不会拆分。

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

**实例验证**

创建一个文件`vlq.js`，写入内容如下：

```js
// 引入vlq的package包
const vlq = require('vlq');
传入
const string = vlq.encode([12, 3, 456, 7]);
console.log('string: ', string); // YGwcO
```

验证完成理论分析和实例生成的代码相同。

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
  sources: ['sourcemap.js'],
  names: ['I', 'AM', 'CHRIS'],
  mappings: "BABME,OABBA,SABGB" // (长度: 17)
}
```

## webpack中的sorceMap

webpack中通过`devtool`配置进行控制`sourceMap.map`文件的生成，可以大致把`devtool`大致分为以下几类：

*The pattern is: [inline-|hidden-|eval-][nosources-][cheap-[module-]]source-map.*

- eval：每个模块都使用 `eval()` 执行，并且都有 `//@ sourceURL`。此选项会非常快地构建。主要缺点是，由于会映射到转换后的代码，而不是映射到原始代码（没有从 `loader` 中获取 `source map`），所以不能正确的显示行数。
- source-map： 生成一个单独的 `source map` 文件，即 `.map` 文件。（注意与 `source map` 这个统称概念区分）
- cheap：`source map` 没有列映射(column mapping)，忽略 `loader source map`。
- module：将 `loader source map` 简化为每行一个映射(mapping)，比如 jsx to js ，babel 的 source map，**增加第三方库的 error、warning 追踪**。
- inline：`source map` 通过 `Data URLs` 的方式添加到 `bundle` 中。
- hidden：不会为 `bundle` 添加引用注释。
- nosources：`source map` 不包含 `sourcesContent`(源代码内容)。

> `**-hidden-**`或`**-hidden-**`对线上环境来说是非常重要的配置，既能收集堆栈信息又可以不暴露自己的源码映射。

下面以`devtool: source-map`为配置项，以webpack源码的角度来看一下，是怎么生成`soruceMap`的。

如果不知道那些地方可以打断点，我的断点如图所示：

![soruceMap_breakingPoint](./images/soruceMap_breakingPoint.png)

全部的主流程如下：

- runLoaders
- babel-loader
- babel-loader/transfrom
- @babel-core/transfrom
- @babel-core/_transformation.run
- @babel-core/_generate.default
- @babel-core/source-map

### webpack中是如何生成sourceMap

我们这里的调试代码还是通过[调试webpack代码](./debug.md)这边文档里面的代码做实例。在这个实例中的`webpack.config.js`中有配置过`devtool: 'source-map'`。先把主要的讲清楚：

- webpack中的`source-map`是在运行`runLoader`时生成，也就是在`bable-loader`中生成的`source-map`.
- `bable-loader`也是通过`(mozilla的source-map)[https://github.com/mozilla/source-map]`生成的。

调试`webpack`中的源码时非常复杂和繁琐的，在大部分时候也是没有意义的，因为很少有人会想了解这部分内容因为够用就行。

如果想了解[webpack 编译流程](./create-compiler.md)可以看这边文章。因为`loader`位置解析和`loaderContext`也是比较复杂的，这里就不展开了，如果有机会后面会再写一篇`loader`的解析。

### 自己生成source-map

其实自己通过`mozilla/source-map`可以生成`source-map`，创建一个`SourceMap.js`，代码如下：

```js
// 引入mozilla/source-map包
const sourceMap = require('source-map')
// 实例化SourceMapGenerator
var map = new sourceMap.SourceMapGenerator({
  file: 'sourceMap.js.map'
})

// 有一个很关键的操作 addMapping 用于添加代码的映射行列和原始行列；这里我们直接借用babel-loader生成的_rawMappings
// babel-loader中会在webpack/node_modules/@babel/generator/lib/buffer.js 文件中创建_rawMappings
const RawMapping = [
  {
    name: undefined,
    generated: {
      line: 1,
      column: 0
    },
    source: "sourceMap.js",
    original: {
      line: 1,
      column: 0
    },
  },
]
// 首先网map实例中添加原始代码  第一个参数要与source相同 第二个参数就是原始代码
map.setSourceContent("sourceMap.js", "'I AM CHRIS'")
RawMapping.forEach(mapping => map.addMapping(mapping))
// 输出sourceMap对象
console.log(map.toString())

// {"version":3,"sources":["sourceMap.js"],"names":[],"mappings":"AAAA","file":"sourceMap.js.map","sourcesContent":["'I AM CHRIS'"]}

```

写完代码执行`npx sourceMap.js`，就会输出`"sourceMap"`对象，后面与`babel-loader`生成`"sourceMap"`进行；对两个`"sourceMap"`进行还原。

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

### babel-laoder => _loader()

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

### _loader() => transform(source, options)

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
  }();
```

在`@babel/core/lib/index.js`中通过`Object.defineProperty`对`transform`方法进行了劫持。在执行`promisify(babel.transform);`时候就会执行`_transform.transform;`
在`transfrom`文件中是一个`IIFE(自执行函数)`，`transform()`内部执行如下：

- 引入`@babel/core`包，并且把`promisify(babel.transform);`转换为`promise`类型的函数
- `module.exports`导出一个`IIFE`(自执行函数)，函数内部又定义了一个`_ref`是一个`_asyncToGenerator`一步方法
- `_ref`内部直接调用@babel/transform`transform(source, options)`

### @babel/core/lib/transform => transform(source, options)

在`@babel/core`的`transform`方法中首先会处理配置参数，再会调用`_transformRunner.run`开始真正的”转化“。代码如下：

```js
  // node_module/@babel/core/lib/transform.js
  // 引入处理config
  var _config = _interopRequireDefault(require("./config"));
  var _transformation = require("./transformation");
  const gensync = require("gensync");

  const transformRunner = gensync(function* transform(code, opts) {
    // 通过_config.default处理opts
    const config = yield* (0, _config.default)(opts);
    // 如果config为null直接返回 null
    if (config === null) return null;
    // 执行_transformation.run并且传入  config, code
    return yield* (0, _transformation.run)(config, code);
  });
  // 定义transform方法 传入 code、opts、callback
  const transform = function transform(code, opts, callback) {
    if (typeof opts === "function") {
      callback = opts;
      opts = undefined;
    }
    if (callback === undefined) return transformRunner.sync(code, opts);
    // 调用transformRunner
    transformRunner.errback(code, opts, callback);
  };
```

### @babel/core/lib/transformation/index.js

执行到`transformation/index.js`，会在这个时候通过`@babel/parser`生成`AST`，再通过`@babel/traverse`进行优化`AST`，最后调用`_generate`来生成代码。简化代码如下：

```js
  // @babel/core/lib/transformation/index.js
  // 默认导出run方法
  exports.run = run;
  // 加载traverse对生成AST进行遍历维护+优化
  function _traverse() {
    const data = _interopRequireDefault(require("@babel/traverse"));
    _traverse = function () {
      return data;
    };
    return data;
  }
  // 在_normalizeFile.default中通过@babel/parser对code转换为AST
  var _normalizeFile = _interopRequireDefault(require("./normalize-file"));
  // 通过@babel/traverse维护更新的AST进行代码生成
  var _generate = _interopRequireDefault(require("./file/generate"));
  // config 为transform 中创建的config  ast 为 undefined
  function* run(config, code, ast) {
    // _normalizeFile.default内部会调用@babel/parser 为code代码生成AST 返回生成的AST和配置对象
    // file中包含如下：
    // {
    //   ast: {}:node,
    //   code: String,
    //   hub: { file: this, getCode: function, getScope: function }:Object,
    //   inputMap: null,
    //   path: {}:NodePath,
    //   scope: {}:Scope
    // }
    const file = yield* (0, _normalizeFile.default)(config.passes, (0, _normalizeOpts.default)(config), code, ast);
    const opts = file.opts;
    try {
      //  执行transformFile 传入 file对象和配置项
      yield* transformFile(file, config.passes);
    } catch (e) {
      throw e;
    }

    try {
      if (opts.code !== false) {
        ({
          outputCode,
          outputMap // 调用_generate方法进行代码生成
        } = (0, _generate.default)(config.passes, file));
      }
    } catch (e) {
      throw e;
    }
    // 返回对象
    return {
      metadata: file.metadata,
      options: opts,
      ast: opts.ast === true ? file.ast : null,
      code: outputCode === undefined ? null : outputCode,
      map: outputMap === undefined ? null : outputMap,
      sourceType: file.ast.program.sourceType
    };
  }
  // 创建transformFile方法，传入parser转换完成的AST对象
  function* transformFile(file, pluginPasses) {
    const passPairs = [];
    const passes = [];
    const visitors = [];

    for (const plugin of pluginPairs.concat([(0, _blockHoistPlugin.default)()])) {
      const pass = new _pluginPass.default(file, plugin.key, plugin.options);
      passPairs.push([plugin, pass]);
      passes.push(pass);
      visitors.push(plugin.visitor);
    }
    // 创建visitor
    const visitor = _traverse().default.visitors.merge(visitors, passes, file.opts.wrapPluginVisitorMethod);
    // 调用_traverse处理AST 传入
    (0, _traverse().default)(file.ast, visitor, file.scope);
  }
```

> 这里就不展开看`@babel/parser`和`@babel/traverse`的内容了，如果感兴趣可以看篇文章[babel详解](./babel.md)

执行步骤如下：

- 在`run`方法中会执行`_normalizeFile.default`前会调用`(0, _normalizeOpts.default)(config)`来处理配置项，返回`options`.
- `(0, _normalizeFile.default)(config.passes, options, code, ast)`开始把传入的`code`通过`@babel/parser`生成`AST`
- 返回的`file`对象后，执行`transformFile(file, config.passes)`。
- 在`transformFile`首先生成了`visitor(访问者)`对象，再执行`(0, _traverse().default)(file.ast, visitor, file.scope);`传入`AST`、`visitor`、`scope`。会遍历更新`AST`上面的节点。
- 下面执行到`(0, _generate.default)(config.passes, file))`用来生成转译后的`es2015代码`和`sourceMap`

### @babel/core/lib/transformation/file/generate.js

`_generate.default`就是`generateCode`方法：

```js
  // @babel/core/lib/transformation/file/generate.js
  exports.default = generateCode;

  function _generator() {
    // 引入generator
    const data = _interopRequireDefault(require("@babel/generator"));
    _generator = function () {
      return data;
    };
    return data;
  }
  // 封装generateCode方法
  function generateCode(pluginPasses, file) {
    // code 现在还是 'I AM CHRIS'
    const { opts, ast, code, inputMap } = file;
    const results = [];

    if (results.length === 0) {
      // 调用上方定义的方法 实例化SourceMap对象 并且生成RwaMapping
      // 返回的result 在 _print
     result = (0, _generator().default)(ast, opts.generatorOpts, code);
    } 
    // 解构_generator方法返回的result的对象；
    // 获取map值会触发 内部绑定的劫持方法
    let { code: outputCode, map: outputMap } = result;

    return { outputCode, outputMap };
  }
```

通过`_generator`内部会生成`source-map`实例，并且往`_rawMapping`添加行列信息，最后会返回`result`对象，`result.map`
是一个被监听的属性，通过解构访问`map`就会执行`source-map`中的`get()`。会把`_rawMapping`通过`map.addMapping`生成我们要的`sourceMap`对象。

### @babel/generate/lib/index.js

`"@babel/generator"`指向的文件是`@babel/generate/lib/index.js`，下面看一下：

```js
  // @babel/generate/lib/index.js
  exports.default = generate;
  // 导入source-map类
  var _sourceMap = _interopRequireDefault(require("./source-map"));
  // 导入printer类
  var _printer = _interopRequireDefault(require("./printer"));
  // Generator继承了_printer 类
  class Generator extends _printer.default {
    // 初始化构造函数
    constructor(ast, opts = {}, code) {
      // 处理默认参数
      const format = normalizeOptions(code, opts);
      // 实例化_sourceMap
      const map = opts.sourceMaps ? new _sourceMap.default(opts, code) : null;
      // 执行_printer 类的 构造函数 这里就不
      // 会在实例的_printer中保存当前map对象
      super(format, map);
      this.ast = void 0;
      this.ast = ast;
    }
    generate() {
      // 会调用printer 上的generate进行 RawMapping的生成
      return super.generate(this.ast);
    }
  }
  // 处理参数
  function normalizeOptions(code, opts) {
    // ...省略代码
  }
  // 创建generate 方法
  function generate(ast, opts, code) {
    // 实例化Generator类
    const gen = new Generator(ast, opts, code);
    // 调用gen实例上的generate方法，开始生成代码
    return gen.generate();
  }

```

执行步骤：

- 调用定义的`generate`方法，实例化`Generator`类
- 实例化`Generator`类会通过`normalizeOptions`进行参数处理
- 调用`_printer.generate(this.ast);`来进行`RawMapping`生成 这里就不展开看了
 - `_printer.generate`又会调用`buffer.get`，返回一个劫持`result`对象
 - `buffer`生成`RawMapping`对象，`buffer`会调用`sourceMap.mark`来往`map(sourceMap实例)._rawMappings`添加已经解析好的行列代码
- 执行一系列操作后，会返回`result = {code, map, rawMappings} `对象，`result`对象的`map`属性是经过`Object.defineProperty`进行劫持的

在返回`result`对象后这里又会执行到`@babel/core/lib/transformation/file/generate.js`文件中的`let { code: outputCode, map: outputMap } = result;`方法。

> `RawMapping`中包含多个`mapping`，每一个`mapping`主要包含了一下字段：

```js
{
  // 会合并到生成的.map中的names
  name: '',
  generated: {
    line,// 生成代码的行位置
    column// 生成代码的列位置
  },
  source, //文件位置
  origin: {
    line,// 源代码的行位置
    column// 源代码的列位置
  }
}
```

首先看一下`@babel/generate/lib/source-map.js`中的代码：

```js
  // @babel/generate/lib/source-map.js
  var _sourceMap = _interopRequireDefault(require("source-map"));
  class SourceMap {
    constructor(opts, code) {
      // 一系列属性赋值
      this._cachedMap = void 0;
      this._code = void 0;
      this._opts = void 0;
      this._rawMappings = void 0;
      this._lastGenLine = void 0;
      this._lastSourceLine = void 0;
      this._lastSourceColumn = void 0;
      this._cachedMap = null;
      this._code = code;
      this._opts = opts;
      this._rawMappings = [];
    }
    // 劫持get()
    get() {
      if (!this._cachedMap) {
        // 设置source-map中的sourceRoot
        const map = this._cachedMap = new _sourceMap.default.SourceMapGenerator({
          sourceRoot: this._opts.sourceRoot
        });
        const code = this._code;
        // 如果源码为string设立SourceContent
        if (typeof code === "string") {
          map.setSourceContent(this._opts.sourceFileName.replace(/\\/g, "/"), code);
        else if (typeof code === "object") {
          // 如果为对象循环设置SourceContent
        }
        // 循环在buffer 中创建好的_rawMappings数组，并且通过addMapping添加进map实例
        this._rawMappings.forEach(mapping => map.addMapping(mapping), map);
      }
    }
    // 返回实例的_rawMappings数据copy
    getRawMappings() {
      return this._rawMappings.slice();
    }
    // 会在buffer中被调用把转义好的行列信息添加到_rawMappings数组中
    mark(generatedLine, generatedColumn, line, column, identifierName, filename, force) {
      this._rawMappings.push({
        name: identifierName || undefined,
        generated: {
          line: generatedLine,
          column: generatedColumn
        },
        source: line == null ? undefined : (filename || this._opts.sourceFileName).replace(/\\/g, "/"),
        original: line == null ? undefined : {
          line: line,
          column: column
        }
      });
    }
  }
```

首先`babel`中的source-map的实现是基于`mozilla/source-map`来实现的，`babel`主要是负责生成代码的行号、列号一系列操作。

### @babel/core/lib/transformation/file/generate.js

回到这里执行`let { code: outputCode, map: outputMap } = result;`，通过解构获取`result`中的map对象会走到`buffer.js`类中执行`map.get()`，又执行到`source-map.js`中的`get()`方法，执行`map.addMapping`的方法后，这个时候`map`的创建已经完成。通过`_cachedMap.JSON`就会返回当前`sourceMap`的JSON对象。

## webpack输出sourceMap

在上面知道了`sourceMap`是通过`babel-loader`生成的，`sourceMap`文件是怎么输出的呢？因为还要在生成的`chunk.js`中添加`//# sourceMappingURL=main.js.map`对应的`sourceMap`路径。

本段代码断点如下：

![输出source-map断点如下](./images/emit-source-map.png)

完成输出要通过两个插件`SourceMapDevToolPlugin`和`EvalSourceMapDevToolPlugin`会根据不同的`devtool`配置项，来加载不同的插件。直接上代码：

```js
  // ./lib/webpack.js
  const WebpackOptionsApply = require("./WebpackOptionsApply");
  const createCompiler = rawOptions => {
    const options = getNormalizedWebpackOptions(rawOptions);
    applyWebpackOptionsBaseDefaults(options);
    const compiler = new Compiler(options.context);
    compiler.options = options;
    new NodeEnvironmentPlugin({
      infrastructureLogging: options.infrastructureLogging
    }).apply(compiler);
    if (Array.isArray(options.plugins)) {
      for (const plugin of options.plugins) {
        if (typeof plugin === "function") {
          plugin.call(compiler, compiler);
        } else {
          plugin.apply(compiler);
        }
      }
    }
    applyWebpackOptionsDefaults(options);
    compiler.hooks.environment.call();
    compiler.hooks.afterEnvironment.call();
    // 加载webpack.config.js配置的loader等等操作
    new WebpackOptionsApply().process(options, compiler);
    compiler.hooks.initialize.call();
    return compiler;
  };
```

因为这里的具体操作都在另一篇文章中介绍过了，如果想了解请看[webapck 编译流程](./create-compiler.md)。
这里就不多赘述了，直接看`WebpackOptionsApply`中加载了`sourceMap`的插件。

```js
  // ./lib/WebpackOptionsApply.js
  class WebpackOptionsApply extends OptionsApply {
    constructor() {
      super();
    }
    process(options, compiler) {
      // 判断webpack.config.js中是否配置了devtool
      if (options.devtool) {
        // 判断devtool字段中是否包含了source-map字符串
        if (options.devtool.includes("source-map")) {
          const hidden = options.devtool.includes("hidden");
          const inline = options.devtool.includes("inline");
          // 是否包含了eval字符串
          const evalWrapped = options.devtool.includes("eval");
          const cheap = options.devtool.includes("cheap");
          const moduleMaps = options.devtool.includes("module");
          const noSources = options.devtool.includes("nosources");
          // 根据evalWrapped字段加载不同的字段
          const Plugin = evalWrapped
            ? require("./EvalSourceMapDevToolPlugin")
            : require("./SourceMapDevToolPlugin");
          // 初始化加载的插件；并且传入compiler对象
          new Plugin({
            filename: inline ? null : options.output.sourceMapFilename,
            moduleFilenameTemplate: options.output.devtoolModuleFilenameTemplate,
            fallbackModuleFilenameTemplate:
              options.output.devtoolFallbackModuleFilenameTemplate,
            append: hidden ? false : undefined,
            module: moduleMaps ? true : cheap ? false : true,
            columns: cheap ? false : true,
            noSources: noSources,
            namespace: options.output.devtoolNamespace
          }).apply(compiler);
        } else if (options.devtool.includes("eval")) {
          const EvalDevToolModulePlugin = require("./EvalDevToolModulePlugin");
          new EvalDevToolModulePlugin({
            moduleFilenameTemplate: options.output.devtoolModuleFilenameTemplate,
            namespace: options.output.devtoolNamespace
          }).apply(compiler);
        }
    }
  }

```

两种插件的初始化会在`WebpackOptionsApply().process(options, compiler)`中加载不同的插件，根据`devtool`字段判断加载不同的插件，这里首先看`devtool: 'source-map'`的配置，后面会根据`eval、inline、source-map`对比生成不同的代码。

### SourceMapDevToolPlugin 实现

在`WebpackOptionsApply.process`中实例化了`SourceMapDevToolPlugin`，下面看`SourceMapDevToolPlugin`具体坐了什么。

```js
  // ./lib/SourceMapDevToolPlugin.js
  class SourceMapDevToolPlugin {
    constructor(options = {}) {
      validate(schema, options, {
        name: "SourceMap DevTool Plugin",
        baseDataPath: "options"
      });
      // 对传入options进行处理
      this.sourceMappingURLComment =
        options.append === false
          ? false
          : options.append || "\n//# source" + "MappingURL=[url]";
      /** @type {string | Function} */
      this.moduleFilenameTemplate =
        options.moduleFilenameTemplate || "webpack://[namespace]/[resourcePath]";
      /** @type {string | Function} */
      this.fallbackModuleFilenameTemplate =
        options.fallbackModuleFilenameTemplate ||
        "webpack://[namespace]/[resourcePath]?[hash]";
      /** @type {string} */
      this.namespace = options.namespace || "";
      /** @type {SourceMapDevToolPluginOptions} */
      this.options = options;
    }
    apply (compiler) {
      // 处理一些必要配置字段如sourceMapFilename、sourceMappingURLComment
      const outputFs = compiler.outputFileSystem;
      const sourceMapFilename = this.sourceMapFilename;
      const sourceMappingURLComment = this.sourceMappingURLComment;
      const moduleFilenameTemplate = this.moduleFilenameTemplate;
      const namespace = this.namespace;
      const fallbackModuleFilenameTemplate = this.fallbackModuleFilenameTemplate;
      const requestShortener = compiler.requestShortener;
      const options = this.options;
      options.test = options.test || /\.(m?js|css)($|\?)/i;
      compiler.hooks.compilation.tap("SourceMapDevToolPlugin", compilation => {
        // 实例化SourceMapDevToolModuleOptionsPlugin会绑定buildModule、runtimeModule钩子
        new SourceMapDevToolModuleOptionsPlugin(options).apply(compilation);
        compilation.hooks.processAssets.tapAsync(
          {
            name: "SourceMapDevToolPlugin",
            stage: Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING,
            additionalAssets: true
          },
          (assets, callback) => {
            asyncLib.each(
              files,
              (file, callback) => {
              // 是否生成source-map路径到文件中
            }, err => {
              if (err) {
                return callback(err);
              }
              // 经过一系列处理
              const chunkGraph = compilation.chunkGraph;
              const cache = compilation.getCache("SourceMapDevToolPlugin");
              // 处理files字段

              const tasks = [];
              asyncLib.each(
                files,
                (file, callback) => {
                  // 处理cache

                  // 它为每一个目标文件，看情况创建一个task，创建了task的文件在末尾添加sourceMappingURL。
                  const task = getTaskForFile(
                    file,
                    asset.source,
                    asset.info,
                    {
                      module: options.module,
                      columns: options.columns
                    },
                    compilation,
                    cacheItem
                  );
                  if (task) {
                    // 循环modules moduleToSourceNameMapping中不存在往moduleToSourceNameMapping中添加
                    for (let idx = 0; idx < modules.length; idx++) {
                      const module = modules[idx];
                      if (!moduleToSourceNameMapping.get(module)) {
                        moduleToSourceNameMapping.set(
                          module,
                          ModuleFilenameHelpers.createFilename(
                            module,
                            {
                              moduleFilenameTemplate: moduleFilenameTemplate,
                              namespace: namespace
                            },
                            {
                              requestShortener,
                              chunkGraph
                            }
                          )
                        );
                      }
                    }
                    // task添加到tasks中
                    tasks.push(task);
                  }
                }, err => {
                  if (err) {
                    return callback(err);
                  }
                  // 拼接map路径和名字
                  asyncLib.each(
                    tasks,
                    (task, callback) => {
                      // 拿到要生成的source-map路径 '\n//# sourceMappingURL=[url]'
                      let currentSourceMappingURLComment = sourceMappingURLComment;
                      let asset = new RawSource(source);
                      // 处理sourceMap配置、如hash等等
                      if (currentSourceMappingURLComment !== false) {
                        // 把currentSourceMappingURLComment添加到compilation的asset中
                        // Add source map url to compilation asset, if currentSourceMappingURLComment is set
                        // 实例化ConcatSource用于把 source-map 路径写入源码中
                        asset = new ConcatSource(
                          asset,
                          compilation.getPath(
                            currentSourceMappingURLComment,
                            Object.assign({ url: sourceMapUrl }, pathParams)
                          )
                        );
                      }
                      // 更新compilation中的asset
                      compilation.updateAsset(file, asset, assetInfo);
                      // 输出文件
                      compilation.emitAsset(
                        sourceMapFile,
                        sourceMapAsset,
                        sourceMapAssetInfo
                      );
                    }, err => {
                      reportProgress(1.0);
                      callback(err);
                    })
                  })
                })
              })
            })
          }
        )
      }

    }
  }
```

以`devtool: 'source-map'`为例，`SourceMapDevToolPlugin`大致执行过程如下：

- 实例化`SourceMapDevToolModuleOptionsPlugin`插件，会在`compiler.hooks.compilation`上绑定回调函数
- 并且绑定`compilation.hooks.processAssets`钩子的异步回调函数；`compilation.hooks.processAssets`执行时机是在
`compilation.createChunkAssets`执行完成之后，也就是`chunkAsses`生成之后。
- 判断是否生成了`source-map`，如果生成了创建`task`并且添加到`tasks`中，后续循环`tasks`数据进行`source-map`的路径创建
- 通过`ConcatSource`把`RawSource`和`currentSourceMappingURLComment`合并，再通过`compilation.updateAsset`更新对应的`assets`对象。

### 结论

到此通过`runLoaders()`会返回通过`babel-loader`编译好的源码和`sourceMap`对象，在后面通过`SourceMapDevToolPlugin`中绑定`compilation.hooks.processAssets`钩子的回调函数，把对应的`source-map`的路径添加进对应的`chunk`源码中，后续就是对应的调用`emit`流程。

### 其它sourceMap相关

在`webpack.config.js`中也可以直接在`plugin`中配置`webpack.SourceMapDevToolPlugin`来指定`sourceMap-url`的生成规则。
> 注意： `devtool`和`webpack.SourceMapDevToolPlugin`不要同时使用

同时`optimization.minimizer`也可以配置`sourceMap: false`是否生成。

在`webpack 4.x`的前面版本，还是通过`uglifyjs-webpack-plugin`来实现代码的压缩，但是在`webpack 5.x`版本就没有引用了。

### webpack中devtool不同配置

webpack中大致分为`eval`、`source-map`、`cheap`、`module`、`inline`、`hidden`、`nosources`大致几类对比一下生成的`sourceMap`记性对比。

#### devtool: "source-map"配置

生成一个独立的`*.map`的文件用于存储映射的路径、行列、源码。

**mian.js**

```js
  // 大小为 213btyes

  /******/ (() => { // webpackBootstrap
  var __webpack_exports__ = {};
  /*!**********************!*\
    !*** ./src/index.js ***!
    \**********************/
  "I AM CHRIS";
  /******/ })()
  ;
  //# sourceMappingURL=main.js.map
```

**main.js.map**

```json
// 大小为 163btyes

{"version":3,"sources":["webpack://debug/./src/index.js"],"names":[],"mappings":";;;;;AAAA,a","file":"main.js","sourcesContent":["\"I AM CHRIS\""],"sourceRoot":""}
```

#### devtool: "eval"配置

**mian.js**

```js
  // 大小为 1KB

  /******/ (() => { // webpackBootstrap
  /******/ 	var __webpack_modules__ = ({

  /***/ "./src/index.js":
  /*!**********************!*\
    !*** ./src/index.js ***!
    \**********************/
  /***/ (() => {

  eval("\"I AM CHRIS\";\n\n//# sourceURL=webpack://debug/./src/index.js?");

  /***/ })

  /******/ 	});
  /************************************************************************/
  /******/ 	
  /******/ 	// startup
  /******/ 	// Load entry module and return exports
  /******/ 	// This entry module can't be inlined because the eval devtool is used.
  /******/ 	var __webpack_exports__ = {};
  /******/ 	__webpack_modules__["./src/index.js"]();
  /******/ 	
  /******/ })()
  ; 
```

#### devtool: "cheap-source-map" or "cheap-module-source-map" 配置

- `cheap-source-map`: 生成独立的`.map`文件，但是没有列映射(`column mapping`)的 `source map`，忽略 `loader source map`。
- `cheap-module-source-map`: 没有列映射(`column mapping`)的 `source map`，将 `loader source map` 简化为每行一个映射(`mapping`)。

**mian.js**

```js
  // 大小为 213btyes

  /******/ (() => { // webpackBootstrap
  var __webpack_exports__ = {};
  /*!**********************!*\
    !*** ./src/index.js ***!
    \**********************/
  "I AM CHRIS";
  /******/ })()
  ;
  //# sourceMappingURL=main.js.map
```

**main.js.map**

```json
// 大小为 154btyes

{"version":3,"file":"main.js","sources":["webpack://debug/./src/index.js"],"sourcesContent":["\"I AM CHRIS\";"],"mappings":";;;;;AAAA;;A","sourceRoot":""}
```

#### devtool: "inline-source-map"配置

完整的`source map`对象，`source map` 转换为 `DataUrl` 后添加到 `bundle` 中。

**mian.js**

```js
  // 大小为 465btyes

/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
"I AM CHRIS";
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9kZWJ1Zy8uL3NyYy9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGEiLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIlwiSSBBTSBDSFJJU1wiIl0sInNvdXJjZVJvb3QiOiIifQ==
```

#### devtool: "hidden-source-map"配置

这个与`source-map`差别就是在`mian.js`中没有对`source map`路径的引用。

**mian.js**

```js
  // 大小为 180btyes

  /******/ (() => { // webpackBootstrap
  var __webpack_exports__ = {};
  /*!**********************!*\
    !*** ./src/index.js ***!
    \**********************/
  "I AM CHRIS";
  /******/ })()
  ;
```

#### devtool: "nosources-source-map"配置

在创建`source map`的时候不添加`sourcesContent`字段。

**main.js.map**

```json
// 大小为 127btyes

{"version":3,"sources":["webpack://debug/./src/index.js"],"names":[],"mappings":";;;;;AAAA,a","file":"main.js","sourceRoot":""}
```

## 其它

`source map`在调试的时候可以设置`devtool: "cheap-module-source-map"`，但是在发布到线上环境时，不能把生成的`*.map`文件上传到服务器上，不然别人可以反编译你的代码。

**使用Fundebug**

如果使用`fundebug`可以参考[fundebug sourceMap 文档](https://docs.fundebug.com/notifier/javascript/sourcemap/)

**使用sentry**

如果使用`sentry`可以参考[sentry sourceMap 文档](https://docs.sentry.io/platforms/javascript/sourcemaps/tools/webpack/)

**反向解析source-map**

如果只是想把简单的`*.map`反编译为源码，可以通过`reverse-sourcemap`，但是这个库很早已经就已经不维护了。

```bash
  # 安装reverse-sourcemap
  npm install -g reverse-sourcemap
  # 运行反编译命令
  reverse-sourcemap -v ./debug/dist/mian.js.map -o sourcecode
```

基本上可以生成完整的源码，但是不包含第三方包。

**实现源码定位**

```js
// Get file content
const sourceMap = require('source-map');
const readFile = function (filePath) {
  return new Promise(function (resolve, reject) {
    fs.readFile(filePath, {encoding:'utf-8'}, function(error, data) {
      if (error) {
        console.log(error)
        return reject(error);
      }
      resolve(JSON.parse(data));
    });
  });
};

// Find the source location
async function searchSource(filePath, line, column) {
  const rawSourceMap = await readFile(filePath)
  const consumer = await new sourceMap.SourceMapConsumer(rawSourceMap);
  const res = consumer.originalPositionFor({
    'line' : line,
    'column' : column
   });
   consumer.destroy()
  return res
}
```

还是通过`source-map`提供的方法进行源码定位。这里的代码只是参考了别人的代码。在后期的会封装一个定制的错误监听库。

