var Differ = require('../lib/fs-dif');

var dir = '/Users/gabrieltesta/Downloads/sync/';

var fsDif = new Differ();

fsDif.beginWatch(dir);

fsDif.on('created', function(data){
  console.log('created', data);
});

fsDif.on('renamed', function(data){
  console.log('renamed',data);
});

fsDif.on('moved', function(data){
  console.log('moved',data);
});

fsDif.on('removed', function(data){
  console.log('removed',data);
});
