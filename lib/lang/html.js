var rScript = /<!--(?!\[)([\s\S]*?)(?:-->|$)|(<script[^>]*>([\s\S]*?)<\/script>)/ig;
var rScriptType = /type=('|")(?:text|application)\/javascript\1/i;
var rSrcHref = /(?:src|href)=('|")(.+?)\1/i;
var rStyle = /<!--(?!\[)([\s\S]*?)(?:-->|$)|(<link[^>]*(?:\/)?>)|(<style[^>]*>([\s\S]*?)<\/style>)/ig;
var rRefStyle = /rel=('|")stylesheet\1/i;
var rLoader = /data\-loader(?:=('|").*?\1)?/i;

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

        if (!~content.indexOf(opts.resoucePlaceHolder)) {
          resource.addJsEmbed(opts.resoucePlaceHolder);
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
    } else if (rScriptType.test(script)) {
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

  if (~content.indexOf(opts.resoucePlaceHolder)) {
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
