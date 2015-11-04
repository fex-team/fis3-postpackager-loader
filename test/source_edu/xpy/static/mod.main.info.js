
/*!db.info.js*/
;define('db.info', function(require, exports, module) {

  
  require('db');
  console.log('db.info');

});

/*!modal.js*/
;define('modal', function(require, exports, module) {

  console.log('modal');

});

/*!jquery.form.js*/
;define('jquery.form', function(require, exports, module) {

  console.log('jquery.form');

});

/*!mod.main.info.js*/
;define('mod.main.info', function(require, exports, module) {

  require('db.info');
  require('modal');
  require('jquery.form');
  
  console.log('mod.main.info');

});
