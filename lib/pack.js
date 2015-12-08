/**
 * 将零散的文件打包合成一个新文件。
 */
var common = require('./common.js');
var SourceMap = require('source-map');
var _ = fis.util;
var rSourceMap = /\/\/\#\s*sourceMappingURL[^\n\r]*/ig;

module.exports = function(file, resource, ret, opts) {
  var root = fis.project.getProjectPath();
  var ignoreList;

  resource.calculate();

  // 把异步池子中 js 放到同步的池子中
  /*if (opts.includeAsyncs) {
    resource.asyncs.forEach(function(item) {
      item.async = false;
      item.id && (resource.loaded[item.id] = false);
      resource[item.type === 'js' ? 'js' : 'css'].push(item);
    });

    resource.asyncs = [];
  }*/

  // normalize ignore.
  if (opts.ignore) {
    ignoreList = opts.ignore;

    if (typeof ignoreList === 'string') {
      ignoreList = ignoreList.split(/\s*,\s*/);
    } else if (!Array.isArray(ignoreList)) {
      ignoreList = [ignoreList];
    }

    ignoreList = ignoreList.map(function(item) {
      return typeof item === 'string' ? _.glob(item) : item;
    });
  } 

  pack(resource.js, opts.js || 'pkg/${filepath}_aio.js', opts.sourceMap);
  pack(resource.css, opts.css || 'pkg/${filepath}_aio.css', opts.sourceMap);

  function isIgnored(item) {
    if (!ignoreList || !ignoreList.length) {
      return false;
    }

    var file = null;

    if (item.id) {
      file = resource.getFileById(item.id)
    } else {
      file = resource.getFileByUrl(item.uri);
    }

    var filepath = file ? file.subpath : item.uri;
    var hitted = false;

    ignoreList.every(function(reg) {

      if (reg.test(filepath)) {
        hitted = true;
        return false;
      }

      return true;
    });

    return hitted;
  }

  function pack(list, fileTpl, sourceMap) {
    var index = 1;
    var i = 0;
    var unpacked = [];
    var item;

    while (i < list.length) {
      item = list[i];

      if (item.id && !(item.pkg && !item.allInOne) && (!opts.ignore || !isIgnored(item))/**/) {
        unpacked.push(item);
        list.splice(i, 1);
        // todo 可能还要删除其他东西。
      } else {
        if (unpacked.length > 1) {
          _pack();
        } else if (unpacked.length) {
          list.splice(i, 0, unpacked[0]);
        }

        unpacked = [];
        i++;
      }
    }

    if (unpacked.length > 1) {
      _pack();
    } else if (unpacked.length) {
      list.push(unpacked.pop());
    }

    function _pack() {
      var filepath = common.tokenizePath(fileTpl, {
        filepath: file.subpath,
        hash: file.getHash()
      });

      if (index>1) {
        filepath = filepath.replace(/\.([^\.]+)$/i, function(ext) {
          return '_' + index + ext;
        });
      }

      var pkg = fis.file(root, filepath);
      var has = [];

      var sourceNode;
      if (sourceMap) {
        sourceNode = new SourceMap.SourceNode();
      }

      var content = '';
      unpacked.forEach(function(item) {
        var file = ret.idmapping[item.id];
        var prefix = (file.isJsLike ? '/*!' + file.id + '*/\n;' : '/*!' + file.id + '*/\n');
        var map = file.map = file.map || {};

        map.aioPkg = pkg.getId();
        has.push(file.getId());

        // 派送事件
        var message = {
          file: file,
          content: file.getContent(),
          pkg: pkg
        };
        fis.emit('pack:file', message);
        message.content = message.content.replace(rSourceMap, '');

        if (sourceNode) {
          sourceNode.add(prefix);

          var mapFile = getMapFile(file);

          if (mapFile) {
            var json = JSON.parse(mapFile.getContent());
            var smc = new SourceMap.SourceMapConsumer(json);

            sourceNode.add(SourceMap.SourceNode.fromStringWithSourceMap(message.content, smc));
            // mapFile.release = false;
          } else {
            sourceNode.add(message.content);
          }

          sourceNode.add('\n');
        }

        content += prefix + message.content + '\n';
      });


      if (sourceMap) {
        var mapping = fis.file.wrap(pkg.dirname + '/' + pkg.filename + pkg.rExt + '.map');
        var code_map = sourceNode.toStringWithSourceMap({
          file: pkg.subpath
        });

        var generater = SourceMap.SourceMapGenerator.fromSourceMap(new SourceMap.SourceMapConsumer(code_map.map.toJSON()));
        mapping.setContent(generater.toString());
        ret.pkg[mapping.subpath] = mapping;
        content += '//# sourceMappingURL=' + mapping.getUrl();
      }
      pkg.setContent(content);

      list.splice(i, 0, {
        id: pkg.id,
        uri: pkg.getUrl(),
        attrs: unpacked[0].attrs
      });

      resource._map['pkg'][pkg.getId()] = {
        type: 'js',
        uri: pkg.getUrl(),
        has: has
      };

      ret.pkg[pkg.subpath] = pkg;
      index++;
    }

    function getMapFile(file) {
      // 同时修改 sourcemap 文件内容。
      var derived = file.derived;
      if (!derived || !derived.length) {
        derived = file.extras && file.extras.derived;
      }

      if (derived && derived[0] && derived[0].rExt === '.map') {
        return derived[0];
      }

      return null;
    }
  }
};
