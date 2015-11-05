
// mod.main.js  依赖 db.main,modal,jquery.upload
require('./db.main');
require('./modal');
require('./jquery.upload');

console.log('mod.main');

require(['./ckeditor','./ckeditor.jquery'],function(){
    console.log('async ckeditor');
});