var Differ = require('../lib/fs-dif');

var osx ='/Users/user/Downloads/sync/',
  win32 = 'C:/Users/gtesta/Downloads/master';

var dir = win32;

//https://github.com/thlorenz/readdirp#filters

var fsDif = new Differ({
  dirToWatch: dir, //REQUIRED: directory to watch
  debugOutput: true, //turn on verbose output logging,
  directoryFilter: ['!*modules'],
  ignoreDotFiles: true
  });

fsDif.on('ready', function(){

  console.log('fsDif ready to rock');

  fsDif.beginWatch();

  fsDif.on('created', function(err, data){
    //console.log('created', data);
  });

  fsDif.on('renamed', function(err, data){
    //console.log('renamed', data);
  });

  fsDif.on('moved', function(err, data){
    //console.log('moved', data);
  });

  fsDif.on('removed', function(err, data){
  //  console.log('removed', data);
  });

  fsDif.on('exists', function(err, data){
    //console.log('exists', data);
  });
});
