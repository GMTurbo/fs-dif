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

  fsDif.on('created', function(err, data){
    if(err) {
      console.error(err);
      return;
    }
    console.log('created', data);
  });

  fsDif.on('changed', function(err, data){
    if(err) {
      console.error(err);
      return;
    }
    console.log('changed', data);
  });

  fsDif.on('renamed', function(err, data){
    if(err) {
      console.error(err);
      return;
    }
    console.log('renamed', data);
  });

  fsDif.on('moved', function(err, data){
    if(err) {
      console.error(err);
      return;
    }
    console.log('moved', data);
  });

  fsDif.on('removed', function(err, data){
    if(err) {
      console.error(err);
      return;
    }
    console.log('removed', data);
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

  fsDif.on('created', function(err, data){
    if(err) {
      console.error(err);
      return;
    }
    console.log('created', data);
  });

  fsDif.on('changed', function(err, data){
    if(err) {
      console.error(err);
      return;
    }
    console.log('changed', data);
  });

  fsDif.on('renamed', function(err, data){
    if(err) {
      console.error(err);
      return;
    }
    console.log('renamed', data);
  });

  fsDif.on('moved', function(err, data){
    if(err) {
      console.error(err);
      return;
    }
    console.log('moved', data);
  });

  fsDif.on('removed', function(err, data){
    if(err) {
      console.error(err);
      return;
    }
    console.log('removed', data);
  });
});
```
###error - an error has occurred
```javascript
fsDif.on('error', function(err){
  console.error(err);
});
```
#File System Events

###created:
```javascript
fsDif.on('created', function(err, data){
  console.log('created', data);
});

//data callback structure
data = {
  fileName: 'C:\\Users\\person\\Downloads\\master\\jpeg.jpg',
  size: 663260, // file size in bytes
  stale: false, //if file is valid or stale
  hash: 2762316245
}
```
###changed:
```javascript
fsDif.on('changed', function(err, data){
  console.log('changed', data);
});

//data callback structure
data = {
  fileName: 'C:\\Users\\person\\Downloads\\master\\jpeg.jpg',
  size: 663260, // file size in bytes
  stale: false, //if file is valid or stale
  hash: 2762326345 // new hash
}
```
###renamed:
```javascript
fsDif.on('renamed', function(err, data){
  console.log('renamed', data);
});

//data callback structure
data = {
  fileName: 'C:\\Users\\person\\Downloads\\master\\jpeg1.jpg',
  size: 663260, // file size in bytes
  stale: false, //if file is valid or stale
  hash: 2762316245,
  old: 'C:\\Users\\person\\Downloads\\master\\jpeg.jpg'
}

```
###moved:
```javascript
fsDif.on('moved', function(err, data){
  console.log('moved', data);
});

//data callback structure
data = {
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
fsDif.on('removed', function(data){
  console.log('removed', data);
});

//data callback structure
data = {
  fileName: 'C:\\Users\\person\\Downloads\\master\\jpeg.jpg',
  size: 663260, // file size in bytes
  stale: true, //if file is valid or stale
  hash: 2762316245
}
```
