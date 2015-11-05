/**
 * Created by ryan on 15/7/28.
 */
var fs = require('fs'),
    path = require('path');
var fis = require('fis3');
var _ = fis.util,
    config = fis.config;
var expect = require('chai').expect;
var resource = require('../lib/resource.js');
var pack = require('../lib/pack.js');
var _release = fis.require('command-release/lib/release.js');
var _deploy = fis.require('command-release/lib/deploy.js');
var loader = require('../');

function wrapLoader(options) {
    return function (ret, pack, settings, opt) {
        settings = _.assign({}, loader.defaultOptions);
        _.assign(settings, options);
        return loader.call(this, ret, pack, settings, opt);
    }
};

function release(opts, cb) {
    opts = opts || {};

    _release(opts, function (error, info) {
        _deploy(info, cb);
    });
}
var _self = require('fis3-hook-commonjs');

function hookSelf(opts) {
    var key = 'modules.hook';
    var origin = fis.get(key);

    if (origin) {
        origin = typeof origin === 'string' ? origin.split(/\s*,\s*/) : (Array.isArray(origin) ? origin : [origin]);
    } else {
        origin = [];
    }

    origin.push(function (fis) {
        var options = {};
        _.assign(options, _self.defaultOptions);
        _.assign(options, opts);
        return _self.call(this, fis, options);
    });

    fis.set(key, origin);
}

describe('fis3-postpackager-loader ', function () {
    var root = path.join(__dirname, 'source_edu');
    fis.project.setProjectRoot(root);
    beforeEach(function () {
        fis.media().init();
        fis.config.init();
        var testfile = _(root, 'xpy');
        _.del(testfile);
    });

    it('useInlineMap:true , ignore:a.js', function () {
        hookSelf({
            baseUrl: "."
        });

        fis.match('::packager', {
            postpackager: wrapLoader({
                allInOne: {
                    ignore: '**/a.js',
                    // includeAsyncs: true,
                    css: root + "xpy/static/pkg/a_aio.css",
                    ignoreJsPacks:['base'],
                    ignore:'common.css'
                },
                jsPacks:[
                    {
                        match: /base\.js$/,
                        ignores: ['jquery', 'badjs'],
                        useMap: true
                    }, {
                        match: /^mod.main.*?\.js$/,
                        ignores: ['base'],
                        useMap: true
                    }
                ],
                asyncPacks:true, // 是否异步打包
                asyncPacksIgnore:['base'], // 异步打包忽略模块
                scriptPlaceHolder: "<!--SCRIPT_PLACEHOLDER-->",
                stylePlaceHolder: '<!--STYLE_PLACEHOLDER-->',
                resourcePlaceHolder: '<!--RESOURCEMAP_PLACEHOLDER-->',
                resourceType: 'mod',
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
                to: root + "/xpy"
            })
        })

        fis.match("*.html", {
            useHash: false,
            packTo: root + "/xpy/aaaa.html"
        });

        fis.match("**/*.js", {
            release: '/static/$0'
        });

        fis.match("**/*.css", {
            release: '/static/$0'
        });

        fis.match('**.{js,tpl}', {
            domain: 'http://7.url.cn/edu',
            useDomain: true,
            isMod: true,
            // optimizer: fis.plugin('uglify-js'), // 压缩
            // useHash: true
        })
        .match('**.{css,scss,sass}', {
            optimizer: fis.plugin('clean-css'),
            domain: 'http://8.url.cn/edu',
            useDomain: true,
            // useHash: true
        })
        .match('**.{scss,sass}', {
            parser: fis.plugin('node-sass', {
                include_paths: ['modules/common/sass']
            }),
            rExt: '.css'
        })
        .match('::image', {
            domain: 'http://9.url.cn/edu',
            useDomain: true,
            // useHash: true
        });

        release({
            unique: true
        }, function () {
            console.log('Done');
        });

        var str = fis.util.read(path.join(root, 'xpy', 'static', 'pkg', 'index.html_aio.js'));
        expect(str.indexOf("db.main.js") > 0).to.be.true;
        expect(str.indexOf("modal.js") > 0).to.be.true;
        expect(str.indexOf("jquery.upload.js") > 0).to.be.true;
        expect(str.indexOf("mod.main.js") > 0).to.be.true;
        expect(str.indexOf("tvp.js") > 0).to.be.true;
        expect(str.indexOf("jquery.js") < 0).to.be.true;


        str = fis.util.read(path.join(root,'xpy','static','base.js'));

        expect(str.indexOf("db.js") > 0).to.be.true;
        expect(str.indexOf("base.js") > 0).to.be.true;
        expect(str.indexOf("jquery.js") < 0).to.be.true;

        str = fis.util.read(path.join(root, 'xpy', 'static', 'mod.main.js'));
        expect(str.indexOf("db.main.js") > 0).to.be.true;
        expect(str.indexOf("modal.js") > 0).to.be.true;
        expect(str.indexOf("jquery.upload.js") > 0).to.be.true;
        expect(str.indexOf("mod.main.js") > 0).to.be.true;
        expect(str.indexOf("jquery.js") < 0).to.be.true;
        expect(str.indexOf("tvp.js") < 0).to.be.true;


        str = fis.util.read(path.join(root, 'xpy', 'static', 'mod.main.info.js'));
        expect(str.indexOf("db.info.js") > 0).to.be.true;
        expect(str.indexOf("modal.js") > 0).to.be.true;
        expect(str.indexOf("jquery.form.js") > 0).to.be.true;
        expect(str.indexOf("mod.main.info.js") > 0).to.be.true;
        expect(str.indexOf("jquery.js") < 0).to.be.true;
        expect(str.indexOf("tvp.js") < 0).to.be.true;


        str = fis.util.read(path.join(root, 'xpy', 'static', 'ckeditor.js'));
        expect(str.indexOf("ckeditor.dep.js") > 0).to.be.true;

        str = fis.util.read(path.join(root, 'xpy', 'index.html'));
        expect(str.indexOf("http://7.url.cn/edu/static/ckeditor.js") > 0).to.be.true;

        //expect(file.getContent()).to.be.equal(fis.util.read(path.join(root, 'util','upload', 'maintar.css')));

    });
});