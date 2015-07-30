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
var fis3_postpackager_loader = require('fis3-postpackager-loader');
var _release = fis.require('command-release/lib/release.js');
var _deploy = fis.require('command-release/lib/deploy.js');

function release(opts, cb) {
  opts = opts || {};

  _release(opts, function(error, info) {
    _deploy(info, cb);
  });
}

describe('fis3-hook-module compile:postprocessor', function() {
  var root = path.join(__dirname, 'source');
  fis.project.setProjectRoot(root);
  beforeEach(function() {
    fis.media().init();
    fis.config.init();
  });

  it('compile non-AMD JS file', function() {
    fis.match('::packager', {
      postpackager: fis.plugin('loader', {
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

    release({
      unique: true
    }, function() {
      console.log('Done');
    });


    // var file = fis.file.wrap(path.join(root, 'main.html'));
    // file.useCache = false;
    // fis.compile(file);
    // var opt = {
    //   dest: 'preview',
    //   watch: false,
    //   live: false,
    //   clean: false,
    //   unique: false,
    //   useLint: false,
    //   verbose: false,
    //   beforeEach: "",
    //   beforeCompile: "",
    //   afterEach: ""
    // }
    // fis.release(opt, function() {
    //   console.log('fdf')
    // });
    //console.log(file.getContent());

  });


});
