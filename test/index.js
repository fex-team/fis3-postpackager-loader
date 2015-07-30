/**
 * Created by ryan on 15/7/28.
 */
var fs = require('fs'),
  path   = require('path');
var fis = require('../../..');
var _      = fis.util,
  config = fis.config;
var expect = require('chai').expect;
var resource = require('../lib/resource.js');
var pack = require('../lib/pack.js');
var fis3_postpackager_loader = require('fis3-postpackager-loader');

describe('fis3-hook-module compile:postprocessor', function() {
  var root = path.join(__dirname, 'source');
  fis.project.setProjectRoot(root);
  beforeEach(function() {
    fis.media().init();
    fis.config.init();
    fis.compile.setup();

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

    var file = fis.file.wrap(path.join(root, 'main.html'));
    file.useCache = false;
    fis.compile(file);
    var opt = {
      dest: 'preview',
      watch: false,
      live: false,
      clean: false,
      unique: false,
      useLint: false,
      verbose: false,
      beforeEach: "",
      beforeCompile: "",
      afterEach: ""
    }
    fis.release(opt);
    //console.log(file.getContent());

  });


});
