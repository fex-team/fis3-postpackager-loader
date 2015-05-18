/**
 * 将零散的文件打包合成一个新文件。
 */
var rToken = /\$\{(.*)?\}/g;

module.exports = function(file, resouce, ret, opts) {
  var root = fis.project.getProjectPath();

  pack(resouce.js, opts.js || 'pkg/${filepath}_aio.js');
  pack(resouce.css, opts.css || 'pkg/${filepath}_aio.css');

  function pack(list, fileTpl) {
    var index = 1;
    var i = 0;
    var unpacked = [];
    var item;

    while (i < list.length) {
      item = list[i];

      if (item.id && !item.pkg) {
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
    unpacked.length > 1 && _pack();

    function _pack() {
      var tokens = {
        filepath: file.subpath,
        hash: file.getHash()
      };

      var filepath = fileTpl
        .replace(rToken, function(_, key) {
          return tokens[key] || '';
        })
        .replace(/[\/\\]+/g, '/')
        .replace(/[:*?"<>|]/g, '_');

      if (index>1) {
        filepath = filepath.replace(/\.([^\.]+)$/i, function(ext) {
          return '_' + index + ext;
        });
      }

      var pkg = fis.file(root, filepath);
      pkg.setContent(unpacked.map(function(item) {
        var file = ret.idmapping[item.id];

        return (file.isJsLike ? '/*!' + file.id + '*/\n;' : '/*!' + file.id + '*/\n') + file.getContent();
      }).join('\n'));

      list.splice(i, 0, {
        id: pkg.id,
        uri: pkg.getUrl()
      });
      ret.pkg[pkg.subpath] = pkg;
      index++;
    }
  }
};
