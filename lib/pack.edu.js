// edu打包方案
// @yisbug

var common = require('./common.js');

var files; // 原始文件
var isDone = false; // 是否已经合并打包
var packs = {}; // 打入resourceMap
var resoucemap = '';

var depCaches = {};
var ignoreCaches = {};
var contentCaches = {};

// 缓存要打包的文件及打包后的url
var oldUriList = [];
var newUriList = [];
var oldIdList = [];
var isMerge = false;

// 根据moduleId查找文件
var getFileByModuleId = function (id) {
    for (var key in files) {
        var file = files[key];
        if (file.rExt === '.js' && (file.moduleId === id || file.id === id)) {
            return file;
        }
    }
    return null;
};

// 递归获取某个文件的所有依赖
var getDeps = function (file) {
    if (file.__deps) return;
    if (depCaches[file.id]) {
        file.__deps = depCaches[file.id];
        return;
    }
    file.__deps = [];
    file.requires.forEach(function (id) {
        var _file = getFileByModuleId(id);
        if (!_file) return;
        if (!_file.__deps) getDeps(_file);
        _file.__deps.concat([_file.moduleId]).forEach(function (id) {
            // 防止重复依赖
            if (file.__deps.indexOf(id) !== -1) return;
            // 防止循环依赖
            if (id === file.moduleId) return;
            file.__deps.push(id);
        });
    });
    depCaches[file.id] = file.__deps;
};

// 递归分析某个文件打包时的忽略项
var getIgnores = function (file, ignores) {
    if (file.__ignores) return;
    if (ignoreCaches[file.id]) {
        file.__ignores = ignoreCaches[file.id];
        return;
    }
    file.__ignores = [];
    if (!ignores) ignores = [];
    ignores.forEach(function (id) {
        var _file = getFileByModuleId(id);
        if (!_file) return;
        // 先获取该文件的依赖
        if (!_file.__deps) getDeps(_file);
        if (!_file.__ignores) getIgnores(_file);
        _file.__deps.concat([_file.moduleId]).concat(_file.__ignores).forEach(function (id) {
            // 防止重复，其实无所谓
            if (file.__ignores.indexOf(id) !== -1) return;
            // 防止忽略自己
            if (id === file.moduleId) return;
            file.__ignores.push(id);
        });
    });
    ignoreCaches[file.id] = file.__ignores;
};

// 遍历files
var loopFiles = function (fn) {
    Object.keys(files).forEach(function (subpath) {
        var file = files[subpath];
        fn.call(file, file);
    });
};


// 打包
var pack = function (ret, settings) {
    if (isDone) return;
    // 初始化jsPacks配置
    if (!Array.isArray(settings.jsPacks)) {
        settings.jsPacks = [settings.jsPacks];
    }
    // 要加入到sourceMap的配置
    if (settings.paths) {
        for (var k in settings.paths) {
            packs[k] = {
                url: settings.paths[k],
                useMap: true
            };
        }
    }

    // 获取依赖列表和忽略列表
    settings.jsPacks.forEach(function (conf) {
        loopFiles(function (file) {
            // 命中
            if (!conf.match.test(file.basename)) return;
            _pack(file, conf, ret);
        });
    });

    // 打包异步资源
    settings.asyncPacks && loopFiles(function (file) {
        if (!file.asyncs || file.asyncs.length === 0) return;
        file.asyncs.forEach(function (id) {
            var _file = getFileByModuleId(id);
            _pack(_file, {
                useMap: true,
                ignores: settings.asyncPacksIgnore
            }, ret);
        });
    });

    isDone = true;
    resoucemap = buildMap();

};

// 打包一个文件及其所有依赖
var _pack = function (file, conf, ret) {
    if (!file) return;
    if (file.__isPack) return; // 已经都打包
    getDeps(file);
    getIgnores(file, conf.ignores);

    var pkgUrl = '';
    if (file.__deps.length > 0) {
        // 没有依赖文件不打包
        file.__packs = [];
        // 清空依赖，因为已经打包了
        if (ret.map.res[file.id]) ret.map.res[file.id].deps = [];
        var content = file.__deps.concat([file.moduleId]).map(function (id) {
            // 被忽略
            if (file.__ignores.indexOf(id) !== -1) return;
            // 存到__packs
            file.__packs.push(id);

            // 合并的文件
            var item = getFileByModuleId(id);
            // 没有找到文件则读取缓存
            if (!item) {
                return contentCaches[id] ? contentCaches[id] : '';
            }
            var c = (item.isJsLike ? '/*!' + item.id + '*/\n;' : '/*!' + item.id + '*/\n');
            // 使用原始内容合并，否则可能重复合并
            c += typeof item.__baseContent === 'undefined' ? item.getContent() : item.__baseContent;
            contentCaches[id] = c;
            // 派送事件
            var message = {
                item: item,
                content: c
            };
            fis.emit('pack:file', message);
            return message.content;
        }).join('\n');



        // 备份原始内容
        file.__baseContent = file.getContent();
        file.setContent(content);


        oldUriList.push(file.getUrl());
        // HACK 重新设置hash值，并替换已有的html中的script标签
        file.getHash = function(){
            return fis.util.md5(this.getContent());
        };
        ret.map.res[file.id].uri = file.getUrl();

        oldIdList.push(file.id);
        newUriList.push(file.getUrl());

        console.log('packTo:', file.id);
    }
    file.__isPack = true;
    // 加入到resourceMap
    var moduleId = file.moduleId || file.id.replace(/\.js$/i, '');
    packs[moduleId] = {
        url: file.getUrl(),
        useMap: !!conf.useMap
    };
};

// 生成resourceMap
var buildMap = function () {
    var o = {};
    o.res = {};
    for (var key in packs) {
        if (packs[key].useMap) o.res[key] = {
            url: packs[key].url
        };
    }
    var str = 'require.resourceMap(' + JSON.stringify(o) + ')';
    return '<script type="text/javascript">' + str + '</script>';
};


// 排除被合并的js
var clearResource = function (file, resource, ignores) {
    if (!ignores) return;
    if (!Array.isArray(ignores)) ignores = [ignores];
    getIgnores(file, ignores);
    file.__ignores.forEach(function (id) {
        var _file = getFileByModuleId(id);
        (function (list) {
            for (var i = 0; i < list.length; i++) {
                if (list[i].id === _file.id) return list.splice(i, 1);
            };
        })(resource.js);
    });
};

module.exports = {
    pack: function (ret, settings) {
        files = ret.src;
        pack(ret, settings);
    },
    clear: function (file, resource, ret, settings, opts) {
        resource.calculate();
        clearResource(file, resource, opts.ignoreJsPacks);
        var content = file.getContent();
        var tag = opts.resourcePlaceHolder || '<!--RESOURCEMAP_PLACEHOLDER-->';
        var nums = 0;

        // HACK 替换已经插入script标签的url
        content = content.replace(/<script[^>]+?src\s*?=\s*?(['"])([^'"]+?)\1[^>]*?>/ig,function($0,$1,$2){
            if(!$2) return $0;
            var index = oldUriList.indexOf($2);
            if(index > -1){
                url = newUriList[index];
                return "<script " + (file.attrs || '') + " src=\"" + url + "\">";
            }else{
                return $0;
            }
        });

        while (content.indexOf(tag) > -1 && nums < 10) {
            content = content.replace(tag, resoucemap);
            nums++;
        }
        file.setContent(content);
    },
    clearDone: function () {
        isDone = false;
    }
};