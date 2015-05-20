var rScript = /<!--(?!\[)([\s\S]*?)(?:-->|$)|(<script[^>]*>([\s\S]*?)<\/script>)/ig;
var rScriptType = /type=('|")(.*?)\1/i;
var rSrcHref = /(?:src|href)=('|")(.+?)\1/i;
var rStyle = /<!--(?!\[)([\s\S]*?)(?:-->|$)|(<link[^>]*(?:\/)?>)|(<style[^>]*>([\s\S]*?)<\/style>)/ig;
var rRefStyle = /rel=('|")stylesheet\1/i;
var rLoader = /data\-loader(?:=('|").*?\1)?/i;
var common = require('../common.js');

/**
 * 查找 script，找到前端 loader 特殊处理。
 *
 * 以下两种 case 都被认为是前端 loader。
 * 1. mod.js、esl.js或者 require.js
 * 2. <script> 标签带有 data-loader 属性。
 */
function obtainFramework(content, resource, opts) {
  rScript.lastIndex = rLoader.lastIndex = 0;

  return content.replace(rScript, function(all, comment, script, body) {

    // 忽略注释。
    if (comment) {
      return all;
    }

    if (!body.trim() && rSrcHref.test(script)) {
      var src = RegExp.$2;
      var file = resource.getFileByUrl(src);

      // 如果 require.js 或者 esl.js 或者是 mod.js
      // 或者 <script 设置了 data-loader 属性
      // 则认为此资源为前端loader
      if (file && (rLoader.test(script) || ~['require.js', 'esl.js', 'mod.js'].indexOf(file.basename))) {

        // 根据 js 自动设置 resourceType。
        if (opts.resouceType === 'auto') {
          opts.resouceType = file.basename === 'mod.js' ? 'mod' : 'amd';
        }

        if (opts.obtainScript) {
          resource.add(file.id);

          if (opts.useInlineMap) {
            if (!~content.indexOf(opts.resoucePlaceHolder)) {
              resource.addJsEmbed('/*resourcemap*/\n'+opts.resoucePlaceHolder);
            }
          } else {
            resource.addJs(null, 'resoucePlaceHolder');
          }

          all = '';
        } else if (!~content.indexOf(opts.resoucePlaceHolder)) {
          all += '\n' + opts.resoucePlaceHolder;
        }
      }
    }

    return all;
  });
}

function obtainScript(content, resource, opts) {
  rScript.lastIndex = 0;
  return content.replace(rScript, function(all, comment, script, body) {

    if (comment) {
      return all;
    }

    if (!body.trim() && rSrcHref.test(script)) {
      var src = RegExp.$2;
      var file = resource.getFileByUrl(src);

      if (file) {
        resource.add(file.id);
        all = '';
      }
    } else if (!rScriptType.test(script) || rScriptType.test(script) && ~['text/javascript', 'application/javascript'].indexOf(RegExp.$2.toLowerCase())) {
      resource.addJsEmbed(body);
      all = '';
    }

    return all;
  });
}

function obtainStyle(content, resource) {
  rStyle.lastIndex = 0;
  return content.replace(rStyle, function(all, comment, link, style, body) {
    if (comment) {
      return all;
    }

    if (link && rRefStyle.test(link) && rSrcHref.test(link)) {
      var href = RegExp.$2;
      var file = resource.getFileByUrl(href);

      if (file) {
        resource.add(file.id);
        all = '';
      }
    } else if (style && body.trim()) {
      resource.addCssEmbed(body);
      all = '';
    }

    return all;
  });
}

function insertPlaceHolder(content, opts) {
  // 插入  style placeholder
  if (!~content.indexOf(opts.stylePlaceHolder)) {
    content = content.replace(/<\/head>/i, opts.stylePlaceHolder + '\n</head>');
  }

  if (!~content.indexOf(opts.scriptPlaceHolder)) {
    content = content.replace(/<\/body>/i, opts.scriptPlaceHolder + '\n</body>');
  }

  return content;
}

function init(file, resource, opts) {
  var content = file.getContent();
  content = insertPlaceHolder(content, opts);
  content = obtainFramework(content, resource, opts);
  file.setContent(content);
}

function beforePack(file, resource, opts) {
  var content = file.getContent();

  if (~content.indexOf(opts.scriptPlaceHolder) && opts.obtainScript) {
    content = obtainScript(content, resource, opts);
  }

  if (~content.indexOf(opts.stylePlaceHolder) && opts.obtainStyle) {
    content = obtainStyle(content, resource, opts);
  }

  file.setContent(content);

  // 如果是外链 resourceMap
  // 一定要放在 pack 之前。
  if (!opts.useInlineMap) {
    var idx = common.search(resource.js, function(item) {
      return item.type === 'resoucePlaceHolder';
    });

    if (~idx) {
      var filepath = common.tokenizePath(opts.resoucemap || '/pkg/${filepath}_map.js', {
        filepath: file.subpath,
        hash: file.getHash()
      });
      var pkg = fis.file(fis.project.getProjectPath(), filepath);
      pkg.setContent(resource[opts.resouceType === 'mod' ? 'buildResourceMap' : 'buildAMDPath']());
      resource._ret.idmapping[pkg.getId()] = pkg;
      resource._ret.pkg[pkg.getId()] = pkg;
      resource.js.splice(idx, 1, {
        type: 'js',
        id: pkg.getId(),
        uri: pkg.getUrl(),
        pkg: null
      });
    }
  }
};

function process(file, resource, opts) {
  var content = file.getContent();
  var pool = [];
  var list;

  if (~content.indexOf(opts.stylePlaceHolder)) {
    var css = '';

    // 把分析到的 css 内容输出，同时合并挨在一起的内嵌脚本
    if (resource.css.length) {
      pool = [];
      resource.css.forEach(function(item) {
        if (item.type === 'embed') {
          pool.push(item.content);
        } else {
          if (pool.length) {
            css += '<style>' + pool.join('\n') + '</style>\n';
            pool = [];
          }

          var msg = {
            target: item.uri,
            file: file,
            ret: item.uri
          };
          fis.emit('plugin:relative:fetch', msg);

          css += '<link rel="stylesheet" type="text/css" href="' + msg.ret + '" />\n';
        }
      });

      if (pool.length) {
        css += '<style>' + pool.join('\n') + '</style>\n';
      }
    }

    content = content.replace(opts.stylePlaceHolder, css);
  }

  if (~content.indexOf(opts.scriptPlaceHolder)) {
    var js = '';

    // 把分析到的 js 内容输出，同时合并挨在一起的内嵌脚本
    if (resource.js.length) {
      pool = [];
      resource.js.forEach(function(item) {
        if (item.type === 'embed') {
          pool.push(item.content);
        } else {
          if (pool.length) {
            js += '<script type="text/javascript">' + pool.join('\n') + '</script>\n';
            pool = [];
          }

          var msg = {
            target: item.uri,
            file: file,
            ret: item.uri
          };
          fis.emit('plugin:relative:fetch', msg);

          js += '<script type="text/javascript" src="' + msg.ret + '"></script>\n';
        }
      });

      if (pool.length) {
        js += '<script type="text/javascript">' + pool.join('\n') + '</script>\n';
      }
    }

    content = content.replace(opts.scriptPlaceHolder, js);
  }

  // 如果是内联 resoucemap 模式
  var idx = content.indexOf(opts.resoucePlaceHolder);
  if (~idx) {
    var resoucemap = resource[opts.resouceType === 'mod' ? 'buildResourceMap' : 'buildAMDPath']();

    // 如果是内嵌 resouceMap
    if (opts.useInlineMap) {

      // 当这个注释被塞到 jsEmbed 的时候，前面是有段注释的，如果这个条件满足，是不需要用 script 包起来的。
      // 注意在 obtainFramework 函数中的 resource.addJsEmbed('/*resourcemap*/\n'+opts.resoucePlaceHolder);
      if (content.substring(idx - 16, idx - 1) !== '/*resourcemap*/') {
        resoucemap = '<script type="text/javascript">' + resoucemap + '</script>';
      }
    } else {

      // 如果不是，那就是外链了。
      var filepath = common.tokenizePath(opts.resoucemap || '/pkg/${filepath}_map.js', {
        filepath: file.subpath,
        hash: file.getHash()
      });
      var pkg = fis.file(fis.project.getProjectPath(), filepath);
      pkg.setContent(resoucemap);
      resource._ret.pkg[pkg.getId()] = pkg;
      var msg = {
        target: pkg.getUrl(),
        file: file,
        ret: pkg.getUrl()
      };
      fis.emit('plugin:relative:fetch', msg);
      resoucemap = '<script type="text/javascript" src="'+msg.ret+'"></script>';
    }

    content = content.replace(opts.resoucePlaceHolder, resoucemap);
  }

  file.setContent(content);
};

module.exports = process;
process.init = init;
process.beforePack = beforePack;
process.obtainFramework = obtainFramework;
process.obtainScript = obtainScript;
process.obtainStyle = obtainStyle;
