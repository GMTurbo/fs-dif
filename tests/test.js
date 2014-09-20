var Differ = require('../lib/fs-dif'),
  fs = require('fs');

var fsDif = new Differ();
fs.readFile('/Users/gabrieltesta/Desktop/me.jpeg',
  function(err, data) {
    fsDif.update({
      data: data,
      fileName: '/Users/gabrieltesta/Desktop/me.jpeg',
      size: 1024
    });
    fsDif.update({
      data: data,
      fileName: '/Users/gabrieltesta/Desktop/me2.jpeg',
      size: 1024
    });
    fsDif.update({
      data: data,
      fileName: '/Users/gabrieltesta/Desktop/test/me.jpeg',
      size: 1024
    });
  });
