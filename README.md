# fis3-postpackager-loader
静态资源前端加载器，用来分析页面中`使用的`和`依赖的`资源（js或css）, 并将资源自动插入到 html 页面内容中。

## 注意
此插件做前端硬加载，适用于纯前端项目，不适用有后端 loader 的项目。因为不识别模板语言，对于资源的分析和收集，比较的粗暴！！！

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

## 处理流程说明
如果你真的很关心的话，以下详细的流程处理介绍。

先假定所有优化功能全开，处理流程如下：

1. 遍历所有的 html 文件，每个文件单独走以下流程。
2. 分析 html 内容，插入注释块 `<!--SCRIPT_PLACEHOLDER-->` 到 `</body>` 前面，如果页面里面没有这个注释块的话。
3. 分析 html 内容，插入注释块 `<!--STYLE_PLACEHOLDER-->` 到 `</head>` 前面，如果页面没有这个注释的话。
4. 分析源码中 `<script>` 带有 data-loader 属性的资源找出来，如果有的话。把找到的 js 加入队列，并且在该 `<script>` 后面加入 `<!--RESOURCEMAP_PLACEHOLDER-->` 注释块，如果页面里面没有这个注释的话。
5. 分析源码中 `<script>` 带有 data-framework 属性的资源找出来。把找到的 js 加入队列。
6. 分析此 html 文件的依赖，以及递归进去查找依赖中的依赖。把分析到的 js 加入到队列，css 加入到队列。
7. 分析此 html 中 `<script>` 、 `<link>` 和 `<style>` 把搜集到的资源加入队列。
8. 启用 allinone 打包，把队列中，挨一起的资源合并。如果是内联内容，直接合并即可，如果是外链文件，则合并文件内容，生成新内容。
9. 把优化后的结果，即队列中资源，插入到 `<!--SCRIPT_PLACEHOLDER-->` 、 `<!--STYLE_PLACEHOLDER-->` 和 `<!--RESOURCEMAP_PLACEHOLDER-->` 注释块。

那么 js 的输出顺序就是：带 `data-loader` 的js，带 resource map 信息的js, 带 `data-framework` 的js，依赖中的 js, 页面中其他 js.

## 配置说明

* `scriptPlaceHolder` 默认 `<!--SCRIPT_PLACEHOLDER-->`
* `stylePlaceHolder` 默认 `<!--STYLE_PLACEHOLDER-->`
* `resourcePlaceHolder` 默认`<!--RESOURCEMAP_PLACEHOLDER-->`
* `resourceType` 默认 'auto',
* `allInOne` 默认 false, 配置是否合并零碎资源。
* `obtainScript` 是否收集 script 引用
* `obtainStyle` 是否收集 style 引用
* `useInlineMap` 是否将 sourcemap 作为内嵌脚本输出。
