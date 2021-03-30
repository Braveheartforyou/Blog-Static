## SourceMap

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

