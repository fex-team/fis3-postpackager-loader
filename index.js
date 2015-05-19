var createResouce = require('./lib/resource.js');
var allInOnePack = require('./lib/pack.js');

function rudePackager(ret, pack, settings, opt) {
  var files = ret.src;

  // 生成映射表，方便快速查找！
  var idmapping = ret.idmapping = {};
  var urlmapping = ret.urlmapping = {};
  Object.keys(files).forEach(function(subpath) {
    var file = files[subpath];
    idmapping[file.id] = file;
    urlmapping[file.getUrl()] = file;
  });

  Object.keys(files).forEach(function(subpath) {
    var file = files[subpath];

    // 只处理 html like 的文件。
    if (!file.isHtmlLike) {
      return;
    }

    var resouce = createResouce(ret, file);
    var processor = rudePackager.lang[settings.processor[file.ext]] || rudePackager.lang.html;

    processor.init && processor.init(file, resouce, settings);

    file.requires.forEach(function(id) {
      resouce.add(id);
    });

    file.asyncs.forEach(function(id) {
      resouce.add(id, true);
    });

    processor.before && processor.before(file, resouce, settings);

    if (settings.allInOne) {
      allInOnePack(file, resouce, ret, settings.allInOne === true ? {} : settings.allInOne);
    }

    processor(file, resouce, settings);

    processor.after && processor.after(file, resouce, settings);
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
  resoucePlaceHolder: '<!--RESOURCEMAP_PLACEHOLDER-->',

  // 资源表格式。
  // 可选：
  // - `auto` 根据用户选择的 js 来自动设置。
  // - `mod` 生成适合 mod.js 的版本。
  // - `amd` 生成适合 require.js 的版本。
  resouceType: 'auto',

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
    js: ''  // 打包后 js 的文件路径。
  }*/,

  // 是否捕获页面内的 <script src="xxx"> 资源
  obtainScript: true,

  // 是否捕获页面内的 <link ref="stylesheet"></link>
  obtainStyle: true,

  // 生成的 resoucemap 是内联呢？还是生成 js 文件外链1？
  useInlineMap: false
};

module.exports = rudePackager;
