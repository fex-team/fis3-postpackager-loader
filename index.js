var createResource = require('./lib/resource.js');
var allInOnePack = require('./lib/pack.js');

/**
 * 粗暴的打包器，纯前端嘛，不能识别模板语言，所以处理所有分析到的资源。
 */
function rudePackager(ret, pack, settings, opt) {
  var files = ret.src;

  // 生成映射表，方便快速查找！
  var idmapping = ret.idmapping = {};
  var urlmapping = ret.urlmapping = {};
  Object.keys(files).forEach(function(subpath) {
    var file = files[subpath];
    idmapping[file.id] = file;
    if (file.release) {
      urlmapping[file.getUrl()] = file;
    }
  });

  Object.keys(files).forEach(function(subpath) {
    var file = files[subpath];

    // 只处理 html like 的文件。
    if (!file.isHtmlLike) {
      return;
    }

    var processor = rudePackager.lang[file.loaderLang] || rudePackager.lang[settings.processor[file.ext]];
    if (!processor) {
      return;
    }

    // 修改之前先，先备份。
    file._rudeBackup = file.getContent();

    var resource = createResource(ret, file);
    processor.init && processor.init(file, resource, settings);

    // all in one 包含异步依赖。
    if (settings.allInOne && settings.allInOne.includeAsyncs) {
      // 把所以异步的 js 当同步加载。
      resource.res.forEach(function(item) {
        item.async = false;
      });
    }

    processor.beforePack && processor.beforePack(file, resource, settings);

    if (settings.allInOne) {
      allInOnePack(file, resource, ret, settings.allInOne === true ? {} : settings.allInOne);
    }

    processor.before && processor.before(file, resource, settings);
    processor(file, resource, settings);
    processor.after && processor.after(file, resource, settings);

    ret.pkg[file.subpath] = file;
  });
}

rudePackager.lang = {
  html: require('./lib/lang/html.js')
};

// 默认配置信息
rudePackager.defaultOptions = {
  // 脚本占位符
  scriptPlaceHolder: '<!--SCRIPT_PLACEHOLDER-->',

  // 样式占位符
  stylePlaceHolder: '<!--STYLE_PLACEHOLDER-->',

  // 资源占位符
  resourcePlaceHolder: '<!--RESOURCEMAP_PLACEHOLDER-->',

  // 资源表格式。
  // 可选：
  // - `auto` 根据用户选择的 js 来自动设置。
  // - `mod` 生成适合 mod.js 的版本。
  // - `amd` 生成适合 require.js 的版本。
  // - `cmd` 生成适合 sea.js 的版本
  resourceType: 'auto',

  // 页面类型
  // 可选：
  // - `html` 普通 html 页面
  processor: {
    '.html': 'html'
  },

  // 是否将所有零散文件合并成一个文件。
  // 如果用户配置 pack，  则 用户配置的 pack 优先。
  allInOne: false/*{
    css: '', // 打包后 css 的文件路径。
    js: '',  // 打包后 js 的文件路径。
    includeAsyncs: false, // 可以配置成
    ignore: null // 忽略列表，可以配置部分文件不被 all in one.
  }*/,

  // 是否捕获页面内的 <script src="xxx"> 资源
  // 捕获完后，会合并部分资源, 统一放在页面底部。
  obtainScript: true,

  // 是否捕获页面内的 <link ref="stylesheet"></link>
  // 捕获后，会合并部分资源，统一放在页首。
  obtainStyle: true,

  // 生成的 resourcemap 是内联呢？还是生成 js 文件外链？
  useInlineMap: false
};

module.exports = rudePackager;
