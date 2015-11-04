

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
  

});
