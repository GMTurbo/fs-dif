var Differ = require('../lib/fs-dif');

var osx ='/Users/gabrieltesta/Downloads/sync/',
  win32 = 'C:/Users/gtesta/Downloads/syncTest';

var dir = win32;

var fsDif = new Differ({dirToWatch: dir});

fsDif.on('ready', function(){

  console.log('fsDif ready to rock');

  fsDif.beginWatch();

  fsDif.on('created', function(data){
    console.log('created', data);
  });

  fsDif.on('renamed', function(data){
    console.log('renamed', data);
  });

  fsDif.on('moved', function(data){
    console.log('moved', data);
  });

  fsDif.on('removed', function(data){
    console.log('removed', data);
  });
});
