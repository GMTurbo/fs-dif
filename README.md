#Fs-Dif
![alt-text](http://imageserver.moviepilot.com/watcher-what-do-you-guys-think-is-stan-lee-the-watcher.jpeg)

#Details
A node.js filesystem watcher module that fires reliable renamed, moved, created and removed events!

Watcher uses full recursion, so all sub directories will be watched.

#Example:
```javascript

var Differ = require('fs-dif');

var fsDif = new Differ({dirToWatch: dir});

fsDif.on('ready', function(){

  console.log('fsDif ready to rock');

  fsDif.beginWatch();

  fsDif.on('exists', function(err, fileData){
    if(err) {
      console.error(err);
      return;
    }
    console.log('exists', fileData);
  });

  fsDif.on('created', function(err, fileData){
    if(err) {
      console.error(err);
      return;
    }
    console.log('created', fileData);
  });

  fsDif.on('changed', function(err, fileData){
    if(err) {
      console.error(err);
      return;
    }
    console.log('changed', fileData);
  });

  fsDif.on('renamed', function(err, fileData){
    if(err) {
      console.error(err);
      return;
    }
    console.log('renamed', fileData);
  });

  fsDif.on('moved', function(err, fileData){
    if(err) {
      console.error(err);
      return;
    }
    console.log('moved', fileData);
  });

  fsDif.on('removed', function(err, fileData){
    if(err) {
      console.error(err);
      return;
    }
    console.log('removed', fileData);
  });
});
```
#Methods
```javascript
var Differ = require('fs-dif');
```
###Constructor
```javascript
var fsDif = new Differ({
  dirToWatch: dir, //REQUIRED: directory to watch
  debugOutput: true //turn on verbose output logging
  });
```

###beginWatch
```javascript
fsDif.beginWatch(); //begin watching directory
```
#Module Events
###ready - module is ready to begin watching the directory
```javascript
fsDif.on('ready', function(){

  console.log('fsDif ready to rock');

  fsDif.beginWatch();

  fsDif.on('created', function(err, fileData){
    if(err) {
      console.error(err);
      return;
    }
    console.log('created', fileData);
  });

  fsDif.on('changed', function(err, fileData){
    if(err) {
      console.error(err);
      return;
    }
    console.log('changed', fileData);
  });

  fsDif.on('renamed', function(err, fileData){
    if(err) {
      console.error(err);
      return;
    }
    console.log('renamed', fileData);
  });

  fsDif.on('moved', function(err, fileData){
    if(err) {
      console.error(err);
      return;
    }
    console.log('moved', fileData);
  });

  fsDif.on('removed', function(err, fileData){
    if(err) {
      console.error(err);
      return;
    }
    console.log('removed', fileData);
  });
});
```
###error - an error has occurred
```javascript
fsDif.on('error', function(err){
  console.error(err);
});
```

###exists - fires during module startup
On module startup, every file that is within the watch folder has to be enumerated.
Once a file is enumerated, the exists event fires.
```javascript
fsDif.on('exists', function(err, fileData){
  console.error(err);
});
```
#File System Events

###created:
```javascript
fsDif.on('created', function(err, fileData){
  console.log('created', fileData);
});

//data callback structure
fileData = {
  fileName: 'C:\\Users\\person\\Downloads\\master\\jpeg.jpg',
  size: 663260, // file size in bytes
  stale: false, //if file is valid or stale
  hash: 2762316245
}
```
###changed:
```javascript
fsDif.on('changed', function(err, fileData){
  console.log('changed', fileData);
});

//fileData callback structure
fileData = {
  fileName: 'C:\\Users\\person\\Downloads\\master\\jpeg.jpg',
  size: 663260, // file size in bytes
  stale: false, //if file is valid or stale
  hash: 2762326345 // new hash
}
```
###renamed:
```javascript
fsDif.on('renamed', function(err, fileData){
  console.log('renamed', fileData);
});

//fileData callback structure
fileData = {
  fileName: 'C:\\Users\\person\\Downloads\\master\\jpeg1.jpg',
  size: 663260, // file size in bytes
  stale: false, //if file is valid or stale
  hash: 2762316245,
  old: 'C:\\Users\\person\\Downloads\\master\\jpeg.jpg'
}

```
###moved:
```javascript
fsDif.on('moved', function(err, fileData){
  console.log('moved', fileData);
});

//fileData callback structure
fileData = {
  fileName: 'C:\\Users\\person\\Downloads\\master1\\jpeg1.jpg',
  size: 663260, // file size in bytes
  stale: false, //if file is valid or stale
  hash: 2762316245,
  old: 'C:\\Users\\person\\Downloads\\master'
}
```
###removed:
#####Note: *removed events are fired when the file system is idle. So, these events will fire in batches.*

```javascript
fsDif.on('removed', function(fileData){
  console.log('removed', fileData);
});

//fileData callback structure
fileData = {
  fileName: 'C:\\Users\\person\\Downloads\\master\\jpeg.jpg',
  size: 663260, // file size in bytes
  stale: true, //if file is valid or stale
  hash: 2762316245
}
```
