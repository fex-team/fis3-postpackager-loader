var common = require('./common.js');

function isEmpty(obj) {
  if (!obj) {
    return true;
  }

  for (var i in obj) {
    return false;
  }

  return true;
}

function Resource(ret, host) {
  this._ret = ret;
  this._host = host;
  this._map = ret.map;
  this.loaded = {};
  this.css = [];
  this.js = [];
  this.asyncs = [];
}

Resource.prototype.getNode = function(id, type) {
  type = type || 'res'; // or `pkg`
  return this._map[type][id];
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
      file = info.file;
    }
  }

  return file;
};

Resource.prototype.add = function(id, deffer) {
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

    return this.getUri(id, true);
  } else if (loaded[id] === true && !deffer) {
    // 如果之前是异步加载，这次是同步加载。

    this.removeDefferFromList(id);
  }

  var pkg = node.pkg;

  if (pkg) {
    node = this.getNode(pkg, "pkg");

    if (node.has && node.has.length) {
      node.has.forEach(function(res) {
        var node = self.getNode(res);
        loaded[res] = deffer;

        if (deffer && node && node.type === 'js') {
          self.asyncs.push({
            id: res,
            uri: node.uri,
            pkg: node.pkg && self.getNode(node.pkg, 'pkg'),
            type: node.type
          });
        }
      });
    }
  } else {
    loaded[id] = deffer;
  }

  node.extras && node.extras.async && node.extras.async.forEach(function(res) {
    self.add(res, true);
  });

  node.deps && node.deps.forEach(function(res) {
    self.add(res, deffer);
  });

  var uri = node.uri;
  var type = node.type;

  switch (type) {
    case 'js':
      this[deffer ? 'asyncs' : 'js'].push({
        uri: uri,
        id: id,
        pkg: pkg && node,
        type: node.type
      });
      break;

    case 'css':
      this.css.push({
        uri: uri,
        id: id,
        pkg: pkg && node,
        type: node.type
      });
      break;
  }

  return uri;
};

Resource.prototype.removeDefferFromList = function(id) {
  var self = this;
  var node = this.getNode(id);

  if (!node) {
    return;
  }

  var idx = common.search(this.asyncs, function(obj) {
    return obj.id === id;
  });

  if (~idx) {
    this.asyncs.splice(idx, 1);
  }
};

Resource.prototype.buildResourceMap = function() {
  var self = this;
  var res = {};
  var pkg = {};

  this.asyncs.forEach(function(obj) {
    var id = obj.id;

    if (self.loaded[id] === false) {
      // 已经同步加载，则忽略。
      return;
    }

    var node = self.getNode(id);
    var item = {
      url: node.uri,
      type: node.type
    };

    if (node.deps) {
      var deps = node.deps.filter(function(id) {
        return self.loaded[id] !== false && !/\.css$/i.test(id);
      });

      deps.length && (item.deps = deps);
    }

    res[id] = item;

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

  Object.keys(this.loaded).forEach(function(id) {
    if (self.loaded[id] !== true) {
      return;
    }

    var node = self.getNode(id);
    if (node.type !== 'js') {
      return;
    }

    var moduleId = node.extras && node.extras.moduleId || id.replace(/\.js$/i, '');
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

Resource.prototype.addJs = function(id, type) {
  var node = this.getNode(id);

  if (node) {
    this.add(id);
  } else {
    this.js.push({
      type: type || 'unknown',
      uri: id
    });
  }
};

Resource.prototype.addJsEmbed = function(content) {
  this.js.push({
    type: 'embed',
    content: content
  });
};

Resource.prototype.addCss = function(id, type) {
  var node = this.getNode(id);

  if (node) {
    this.add(id);
  } else {
    this.css.push({
      type: type || 'unknown',
      uri: id
    });
  }
};

Resource.prototype.addCssEmbed = function(content) {
  this.css.push({
    type: 'embed',
    content: content
  });
};

module.exports = function(map) {
  return new Resource(map);
};
