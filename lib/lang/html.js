var rScript = /<!--(?!\[)([\s\S]*?)(?:-->|$)|(<script[^>]*>([\s\S]*?)<\/script>)/ig;
var rScriptType = /type=('|")(.*?)\1/i;
var rSrcHref = /(?:src|href)=('|")(.+?)\1/i;
var rStyle = /<!--(?!\[)([\s\S]*?)(?:-->|$)|(<link[^>]*(?:\/)?>)|(<style[^>]*>([\s\S]*?)<\/style>)/ig;
var rRefStyle = /rel=('|")stylesheet\1/i;
var rLoader = /data\-loader(?:=('|").*?\1)?/i;
var common = require('../common.js');

function obtainFramework(content, resource, opts) {
  rScript.lastIndex = rLoader.lastIndex = 0;

  return content.replace(rScript, function(all, comment, script, body) {

    if (comment) {
      return all;
    }

    if (!body.trim() && rSrcHref.test(script)) {
      var src = RegExp.$2;
      var file = resource.getFileByUrl(src);

      if (file && (rLoader.test(script) || ~['require.js', 'esl.js', 'mod.js'].indexOf(file.basename))) {
        resource.add(file.id);

        if (opts.resouceType === 'auto') {
          opts.resouceType = file.basename === 'mod.js' ? 'mod' : 'amd';
        }

        if (opts.useInlineMap) {
          if (!~content.indexOf(opts.resoucePlaceHolder)) {
            resource.addJsEmbed(opts.resoucePlaceHolder);
          }
        } else {
          resource.addJs(null, 'resoucePlaceHolder');
        }

        all = '';
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

function initProcess(file, resource, opts) {
  var content = file.getContent();
  content = insertPlaceHolder(content, opts);

  // get loader
  content = obtainFramework(content, resource, opts);

  file.setContent(content);
}

function beforeProcess(file, resource, opts) {
  var content = file.getContent();

  if (~content.indexOf(opts.scriptPlaceHolder) && opts.obtainScript) {
    content = obtainScript(content, resource, opts);
  }

  if (~content.indexOf(opts.stylePlaceHolder) && opts.obtainStyle) {
    content = obtainStyle(content, resource, opts);
  }

  file.setContent(content);

  // 如果是外链 resourceMap
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

    pool = [];
    if (resource.css.length) {
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
    pool = [];
    if (resource.js.length) {
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
  if (opts.useInlineMap && ~content.indexOf(opts.resoucePlaceHolder)) {
    var resoucemap = resource[opts.resouceType === 'mod' ? 'buildResourceMap' : 'buildAMDPath']();
    content = content.replace(opts.resoucePlaceHolder, resoucemap);
  }

  file.setContent(content);
};

module.exports = process;
process.init = initProcess;
process.before = beforeProcess;
process.obtainFramework = obtainFramework;
process.obtainScript = obtainScript;
process.obtainStyle = obtainStyle;
