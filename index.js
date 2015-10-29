var createResource = require('./lib/resource.js');
var allInOnePack = require('./lib/pack.js');
var _ = fis.util;

/**
 * 粗暴的打包器，纯前端嘛，不能识别模板语言，所以处理所有分析到的资源。
 */
function rudePackager(ret, pack, settings, opt) {
  var files = ret.src;
  var sources = _.toArray(files);

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

    compile(file);
  });

  function find(reg) {
    if (files[reg]) {
      return [files[reg]];
    } else if (reg === '**') {
      // do nothing
    } else if (typeof reg === 'string') {
      reg = _.glob(reg);
    }

    return sources.filter(function(file) {
      reg.lastIndex = 0;
      return (reg === '**' || reg.test(file.subpath));
    });
  }

  function compile(file) {
    var processor = rudePackager.lang[file.loaderLang] ||
      rudePackager.lang[settings.processor[file.ext]] ||
      rudePackager.lang.html;

    // 非 htmlLike 或者 没有处理器，或者已经处理过了，则跳过。
    if (file.release === false ||
        !file.isHtmlLike ||
        file.loaderLang === false ||
        file.loaderLang === null ||
        !processor ||
        file._resource) {
      return;
    }

    // 可以让 processor 调用。
    processor._compile = compile;

    // 修改之前先，先备份。
    file._rudeBackup = file.getContent();

    var resource = createResource(ret, file, settings);
    file._resource = resource;
    processor.init && processor.init(file, resource, settings);

    // 如果有设置需要额外的模块加入到 resouceMap 当中
    if (settings.include) {
      var patterns = settings.include;
      if (!Array.isArray(patterns)) {
        patterns = [patterns];
      }

      var list = [];
      patterns.forEach(function(pattern, index) {
        var exclude = typeof pattern === 'string' && pattern.substring(0, 1) === '!';

        if (exclude) {
          pattern = pattern.substring(1);

          // 如果第一个规则就是排除用法，都没有获取结果就排除，这是不合理的用法。
          // 不过为了保证程序的正确性，在排除之前，通过 `**` 先把所有文件获取到。
          // 至于性能问题，请用户使用时规避。
          index === 0 && (list = find('**'));
        }

        var mathes = find(pattern);
        list = _[exclude ? 'difference' : 'union'](list, mathes);
      });

      list.forEach(function(file) {
        resource.add(file.id, true);
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
  }
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
  // - `system` 生成适合 system.js 的版本
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
    includeAsyncs: false, // 可以配置成 true 用来包含异步依赖。
    ignore: null // 忽略列表，可以配置部分文件不被 all in one.
  }*/,

  // 是否捕获页面内的 <script src="xxx"> 资源
  // 捕获完后，会合并部分资源, 统一放在页面底部。
  obtainScript: true,

  // 是否捕获页面内的 <link ref="stylesheet"></link>
  // 捕获后，会合并部分资源，统一放在页首。
  obtainStyle: true,

  // 生成的 resourcemap 是内联呢？还是生成 js 文件外链？
  useInlineMap: false,

  loaderScripts: ['require.js', 'esl.js', 'mod.js', 'sea.js', 'system.js']
};

module.exports = rudePackager;
