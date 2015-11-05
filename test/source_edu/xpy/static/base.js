

/*!db.js*/
;define('db', function(require, exports, module) {

  console.log('db');

});

/*!base.js*/
;define('base', function(require, exports, module) {

  // base.js 依赖jquery,badjs,db
  require('jquery');
  require('badjs');
  require('db');
  
  console.log('base');
  
  require('http://qq.com/tvp.js');
  require('https://qq.com/httpssss.js');
  require('http://qzs.qq.com/tencentvideo_v1/tvu/js/ftnh5/tvu.uploader.js');

});
