# fis3-postpackager-loader
静态资源前端加载器，用来分析页面中`使用的`和`依赖的`资源（js或css）, 并将这些资源做一定的优化后插入页面中。如把零散的文件合并。

## 注意
**此插件做前端硬加载，适用于纯前端项目，不适用有后端 loader 的项目。因为不识别模板语言，对于资源的分析和收集，比较的粗暴！！！**

默认会把页面中用到的样式插入在 header 中，脚本插入在 body 底部。如果想修改，请在页面自己插入 `<!--SCRIPT_PLACEHOLDER-->` 和 `<!--STYLE_PLACEHOLDER-->` 占位符来控制位置。

此插件会收集所有的资源，如果希望某个资源不被收集，请在资源结尾处如 `</script>` 后面加上 `<!--ignore-->` 注释.

```html
<script src="lib.js"></script><!--ignore-->
```

注意：被 ignore 的资源，不会被修改位置，同时也不会参与 allInOne 合并。

## 安装
支持全局安装和局部安装，根据自己的需求来定。

```bash
npm install fis3-postpackager-loader
```

## 使用

```javascript
fis.match('::packager', {
  postpackager: fis.plugin('loader', {
    allInOne: true
  })
});
```

## 文件属性

新版本中所有 `isHtmlLike:true` 的资源都会默认采用 html 的方式来处理，比如： `.md`, `.tpl` 或者是更多。如果你希望某类 `isHtmlLike` 为 `true` 的资源，不经过此插件处理，那么请设置 `loaderLang` 属性为 `false`。

```js
fis.match('*.md', {
  loaderLang: false
});
```

## 处理流程说明
如果你真的很关心的话，以下详细的流程处理介绍。

先假定所有优化功能全开，处理流程如下：

1. 遍历所有的 html 文件，每个文件单独走以下流程。
2. 分析 html 内容，插入注释块 `<!--SCRIPT_PLACEHOLDER-->` 到 `</body>` 前面，如果页面里面没有这个注释块的话。
3. 分析 html 内容，插入注释块 `<!--STYLE_PLACEHOLDER-->` 到 `</head>` 前面，如果页面没有这个注释的话。
4. 分析源码中 `<script>` 带有 data-loader 属性的或者资源名为[mod.js, require.js, sea.js, system.js]的资源找出来，如果有的话。把找到的 js 加入队列，并且在该 `<script>` 后面加入 `<!--RESOURCEMAP_PLACEHOLDER-->` 注释块，如果页面里面没有这个注释的话。
5. 分析源码中 `<script>` 带有 data-framework 属性的资源找出来。把找到的 js 加入队列。
6. 分析此 html 文件的依赖，以及递归进去查找依赖中的依赖。把分析到的 js 加入到队列，css 加入到队列。
7. 分析此 html 中 `<script>` 、 `<link>` 和 `<style>` 把搜集到的资源加入队列。
8. 启用 allinone 打包，把队列中，挨一起的资源合并。如果是内联内容，直接合并即可，如果是外链文件，则合并文件内容，生成新内容。
9. 把优化后的结果，即队列中资源，插入到 `<!--SCRIPT_PLACEHOLDER-->` 、 `<!--STYLE_PLACEHOLDER-->` 和 `<!--RESOURCEMAP_PLACEHOLDER-->` 注释块。

那么 js 的输出顺序就是：带 `data-loader` 的js，带 resource map 信息的js, 带 `data-framework` 的js，依赖中的 js, 页面中其他 js.

也就是说，如果你发现资源的加载顺序不符合你的预期时，请加适当的属性来调整资源级别。

### 疑问解释

#### 什么是页面依赖？

分两种方式指定依赖：

1. 通过 fis 中的注释指定依赖。

  ```
  <!--@require "xxx.js"-->
  ```

  更多用法，请查看[声明依赖](https://github.com/fex-team/fis3/wiki/%E5%A3%B0%E6%98%8E%E4%BE%9D%E8%B5%96)
2. 通过 js 语句指定依赖。

  ```javascript
  require('./main');
  ```
  表示此代码所在的文件，依赖当前目录下面的 main.js 文件。

另外依赖又分两种性质，以上都是同步依赖，还有一种异步依赖。

```javascript
require(['./main']);
```

同步js 是页面加载时加载，而异步js 依赖则是运行时加载，能满足按需加载的需求。

### 什么是 js loader

fis 中对依赖的js 加载，尤其是异步  js，需要一个 js loader。比如 mod.js 是一个 loader, require.js 也是一种 loader。

#### 什么是 resourcemap ?

当有异步依赖的时候，为了让 loader 知道文件所在位置，所以需要需要 resourcemap 信息。

此插件能生成两类 resourcemap.

1. 给 mod.js 用的，格式如下:

  ```javascript
  require.resourcemap({
    res: {...},
    pkg: {...}
  })
  ```
2. 给 require.js amd loader 用的，格式如下:

  ```javascript
  require.config({
    paths: {
      ...
    }
  })
  ```

## 配置说明

* `scriptPlaceHolder` 默认 `<!--SCRIPT_PLACEHOLDER-->`
* `stylePlaceHolder` 默认 `<!--STYLE_PLACEHOLDER-->`
* `resourcePlaceHolder` 默认`<!--RESOURCEMAP_PLACEHOLDER-->`
* `resourceType` 默认 'auto', 可选 `'mod'`、`'amd'`、`'system'`、`'cmd'(sea.js)`。
* `allInOne` 默认 false, 配置是否合并零碎资源。

  allInOne 接收对象配置项。

  - `css` all in one 打包后， css 文件的路径规则。默认为 `pkg/${filepath}_aio.css`
  - `js` all in one 打包后， js 文件的路径规则。默认为 `pkg/${filepath}_aio.js`
  - `includeAsyncs` 默认为 false。all in one 打包，是不包含异步依赖的，不过可以通过把此属性设置成 true，包含异步依赖。
  - `ignore` 默认为空。如果不希望部分文件被 all in one 打包，请设置 ignore 清单。
  - `sourceMap` 默认为 `false`。是否生成 sourcemap.

* `processor` 默认为 `{'.html': 'html'}`, 即支持后缀是 .html 的文件，如果要支持其他后缀，请在此扩展。

  ```js
  fis.match('::package', {
    postpackager: fis.plugin('loader', {
      processor: {
        '.html': 'html',

        // 支持 markdown 文档
        '.md': 'html'
      }
    })
  })
  ```
* `obtainScript` 是否收集 `<script>` 内容。（非页面依赖部分）
* `obtainStyle` 是否收集 `<style>` 和 `<link>` 内容。（非页面依赖部分）
* `useInlineMap` 是否将 sourcemap 作为内嵌脚本输出。
* `resoucemap` 默认为 `/pkg/${filepath}_map.js` 当 `useInLineMap` 为 `false` 的时候有效，用来控制 resourcemap 生成位置。
* `include` 默认生成的 sourcemap 只会包含异步依赖的 js, 如果想把一批模块化的 js 加入到 sourcemap 中，请参考一下配置：

  ```js
  fis.match('::package', {
    postpackager: fis.plugin('loader', {
      include: '/widget/a/**.js'
    })
  })

  fis.match('::package', {
    postpackager: fis.plugin('loader', {
      include: [
        '/widget/**.js',
        '!/widget/a/**.js'
      ]
    })
  })
  ```

