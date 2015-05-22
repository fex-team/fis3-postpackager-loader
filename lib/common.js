var rToken = /\$\{(.*)?\}/g;

exports.search = function(obj, predicate) {
  var list = Object(obj);
  var length = list.length >>> 0;

  for (var i = 0; i < length; i++) {
    if (predicate.call(list, list[i], i, list)) {
      return i;
    }
  }

  return -1;
};

exports.tokenizePath = function(tpl, tokens) {
  tokens = tokens || {};

  return tpl
    .replace(rToken, function(_, key) {
      return tokens[key] || '';
    })
    .replace(/[\/\\]+/g, '/')
    .replace(/[:*?"<>|]/g, '_');
};
