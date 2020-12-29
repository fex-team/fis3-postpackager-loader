var rLinkScript = /(<!(?:--)?\[[\s\S]*?<\!\[endif\](?:--)?>|<!--[\s\S]*?(?:-->|$))|(?:(\s*<script([^>]*)>([\s\S]*?)<\/script>)|(?:\s*(<link([^>]*?)(?:\/)?>)|(<style([^>]*)>([\s\S]*?)<\/style>)))([\s\n\r]*<!--ignore-->)?\n?/gi;
// var rScript = /(<!(?:--)?\[[\s\S]*?<\!\[endif\](?:--)?>|<!--[\s\S]*?(?:-->|$))|(\s*<script([^>]*)>([\s\S]*?)<\/script>)(<!--ignore-->)?\n?/ig;
var rScriptType = /type=('|")(.*?)\1/i;
var rSrcHref = /\s*(?:src|href)=('|")(.+?)\1/i;
// var rStyle = /(<!(?:--)?\[[\s\S]*?<\!\[endif\](?:--)?>|<!--[\s\S]*?(?:-->|$))|(?:\s*(<link([^>]*?)(?:\/)?>)|(<style([^>]*)>([\s\S]*?)<\/style>))(<!--ignore-->)?\n?/ig;
var rRefStyle = /rel=('|")stylesheet\1/i;
var rLoader = /data\-loader(?:=('|").*?\1)?/i;
var rFramework = /data\-framework(?:=('|").*?\1)?/i;
var common = require("../common.js");
var rHead = /<!--([\s\S]+?)(?:-->|$)|<\/head>/gi;
var rBody = /<!--([\s\S]+?)(?:-->|$)|<\/body>/gi;
var path = require("path");

/**
 * 查找 script，找到前端 loader 特殊处理。
 *
 * 以下两种 case 都被认为是前端 loader。
 * 1. mod.js、esl.js或者 require.js
 * 2. <script> 标签带有 data-loader 属性。
 */
function obtainFramework(content, resource, opts, host) {
  rLinkScript.lastIndex = rLoader.lastIndex = 0;

  return content.replace(
    rLinkScript,
    function (
      all,
      comment,
      script,
      attrs,
      body,
      link,
      lattrs,
      style,
      sattrs,
      sbody,
      ignored
    ) {
      // 忽略注释。
      if (comment || ignored) {
        return all;
      }

      if (script && !body.trim() && rSrcHref.test(attrs)) {
        var src = RegExp.$2;
        var file = resource.getFileByUrl(src);

        attrs = attrs.replace(rSrcHref, "").replace(/\s+$/, "");

        if (!file) {
          file = resource.getFileByUrl(
            fis.util(path.join(path.dirname(host.release), src))
          );
        }

        // 如果 require.js 或者 esl.js 或者是 mod.js
        // 或者 <script 设置了 data-loader 属性
        // 则认为此资源为前端loader
        if (
          rLoader.test(attrs) ||
          (file && ~opts.loaderScripts.indexOf(file.basename))
        ) {
          // 根据 js 自动设置 resourceType。
          if (opts.resourceType === "auto" && file) {
            opts.resourceType =
              file.basename === "mod.js"
                ? "mod"
                : file.basename === "sea.js"
                ? "cmd"
                : file.basename === "system.js"
                ? "system"
                : "amd";
          }

          if (opts.obtainScript) {
            file
              ? resource.add(file.id, false, false, attrs)
              : resource.addJs(src, attrs);

            if (opts.useInlineMap) {
              if (!~content.indexOf(opts.resourcePlaceHolder)) {
                var idx = common.search(resource.res, function (item) {
                  return (
                    item.content ===
                    "/*resourcemap*/\n" + opts.resourcePlaceHolder
                  );
                });
                ~idx && resource.res.splice(idx, 1);

                resource.addJsEmbed(
                  "/*resourcemap*/\n" + opts.resourcePlaceHolder
                );
              }
            } else if (!~content.indexOf(opts.resourcePlaceHolder)) {
              var idx = common.search(resource.res, function (item) {
                return item.uri === "resourcePlaceHolder";
              });
              ~idx && resource.res.splice(idx, 1);

              resource.addJs("resourcePlaceHolder");
            }

            all = "";
          } else if (!~content.indexOf(opts.resourcePlaceHolder)) {
            all += "\n" + opts.resourcePlaceHolder;
          }
        } else if (rFramework.test(script) && opts.obtainScript) {
          file
            ? resource.add(file.id, false, false, attrs)
            : resource.addJs(src, attrs);
        }
      }

      return all;
    }
  );
}

function obtainScriptAndStyle(content, resource, opts, host, includeList) {
  rLinkScript.lastIndex = 0;

  var obtainStyle = ~content.indexOf(opts.stylePlaceHolder) && opts.obtainStyle;
  var obtainScript =
    ~content.indexOf(opts.scriptPlaceHolder) && opts.obtainScript;

  return content.replace(
    rLinkScript,
    function (
      all,
      comment,
      script,
      attrs,
      body,
      link,
      lattrs,
      style,
      sattrs,
      sbody,
      ignored
    ) {
      if (comment && ~comment.indexOf(opts.dependenciesInjectPlaceHolder)) {
        host.requires.forEach(function (id) {
          resource.add(id);
        });

        host.asyncs.forEach(function (id) {
          resource.add(id, true);
        });

        includeList.forEach(function (file) {
          resource.add(file.id, true);
        });

        return "";
      } else if (comment) {
        return all;
      } else if (script && !obtainScript) {
        return all;
      } else if ((link || style) && !obtainStyle) {
        return all;
      } else if (ignored) {
        // 如果是 ignored，至少应该把它原来的打包的路径替换掉。
        if (script && !body.trim() && rSrcHref.test(attrs)) {
          var src = RegExp.$2;
          var file = resource.getFileByUrl(src);
          attrs = attrs.replace(rSrcHref, "").replace(/\s+$/, "");

          if (!file) {
            file = resource.getFileByUrl(
              fis.util(path.join(path.dirname(host.release), src))
            );
          }

          if (file) {
            var url = resource.getUri(file.id, true);
            all = script.replace(rSrcHref, ' src="' + url + '"');
          }
        } else if (link && rRefStyle.test(lattrs) && rSrcHref.test(lattrs)) {
          var href = RegExp.$2;
          var file = resource.getFileByUrl(href);
          lattrs = lattrs.replace(rSrcHref, "").replace(/\s+$/, "");

          if (!file) {
            file = resource.getFileByUrl(
              fis.util(path.join(path.dirname(host.release), href))
            );
          }

          if (file) {
            var url = resource.getUri(file.id, true);
            all = link.replace(rSrcHref, ' href="' + url + '"');
          }
        }

        return all;
      }

      if (script && !body.trim() && rSrcHref.test(attrs)) {
        var src = RegExp.$2;
        var file = resource.getFileByUrl(src);
        attrs = attrs.replace(rSrcHref, "").replace(/\s+$/, "");

        if (!file) {
          file = resource.getFileByUrl(
            fis.util(path.join(path.dirname(host.release), src))
          );
        }

        file
          ? resource.add(file.id, false, false, attrs)
          : resource.addJs(src, attrs);
        all = "";
      } else if (
        (script && !rScriptType.test(attrs)) ||
        (rScriptType.test(attrs) &&
          ~["text/javascript", "application/javascript"].indexOf(
            RegExp.$2.toLowerCase()
          ))
      ) {
        resource.addJsEmbed(body, attrs);
        all = "";
      } else if (link && rRefStyle.test(lattrs) && rSrcHref.test(lattrs)) {
        var href = RegExp.$2;
        var file = resource.getFileByUrl(href);
        lattrs = lattrs.replace(rSrcHref, "").replace(/\s+$/, "");

        if (!file) {
          file = resource.getFileByUrl(
            fis.util(path.join(path.dirname(host.release), href))
          );
        }

        file
          ? resource.add(file.id, false, false, lattrs)
          : resource.addCss(href, lattrs);
        all = "";
      } else if (style && sbody.trim()) {
        resource.addCssEmbed(sbody, sattrs);
        all = "";
      }

      return all;
    }
  );
}

// function obtainScript(content, resource, opts, host) {
//   rScript.lastIndex = 0;
//   return content.replace(rScript, function(all, comment, script, attrs, body, ignored) {

//     if (comment || ignored) {
//       return all;
//     }

//     if (!body.trim() && rSrcHref.test(attrs)) {
//       var src = RegExp.$2;
//       var file = resource.getFileByUrl(src);
//       attrs = attrs.replace(rSrcHref, '').replace(/\s+$/, '');

//       if (!file) {
//         file = resource.getFileByUrl(fis.util(path.join(path.dirname(host.release), src)));
//       }

//       file ? resource.add(file.id, false, false, attrs) : resource.addJs(src, attrs);
//       all = '';
//     } else if (!rScriptType.test(attrs) || rScriptType.test(attrs) && ~['text/javascript', 'application/javascript'].indexOf(RegExp.$2.toLowerCase())) {
//       resource.addJsEmbed(body, attrs);
//       all = '';
//     }

//     return all;
//   });
// }

// function obtainStyle(content, resource, opts, host) {
//   rStyle.lastIndex = 0;
//   return content.replace(rStyle, function(all, comment, link, lattrs, style, sattrs, body, ignored) {
//     if (comment || ignored) {
//       return all;
//     }

//     if (link && rRefStyle.test(lattrs) && rSrcHref.test(lattrs)) {
//       var href = RegExp.$2;
//       var file = resource.getFileByUrl(href);
//       lattrs = lattrs.replace(rSrcHref, '').replace(/\s+$/, '');

//       if (!file) {
//         file = resource.getFileByUrl(fis.util(path.join(path.dirname(host.release), href)));
//       }

//       file ? resource.add(file.id, false, false, lattrs) : resource.addCss(href, lattrs);
//       all = '';
//     } else if (style && body.trim()) {
//       resource.addCssEmbed(body, sattrs);
//       all = '';
//     }

//     return all;
//   });
// }

function loadDeps(file, resource) {
  file.requires.forEach(function (id) {
    resource.add(id);
  });

  file.asyncs.forEach(function (id) {
    resource.add(id, true);
  });
}

function insertPlaceHolder(content, opts) {
  var flag;

  // 插入  style placeholder
  if (!~content.indexOf(opts.stylePlaceHolder)) {
    flag = false;
    content = content.replace(opts.rHead || rHead, function (all, comment) {
      if (comment) {
        return all;
      } else if (!flag) {
        flag = true;
        return "\n" + opts.stylePlaceHolder + "\n" + all;
      }
    });
  }

  if (!~content.indexOf(opts.scriptPlaceHolder)) {
    flag = false;
    content = content.replace(opts.rBody || rBody, function (all, comment) {
      if (comment) {
        return all;
      } else if (!flag) {
        flag = true;
        return "\n" + opts.scriptPlaceHolder + "\n" + all;
      }
    });
  }

  return content;
}

function init(file, resource, opts) {
  var content = file.getContent();
  content = insertPlaceHolder(content, opts);
  content = process.obtainFramework(content, resource, opts, file);
  // process.loadDeps(file, resource);
  file.setContent(content);
}

function beforePack(file, resource, opts, includeList) {
  var content = file.getContent();

  var cssAsyncs = [];

  // 如果没有添加 Dependencies inject 注释，那么依赖在分析代码之前加载。
  if (!~content.indexOf(opts.dependenciesInjectPlaceHolder)) {
    file.requires.forEach(function (id) {
      resource.add(id);
    });

    file.asyncs.forEach(function (id) {
      var file = resource.getFileById(id);

      if (file && file.isJsLike) {
        resource.add(id, true);
      } else {
        cssAsyncs.push(id);
      }
    });

    includeList.forEach(function (file) {
      if (file && file.isJsLike) {
        resource.add(file.id, true);
      } else {
        cssAsyncs.push(file.id);
      }
    });
  }

  // if (~content.indexOf(opts.stylePlaceHolder) && opts.obtainStyle) {
  //   content = process.obtainStyle(content, resource, opts, file);
  // }

  // if (~content.indexOf(opts.scriptPlaceHolder) && opts.obtainScript) {
  //   content = process.obtainScript(content, resource, opts, file);
  // }
  //

  content = process.obtainScriptAndStyle(
    content,
    resource,
    opts,
    file,
    includeList
  );

  cssAsyncs.forEach(function (id) {
    resource.add(id, true);
  });

  content = content.replace(/<!--ignore-->/gi, "");
  file.setContent(content);

  // 如果是外链 resourceMap
  // 一定要放在 pack 之前。
  if (!opts.useInlineMap) {
    var idx = common.search(resource.res, function (item) {
      return item.type === "js" && item.uri === "resourcePlaceHolder";
    });

    if (~idx) {
      var resoucemap = resource.buildConf(opts.resourceType);
      if (!resoucemap) {
        resource.res.splice(idx, 1);

        idx = common.search(resource.js, function (item) {
          return item.uri === "resourcePlaceHolder";
        });
        ~idx && resource.js.splice(idx, 1);
      } else {
        var filepath = common.tokenizePath(
          opts.resoucemap || "/pkg/${filepath}_map.js",
          {
            filepath: file.subpath,
            hash: file.getHash(),
          }
        );
        var pkg = fis.file(fis.project.getProjectPath(), filepath);
        pkg.setContent(resoucemap);
        var item = {
          type: "js",
          id: pkg.getId(),
          uri: pkg.getUrl(),
          pkg: null,
          attrs: ' type="text/javascript"',
        };
        resource._ret.idmapping[pkg.getId()] = pkg;
        resource._ret.pkg[pkg.getId()] = pkg;
        resource.res.splice(idx, 1, item);

        idx = common.search(resource.js, function (item) {
          return item.uri === "resourcePlaceHolder";
        });
        ~idx && resource.js.splice(idx, 1, item);
      }
    }
  }
}

function process(file, resource, opts) {
  var content = file.getContent();
  var pool = [];
  var list;

  resource.calculate();

  if (~content.indexOf(opts.stylePlaceHolder)) {
    var css = [];
    var lastItem;

    // 把分析到的 css 内容输出，同时合并挨在一起的内嵌脚本
    if (resource.css.length) {
      pool = [];
      resource.css.forEach(function (item) {
        if (item.embed) {
          pool.push(item.content);
          lastItem = item;
        } else {
          if (pool.length) {
            css.push(
              "<style" + lastItem.attrs + ">" + pool.join("\n") + "</style>"
            );
            pool = [];
          }

          var msg = {
            target: item.uri,
            file: file,
            ret: item.uri,
          };

          // 只处理认识的 id
          if (item.id) {
            fis.emit("plugin:relative:fetch", msg);
          }

          css.push("<link" + item.attrs + ' href="' + msg.ret + '" />');
        }
      });

      if (pool.length) {
        css.push(
          "<style" + lastItem.attrs + ">" + pool.join("\n") + "</style>"
        );
      }
    }

    content = content.replace(
      new RegExp(opts.stylePlaceHolder, "gm"),
      "    " + css.join("\n    ")
    );
  }

  if (~content.indexOf(opts.scriptPlaceHolder)) {
    var js = [],
      lastItem;

    // 把分析到的 js 内容输出，同时合并挨在一起的内嵌脚本
    if (resource.js.length) {
      pool = [];
      resource.js.forEach(function (item) {
        if (item.embed) {
          pool.push(item.content || "");
          lastItem = item;
        } else {
          if (pool.length) {
            js.push(
              "<script" + item.attrs + ">" + pool.join("\n") + "</script>"
            );
            pool = [];
          }

          var msg = {
            target: item.uri,
            file: file,
            ret: item.uri,
          };

          // 只处理认识的 id
          if (item.id) {
            fis.emit("plugin:relative:fetch", msg);
          }

          js.push("<script" + item.attrs + ' src="' + msg.ret + '"></script>');
        }
      });

      if (pool.length) {
        js.push(
          "<script" + lastItem.attrs + ">" + pool.join("\n") + "</script>"
        );
      }
    }

    // 用 function  来解决 $$ => $ 的问题
    content = content.replace(opts.scriptPlaceHolder, function () {
      return js.join("\n");
    });
  }

  // 如果是内联 resoucemap 模式
  var idx = content.indexOf(opts.resourcePlaceHolder);
  if (~idx) {
    var resoucemap = resource.buildConf(opts.resourceType);

    // 如果是内嵌 resouceMap
    if (opts.useInlineMap) {
      // 当这个注释被塞到 jsEmbed 的时候，前面是有段注释的，如果这个条件满足，是不需要用 script 包起来的。
      // 注意在 obtainFramework 函数中的 resource.addJsEmbed('/*resourcemap*/\n'+opts.resourcePlaceHolder);
      if (content.substring(idx - 16, idx - 1) !== "/*resourcemap*/") {
        resoucemap = resoucemap
          ? '<script type="text/javascript">' + resoucemap + "</script>"
          : "";
      }
    } else if (resoucemap) {
      // 如果不是，那就是外链了。
      var filepath = common.tokenizePath(
        opts.resoucemap || "/pkg/${filepath}_map.js",
        {
          filepath: file.subpath,
          hash: file.getHash(),
        }
      );
      var pkg = fis.file(fis.project.getProjectPath(), filepath);
      pkg.setContent(resoucemap);
      resource._ret.pkg[pkg.getId()] = pkg;
      var msg = {
        target: pkg.getUrl(),
        file: file,
        ret: pkg.getUrl(),
      };
      fis.emit("plugin:relative:fetch", msg);
      resoucemap =
        '<script type="text/javascript" src="' + msg.ret + '"></script>';
    }

    content = content.replace(opts.resourcePlaceHolder, resoucemap);

    // 当 resource map 是空的时候需要处理下！
    if (!resoucemap) {
      content = content.replace(
        '<script type="text/javascript">/*resourcemap*/\n</script>\n',
        ""
      );
    }
  }

  file.setContent(content);
}

module.exports = process;
process.init = init;
process.loadDeps = loadDeps;
process.beforePack = beforePack;
process.obtainFramework = obtainFramework;
process.obtainScriptAndStyle = obtainScriptAndStyle;
// process.obtainScript = obtainScript;
// process.obtainStyle = obtainStyle;
