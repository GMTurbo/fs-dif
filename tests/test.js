var Differ = require('../lib/fs-dif'),
  fs = require('fs');

var filename1 = '/Users/gabrieltesta/Desktop/me.jpeg',
  filename2 = '/Users/gabrieltesta/Desktop/old/bolivia.zip',
  filename3 = "/Users/gabrieltesta/Desktop/old/Palm Videos.zip",
  filename4 = '/Users/gabrieltesta/Downloads/sync/awesome.flv',
  filename5 = '/Users/gabrieltesta/Downloads/sync/awesome copy.flv';

var fsDif = new Differ();

fs.readFile(filename1,
  function(err, data) {
    console.time('sync hash 1 (40 Kb)');
    fsDif.updateSync({
      data: data,
      fileName: filename1,
      size: fs.statSync(filename1).size
    });
    console.timeEnd('sync hash 1 (40 Kb)');
  });

fs.readFile(filename2,
  function(err, data) {
    console.time('sync hash 2 (375 Mb)');
    fsDif.updateSync({
      data: data,
      fileName: filename2,
      size: fs.statSync(filename2).size
    });
    console.timeEnd('sync hash 2 (375 Mb)');
  });

console.time('hash 650Mb file');

fsDif.update(filename4, function(err, data) {
  console.timeEnd('hash 650Mb file');

  if (err)
    console.error(err);

  console.dir(data);

});

console.time('hash 650Mb 2 file');

fsDif.update(filename5, function(err, data) {
  console.timeEnd('hash 650Mb 2 file');

  if (err)
    console.error(err);

  console.dir(data);

});

console.time('hash 1gb file');

fsDif.update(filename3, function(err, data) {
  console.timeEnd('hash 1gb file');

  if (err)
    console.error(err);

  console.dir(data);

  fsDif.close();
});
