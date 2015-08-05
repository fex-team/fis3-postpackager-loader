/**
 * Created by ryan on 15/7/28.
 */
var fs = require('fs'),
  path   = require('path');
var fis = require('fis3');
var _      = fis.util,
  config = fis.config;
var expect = require('chai').expect;
var resource = require('../lib/resource.js');
var pack = require('../lib/pack.js');
var _release = fis.require('command-release/lib/release.js');
var _deploy = fis.require('command-release/lib/deploy.js');
var loader = require('../');

function wrapLoader(options) {
  return function(ret, pack, settings, opt) {
    settings = _.assign({}, loader.defaultOptions);
    _.assign(settings, options);
    return loader.call(this, ret, pack, settings, opt);
  }
};

function release(opts, cb) {
  opts = opts || {};

  _release(opts, function(error, info) {
    _deploy(info, cb);
  });
}

describe('fis3-postpackager-loader ', function() {
  var root = path.join(__dirname, 'source');
  fis.project.setProjectRoot(root);
  beforeEach(function() {
    fis.media().init();
    fis.config.init();
    var testfile = _(root, 'xpy');
    _.del(testfile);
  });

  it('useInlineMap:false', function() {
    fis.match('::packager', {
      postpackager: wrapLoader({
        allInOne: true,
        scriptPlaceHolder: "<!--SCRIPT_PLACEHOLDER-->",
        stylePlaceHolder: '<!--STYLE_PLACEHOLDER-->',
        resourcePlaceHolder: '<!--RESOURCEMAP_PLACEHOLDER-->',
        resourceType: 'auto',
        processor: {
          '.html': 'html'
        },
        obtainScript: true,
        obtainStyle: true,
        useInlineMap: false
      })

    });

    fis.match('*', {
      deploy: fis.plugin('local-deliver', {
        to: root+"/xpy"
      })
    })

    fis.match("*.html", {
      useHash: false,
      packTo:root+"/xpy/aaaa.html"
    });

    fis.match("**/*.js", {
      release: '/static/$0'
    });

    fis.match("**/*.css", {
      release: '/static/$0'
    });

    release({
      unique: true
    }, function() {
      console.log('Done');
    });

    var str = fis.util.read(path.join(root, 'xpy', 'static', 'pkg', 'main.html_aio.js'));
    expect(str.indexOf("567")>0).to.be.true;
    expect(str.indexOf("1234")>0).to.be.true;
    //expect(file.getContent()).to.be.equal(fis.util.read(path.join(root, 'util','upload', 'maintar.css')));
    var str2 = fis.util.read(path.join(root, 'xpy', 'main.html'));
    var link = str2.indexOf("link");
    var head = str2.indexOf("<head");
    var head_end = str2.indexOf("</head");
    expect(link>head&&link<head_end).to.be.true;
    var scritp = str2.indexOf("script");
    var body = str2.indexOf("<body");
    var body_end = str2.indexOf("</body");
    expect(scritp>body&&scritp<body_end).to.be.true;
  });

  it('useInlineMap:true ,ignore:null', function() {
    fis.match('::packager', {
      postpackager: wrapLoader({
        allInOne: {
          includeAsyncs: true,
          css: root+"xpy/static/pkg/a_aio.css"
        },
        scriptPlaceHolder: "<!--SCRIPT_PLACEHOLDER-->",
        stylePlaceHolder: '<!--STYLE_PLACEHOLDER-->',
        resourcePlaceHolder: '<!--RESOURCEMAP_PLACEHOLDER-->',
        resourceType: 'auto',
        processor: {
          '.html': 'html'
        },
        obtainScript: true,
        obtainStyle: true,
        useInlineMap: true
      })

    });

    fis.match('*', {
      deploy: fis.plugin('local-deliver', {
        to: root+"/xpy"
      })
    })

    fis.match("*.html", {
      useHash: false,
      packTo:root+"/xpy/aaaa.html"
    });

    fis.match("**/*.js", {
      release: '/static/$0'
    });

    fis.match("**/*.css", {
      release: '/static/$0'
    });

    release({
      unique: true
    }, function() {
      console.log('Done');
    });

    var str = fis.util.read(path.join(root, 'xpy', 'static', 'pkg', 'main.html_aio.js'));
    expect(str.indexOf("567")>0).to.be.true;
    expect(str.indexOf("1234")>0).to.be.true;
    expect(str.indexOf("wang='1'")>0).to.be.true;
    expect(str.indexOf("x =1")>0).to.be.true;
    expect(str.indexOf("abc")>0).to.be.true;

    //expect(file.getContent()).to.be.equal(fis.util.read(path.join(root, 'util','upload', 'maintar.css')));
    var str2 = fis.util.read(path.join(root, 'xpy', 'main.html'));
    var link = str2.indexOf("link");
    var head = str2.indexOf("<head");
    var head_end = str2.indexOf("</head");
    expect(link>head&&link<head_end).to.be.true;
    var scritp = str2.indexOf("script");
    var body = str2.indexOf("<body");
    var body_end = str2.indexOf("</body");
    expect(scritp>body&&scritp<body_end).to.be.true;
  });

  it('useInlineMap:true , ignore:a.js', function() {
    fis.match('::packager', {
      postpackager: wrapLoader({
        allInOne: {
          ignore: '**/a.js',
          includeAsyncs: true,
          css: root+"xpy/static/pkg/a_aio.css"
        },
        scriptPlaceHolder: "<!--SCRIPT_PLACEHOLDER-->",
        stylePlaceHolder: '<!--STYLE_PLACEHOLDER-->',
        resourcePlaceHolder: '<!--RESOURCEMAP_PLACEHOLDER-->',
        resourceType: 'auto',
        processor: {
          '.html': 'html'
        },
        obtainScript: true,
        obtainStyle: true,
        useInlineMap: true
      })

    });

    fis.match('*', {
      deploy: fis.plugin('local-deliver', {
        to: root+"/xpy"
      })
    })

    fis.match("*.html", {
      useHash: false,
      packTo:root+"/xpy/aaaa.html"
    });

    fis.match("**/*.js", {
      release: '/static/$0'
    });

    fis.match("**/*.css", {
      release: '/static/$0'
    });

    release({
      unique: true
    }, function() {
      console.log('Done');
    });

    var str = fis.util.read(path.join(root, 'xpy', 'static', 'pkg', 'main.html_aio_2.js'));
    expect(str.indexOf("567")>0).to.be.true;
    expect(str.indexOf("abc")>0).to.be.true;
    expect(str.indexOf("1234")<0).to.be.true;
    //expect(file.getContent()).to.be.equal(fis.util.read(path.join(root, 'util','upload', 'maintar.css')));
    var str2 = fis.util.read(path.join(root, 'xpy', 'main.html'));
    var link = str2.indexOf("link");
    var head = str2.indexOf("<head");
    var head_end = str2.indexOf("</head");
    expect(link>head&&link<head_end).to.be.true;
    var scritp = str2.indexOf("script");
    var body = str2.indexOf("<body");
    var body_end = str2.indexOf("</body");
    expect(scritp>body&&scritp<body_end).to.be.true;
  });
});
