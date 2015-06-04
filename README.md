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



## 配置说明

* `scriptPlaceHolder` 默认 `<!--SCRIPT_PLACEHOLDER-->`
* `stylePlaceHolder` 默认 `<!--STYLE_PLACEHOLDER-->`
* `resourcePlaceHolder` 默认`<!--RESOURCEMAP_PLACEHOLDER-->`
* `resourceType` 默认 'auto',
* `allInOne` 默认 false, 配置是否合并零碎资源。
* `obtainScript` 是否收集 script 引用
* `obtainStyle` 是否收集 style 引用
* `useInlineMap` 是否将 sourcemap 作为内嵌脚本输出。
