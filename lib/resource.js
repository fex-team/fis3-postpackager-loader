var common = require('./common.js');
var _ = fis.util;

function isEmpty(obj) {
  if (!obj) {
    return true;
  }

  for (var i in obj) {
    return false;
  }

  return true;
}

function Resource(ret, host, opts) {
  this._ret = ret;
  this._host = host;
  this._opts = opts;
  this._map = ret.map;
  this.loaded = {};
  this.res = [];
  this.css = [];
  this.js = [];
  this.asyncs = [];
  this.calculated = false;

  this.ignoreAsync = opts.allInOne && opts.allInOne.includeAsyncs;
}

Resource.prototype.fork = function() {
  var forked = new Resource(this._ret, this._host, this._opts);
  return forked;
};

Resource.prototype.getNode = function(id, type) {
  type = type || 'res'; // or `pkg`
  return this._map[type][id] || (type === 'res' && this._ret.idmapping[id]);
};

Resource.prototype.getUri = function(id, usePkg) {
  var node = this.getNode(id);

  if (!node) {
    return null;
  }

  if (usePkg && node.pkg) {
    node = this.getNode(node.pkg, "pkg");
  }

  return node.uri;
};

Resource.prototype.getFileById = function(id) {
  return this._ret.idmapping[id];
};

Resource.prototype.getFileByUrl = function(url) {
  var file = this._ret.urlmapping[url];

  if (!file) {
    // _eb15903
    url = url.replace(/\_[a-z0-9]+(\.[^\.]+)$/i, '$1');
    var info = fis.project.lookup(url, this._host);
    if (info.file) {
      file = this.getFileById(info.file.id);
    }
  }

  return file;
};

Resource.prototype.add = function(id, deffer, withPkg, attrs) {
  // 当开启 allInOne 打包，且包含异步依赖时，直接把异步当同步。
  if (deffer && this.ignoreAsync) {
    deffer = false;
  }

  var node = this.getNode(id);
  var self = this;
  var loaded = this.loaded;
  deffer = !!deffer;

  if (!node) {
    return id;
  }

  if (loaded[id] === deffer || deffer && loaded[id] === false) {
    // 如果添加过了而且添加的方式也相同则不重复添加。（这里说的方式是指，同步 or 异步）
    // 如果之前是同步的这次异步添加则忽略掉。都同步添加过了，不需要异步再添加一次。
    return;
  }  else if (loaded[id] === true && !deffer) {
    // 如果之前是异步加载，这次是同步加载。
    this.remove(id, true);
  }

  loaded[id] = deffer;
  var uri = node.uri;
  var deps = node.deps;

  if (withPkg && node.pkg) {
    var pkgNode = this.getNode(node.pkg, 'pkg');
    uri = pkgNode.uri;

    if (pkgNode.has) {
      pkgNode.has.forEach(function(res) {
        loaded[res] = deffer;
      });
    }

    pkgNode.deps && (deps = pkgNode.deps.concat());
  }

  node.extras && node.extras.async && node.extras.async.forEach(function(res) {
    self.add(res, true, withPkg);
  });

  deps && deps.forEach(function(res) {
    self.add(res, deffer, withPkg);
  });


  var type = node.type;
  if (type !== 'css' && type !== 'js') {
    return;
  }


  this.res.push({
    uri: uri,
    id: id,
    pkg: node.pkg,
    type: node.type,
    async: deffer,
    attrs: typeof attrs === 'undefined' ?
      (node.type === 'js' ? ' type="text/javascript"' : ' rel="stylesheet" type="text/css"') :
      (attrs || '')
  });
};

Resource.prototype.remove = function(id, deffer) {
  var node = this.getNode(id);
  var self = this;
  var loaded = this.loaded;
  deffer = !!deffer;

  if (!node) {
    return id;
  }

  if (loaded[id] === deffer) {
    delete loaded[id];
  }

  node.extras && node.extras.async && node.extras.async.forEach(function(res) {
    self.remove(res, true);
  });

  node.deps && node.deps.forEach(function(res) {
    self.remove(res, deffer);
  });

  var type = node.type;
  if (type !== 'css' && type !== 'js') {
    return;
  }

  var idx = common.search(this.res, function(item) {
    return item.id === id && item.async === deffer;
  });

  ~idx && this.res.splice(idx, 1);
};

Resource.prototype.addJs = function(id, attrs) {
  var node = this.getNode(id);

  if (node) {
    this.add(id, false, false, attrs);
  } else {

    var idx = common.search(this.res, function(item) {
      return item.uri === id && item.type === 'js';
    });

    ~idx || this.res.push({
      type: 'js',
      uri: id,
      attrs: typeof attrs === 'undefined' ?
        ' type="text/javascript"':
        (attrs || '')
    });
  }
};

Resource.prototype.addJsEmbed = function(content, attrs) {
  this.res.push({
    type: 'js',
    embed: true,
    content: content,
    attrs: typeof attrs === 'undefined' ?
      ' type="text/javascript"' :
      (attrs || '')
  });
};

Resource.prototype.addCss = function(id, attrs) {
  var node = this.getNode(id);

  if (node) {
    this.add(id, false, false, attrs);
  } else {
    var idx = common.search(this.res, function(item) {
      return item.uri === id && item.type === 'css';
    });

    ~idx || this.res.push({
      type: 'css',
      uri: id,
      attrs: typeof attrs === 'undefined' ?
      ' rel="stylesheet" type="text/css"':
      (attrs || '')
    });
  }
};

Resource.prototype.addCssEmbed = function(content, attrs) {
  this.res.push({
    type: 'css',
    embed: true,
    content: content,
    attrs: typeof attrs === 'undefined' ?
      ' type="text/css"':
      (attrs || '')
  });
};

Resource.prototype.buildConf = function(type) {
  if (/mod|commonJs/i.test(type)) {
    return this.buildResourceMap();
  } else if (/sea\.js|cmd/i.test(type)) {
    return this.buildCMDPath();
  } else if (/system/i.test(type)) {
    return this.buildSystemPath();
  } else {
    return this.buildAMDPath()
  }
};

Resource.prototype.buildResourceMap = function() {
  var self = this;
  var res = {};
  var pkg = {};

  this.calculate();

  Object.keys(this.loaded).forEach(function(id) {
    if (self.loaded[id] !== true) {
      return;
    }

    var node = self.getNode(id);
    if (node.type !== 'js') {
      return;
    }

    var item = {
      url: node.uri,
      type: node.type
    };

    if (node.deps) {

      // 过滤掉不是 js 的文件依赖。
      var deps = node.deps.filter(function(id) {
        if (self.loaded[id] !== false) {
          var dep = self.getFileById(id);

          if (dep) {
            return dep.isJsLike;
          } /*else {
            return !/\.css$/i.test(id);
          }*/
        }

        return false;
      });

      if (deps.length) {
        deps.forEach(function(v, k) {
          var dep = self.getFileById(v);

          if (dep && dep.moduleId) {
            deps[k] = dep.moduleId;
          } else {
            deps[k] = v.replace(/\.(es6|jsx|coffee)$/g, '.js');
          }

        });
        item.deps = deps;
      }
    }

    var file = self.getFileById(id);
    var moduleId = node.extras && node.extras.moduleId || file && file.moduleId || id.replace(/\.js$/i, '');
    res[moduleId] = item;

    if (node.pkg) {
      item.pkg = node.pkg;
      var pkgNode = self.getNode(node.pkg, "pkg");
      var pkgItem = {
        url: pkgNode.uri,
        type: pkgNode.type
      };

      pkg[node.pkg] = pkgItem;
    }
  });

  if (isEmpty(res)) {
    return '';
  }

  var map = {
    res: res
  };

  if (isEmpty(pkg)) {
    map.pkg = pkg;
  }

  return 'require.resourceMap(' + JSON.stringify({res: res, pkg: pkg}, null, 2) + ');';
};

Resource.prototype.buildAMDPath = function() {
  var paths = {};
  var self = this;

  this.calculate();
  Object.keys(this.loaded).forEach(function(id) {
    if (self.loaded[id] !== true) {
      return;
    }

    var node = self.getNode(id);
    if (node.type !== 'js') {
      return;
    }

    var file = self.getFileById(id);
    var moduleId = node.extras && node.extras.moduleId || file && file.moduleId || id.replace(/\.js$/i, '');
    var uri = node.uri;

    if (node.pkg) {
      var pkgNode = self.getNode(node.pkg, "pkg");
      uri = pkgNode.uri;
    }

    uri = uri.replace(/\.js$/i, '');
    paths[moduleId] = uri;
  });

  if (isEmpty(paths)) {
    return '';
  }

  return 'require.config({paths:' + JSON.stringify(paths, null, 2) + '});';
};

Resource.prototype.buildCMDPath = function() {
  var paths = {};
  var self = this;

  this.calculate();
  Object.keys(this.loaded).forEach(function(id) {
    if (self.loaded[id] !== true) {
      return;
    }

    var node = self.getNode(id);
    if (node.type !== 'js') {
      return;
    }

    var file = self.getFileById(id);
    var moduleId = node.extras && node.extras.moduleId || file && file.moduleId || id.replace(/\.js$/i, '');
    var uri = node.uri;

    if (node.pkg) {
      var pkgNode = self.getNode(node.pkg, "pkg");
      uri = pkgNode.uri;
    }

    uri = uri.replace(/\.js$/i, '');
    paths[moduleId] = uri;
  });

  if (isEmpty(paths)) {
    return '';
  }

  // {paths:' + JSON.stringify(paths, null, 2) + '});
  return 'seajs.config({alias:' + JSON.stringify(paths, null, 2) + '});';
};

Resource.prototype.buildSystemPath = function() {
  var paths = {};
  var bundles = {};
  var self = this;

  this.calculate();
  Object.keys(this.loaded).forEach(function(id) {
    if (self.loaded[id] !== true) {
      return;
    }

    var node = self.getNode(id);
    if (node.type !== 'js') {
      return;
    }

    var file = self.getFileById(id);
    var moduleId = node.extras && node.extras.moduleId || file && file.moduleId || id.replace(/\.js$/i, '');
    var uri = node.uri;

    if (node.pkg) {
      var pkgNode = self.getNode(node.pkg, "pkg");
      uri = pkgNode.uri;
    }

    paths[moduleId] = uri;
    bundles[uri] = bundles[uri] || [];
    bundles[uri].push(moduleId);
  });

  if (isEmpty(paths)) {
    return '';
  }

  Object.keys(bundles).forEach(function(key) {
    if (bundles[key] && bundles[key].length > 1) {
      bundles[key].forEach(function(dep) {
        delete paths[dep];
      });
    } else {
      delete bundles[key];
    }
  });

  var configs = [];
  if (!isEmpty(paths)) {
    configs.push('map:' + JSON.stringify(paths, null, 2));
  }
  if (!isEmpty(bundles)) {
    configs.push('bundles:' + JSON.stringify(bundles, null, 2));
  }


  return 'System.config({' + configs.join(',\n') + '});';
};


Resource.prototype.calculate = function() {
  if (this.calculated) {
    return;
  }
  this.calculated = true;

  var self = this;
  var res = this.res; // 原来的资源集合。
  this.res = [];
  this.loaded = {};

  // 重新加一次，这次处理 pkg
  res.forEach(function(item) {
    if (item.id) {
      self.add(item.id, item.async, true, item.attrs);
    } else {
      self.res.push(item);
    }
  });

  this.res.forEach(function(item) {
    var list;

    if (item.type === 'js') {
      list = self[item.async ? 'asyncs' : 'js'];
    } else if (item.type === 'css') {
      list = self.css;
    }

    // 如果是 css, 因为不区分同步和异步，所以，存在可能已经同名加载过了，这次异步有加载。
    // 导致同一个 pkg 被加载两次。
    if (list && item.pkg) {
      var idx = common.search(list, function(a) {
        return a.pkg === item.pkg && (item.type === 'css' || a.async === item.async);
      });

      ~idx || list.push(item);
    } else {
      list && list.push(item);
    }


  });
};

Resource.prototype.isEmpty = isEmpty;

module.exports = function(map, file, opts) {
  return new Resource(map, file, opts);
};

module.exports.extend = function(props) {
  var o = Resource.prototype;
  _.forEach(props, function(value, key) {
    if (typeof value === 'function') {
      var origin = o[key];
      o[key] = function() {
        this.__super = origin;
        return value.apply(this, arguments);
      };
    } else {
      o[key] = value;
    }
  });
};
