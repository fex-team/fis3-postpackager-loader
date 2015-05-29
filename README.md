# fis3-postpackager-loader
静态资源前端加载器

## 注意
此插件做前端硬加载，适用于纯前端项目，不适用有后端 loader 的项目。因为不识别模板语言，对于资源的分析和收集，比较的粗鲁！！！

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

## 说明
待补充

## 配置说明

* `scriptPlaceHolder` 默认 `<!--SCRIPT_PLACEHOLDER-->`
* `stylePlaceHolder` 默认 `<!--STYLE_PLACEHOLDER-->`
* `resourcePlaceHolder` 默认`<!--RESOURCEMAP_PLACEHOLDER-->`
* `resourceType` 默认 'auto',
* `allInOne` 默认 false, 配置是否合并零碎资源。
* `obtainScript` 
* `obtainStyle`
* `useInlineMap`
