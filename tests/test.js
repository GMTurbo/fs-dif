var Differ = require('../lib/fs-dif'),
  fs = require('fs');

var filename1 = '/Users/gabrieltesta/Desktop/me.jpeg',
  filename2 = '/Users/gabrieltesta/Desktop/old/bolivia.zip',
  filename3 = '/Users/gabrieltesta/Desktop/temp/me.jpeg';

var fsDif = new Differ();

fs.readFile(filename1,
  function(err, data) {
    fsDif.update({
      data: data,
      fileName: filename1,
      size: fs.statSync(filename1).size
    });
  });

fs.readFile(filename2,
  function(err, data) {
    fsDif.update({
      data: data,
      fileName: filename2,
      size: fs.statSync(filename2).size
    });
  });

fs.readFile(filename1,
  function(err, data) {
    fsDif.update({
      data: data,
      fileName: filename3,
      size: fs.statSync(filename1).size
    });
  });
