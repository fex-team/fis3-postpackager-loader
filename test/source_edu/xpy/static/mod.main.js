
/*!db.main.js*/
;define('db.main', function(require, exports, module) {

  require('db');
  
  console.log('db.main.js');

});

/*!modal.js*/
;define('modal', function(require, exports, module) {

  console.log('modal');

});


/*!jquery.upload.js*/
;define('jquery.upload', function(require, exports, module) {

  require('jquery');
  console.log('jquery.upload');

});

/*!mod.main.js*/
;define('mod.main', function(require, exports, module) {

  
  // mod.main.js  依赖 db.main,modal,jquery.upload
  require('db.main');
  require('modal');
  require('jquery.upload');
  
  console.log('mod.main');
  

});
