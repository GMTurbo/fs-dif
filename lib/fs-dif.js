//

var xhash = require('xxhash'),
  fs = require('fs'),
  path = require('path'),
  _ = require('lodash'),
  through = require('through'),
  mkdirp = require('mkdirp'),
  util = require('util'),
  events = require('events'),
  StreamBouncer = require('stream-bouncer'),
  watch = require('watch'),
  readdirp = require('readdirp');

 var fsDif = function(options) {

  options = options || {};

  var cachePath = '.sync/diff.cache',
    seed = 0xCAFEBABE,
    changed = false,
    closeDown = false,
    self = this,
    dirToWatch = options.dirToWatch;

  var sb = new StreamBouncer({
    streamsPerTick: 1,
    poll: 250,
  });

  var cache = getFromDisk() || {
    entries: []
  };

  if (!dirToWatch) {
    var mes = 'dirToWatch must be supplied :/';
    console.error(mes);
    _emit('error', mes);
    return;
  }
  //interval function that handles saving to disk
  var saveInterval = setInterval(function() {

    //check cached values for stale files
    //checkForExistence();

    //if nothing has changed, then exit
    if (!changed) {
      if (closeDown)
        clearInterval(saveInterval);
      return;
    }

    //save to disk
    saveToDisk();

    //reset dirty bit
    changed = false;

    if (closeDown)
      clearInterval(saveInterval);

  }, 2500);

  //stop saveInterval
  var close = function() {
    closeDown = true;
  };

  //EventEmitter forwarding functions
  function _emit(event, data) {
    self.emit(event, data);
  }

  //EventEmitter forwarding functions
  function _on(event, cb) {
    self.on(event, cb);
  }

  //check that everything in cache exists
  var checkForExistence = function() {

    //get list of cached files that no longer exists on disk
    var toRemove = _.filter(cache.entries, function(cached) {
      return !fs.existsSync(cached.fileName);
    });

    //remove non-existant cache entries
    _.forEach(toRemove, function(removeMe) {
      markStaleAndClean(removeMe);
      //removeFromCache(removeMe);
    });


  };

  //load the cache from disk
  function getFromDisk() {

    //if .sync folder doesn't exists, then create it
    mkdirp.sync('.sync');

    //if file doesn't exists on disk, then return
    if (!fs.existsSync(cachePath))
      return;

    //load file contents from disk
    var data = fs.readFileSync(cachePath);
    if (data.length === 0)
      return;
    var json;

    try {
      //parse file contents
      json = JSON.parse(data);

      //remove stale entries on startup
      _.remove(json.entries, function(entry) {
        return entry.stale === true;
      });

    } catch (e) {
      console.error(e);
      _emit('error', e);
    }

    //return file contents
    return json;
  }

  //save cache to disk
  function saveToDisk() {

    //save cache to filesystem as json string
    fs.writeFile(cachePath, JSON.stringify(cache), function(err) {

      //save unsuccessful
      if (err) {
        console.error(err);
        _emit('error', err);
        return;
      }

      //save successful
      _emit('saved', {
        path: cachePath,
        success: !err
      });
    });
  }

  //hash the file passed to it (blocking)
  //only use for small files
  var hashStepSync = function(fileData) {
    fileData.hash = xhash.hash(fileData.data, seed);
    return fileData;
  };

  var alreadyCached = function(fileData) {
    return (_.findIndex(cache.entries, function(cached) {
      return fileData.hash == cached.hash &&
        fileData.fileName == cached.fileName &&
        !fileData.stale;
    }) > -1);
  };

  //save the file object to disk
  var saveStep = function(fileData) {

    //if the fileData has a data property, get rid of it
    if (fileData.data) {
      //don't store the file.data after hash completed
      //fileData.data should only exists if we're doing
      //a sync hash
      delete fileData.data;
    }

    var err;

    if (alreadyCached(fileData))
      return;
    try {

      //check if cache doesn't contain file hash and fullpath already
      if (!checkIfCached(fileData)) {
        //cache if doesn't exists
        saveToCache(fileData);

        return {
          action: 'created',
          fileData: fileData
        };

        //if first check fails, then check check is hash already
        //exists, if it does, we need to check for rename/moved actions
      } else if (checkForRename(fileData)) {

        overWriteInCache(fileData);

        return {
          action: 'renamed',
          fileData: fileData
        };

      } else if (checkForMoved(fileData)) {

        overWriteInCache(fileData);

        return {
          action: 'moved',
          fileData: fileData
        };

      } else {

        saveToCache(fileData);

        return {
          action: 'created',
          fileData: fileData
        };
      }


    } catch (e) {
      err = e;
      changed = false;
    }

    return err;
  };

  var checkForRename = function(newFileData) {

    //a file has been renamed if all other file hashes
    //that exist in cache are stale and the directories are the same

    var prevIndex = _.findIndex(cache.entries, function(cached) {
      return newFileData.hash == cached.hash && cached.stale;
    });

    if (prevIndex == -1)
      return false;

    var result = !helpers.sameFileName(cache.entries[prevIndex].fileName, newFileData.fileName);

    //if we are going to rename, remove the old stale file
    if(result){
      cache.entries.splice(prevIndex,1);
    }

    return result;
  };

  var checkForMoved = function(newFileData){

    //check if file already cached still exists,
    //if it does, then we want to save the new one,
    //else, we over write cache.

    //get index of file already caches with newFileData.hash
    var index = _.findIndex(cache.entries, function(cached) {
      return newFileData.hash == cached.hash;
    });

    if(index == -1)
      return false;

    //if the cached file no longer exists on disk,
    // then we want to overwrite the cached file
    if (!fs.existsSync(cache.entries[index].fileName)) {
      cache.entries[index].stale = true;
    //  cache.entries[index].passCount++;
      return true;
    }

    //~\Documents\node\fs-dif\file.txt
    //~\Documents\node\fs-dif\tmp\file copy.txt

    return !helpers.inSameDirectory(cache.entries[index].fileName, newFileData.fileName) &&
      helpers.sameFileName(cache.entries[index].fileName, newFileData.fileName);

  };

  var shouldOverWrite = function(newFileData) {
    //check if file already cached still exists,
    //if it does, then we want to save the new one,
    //else, we over write cache.

    //get index of file already caches with newFileData.hash
    var index = _.findIndex(cache.entries, function(cached) {
      return newFileData.hash == cached.hash;
    });

    if(index == -1)
      return false;
    //if the cached file no longer exists on disk,
    // then we want to overwrite the cached file
    if (!fs.existsSync(cache.entries[index].fileName)) {
      cache.entries[index].stale = true;
      //cache.entries[index].passCount++;
      return true;
    }

    //overwrite in this case (same hashes, different filenames)
    //~\Documents\node\fs-dif\file.txt
    //~\Documents\node\fs-dif\file copy.txt

    //don't in this case (same hashes, different directories)
    //~\Documents\node\fs-dif\file.txt
    //~\Documents\node\fs-dif\tmp\file copy.txt
    //if the dirnames are the same and the filenames are the same, then overwrite
    //filenames could be the same
    return helpers.inSameDirectory(cache.entries[index].fileName, newFileData.fileName) &&
      helpers.sameFileName(cache.entries[index].fileName, newFileData.fileName);
  };

  var markStaleAndClean = function(fileData) {

    var index = _.findIndex(cache.entries, function(cached) {
      return fileData.fileName == cached.fileName;
    });

    if (index == -1)
      return;

    var cached = cache.entries[index];
    //update cache with new fileData
    cached.stale = true;
    cached.passCount++;

    if(cached.passCount > 1)
      cache.entries.splice(index, 1);

    changed = true;
  };

  var removeFromCache = function(fileData) {

    //remove all cached entries with given filename
    _.remove(cache.entries, function(cached) {
      return cached.fileName == fileData.fileName;
    });

    //make for cache cleanup
    changed = true;
  };

  var saveToCache = function(fileData) {

    fileData.stale = false;
    //add new file to cache
    cache.entries.push(fileData);

    //make for cache cleanup
    changed = true;
  };

  var overWriteInCache = function(fileData) {

    //get index of fileData hash
    var index = _.findIndex(cache.entries, function(cached) {
      return fileData.hash == cached.hash;
    });

    if (index == -1)
      return;

    fileData.stale = false;
    //update cache with new fileData
    cache.entries[index] = fileData;
    changed = true;
  };



  //check if the file object has already been cached
  var checkIfCached = function(fileData, property) {

    switch (property) {

      case 'fullname':
        return (_.findIndex(cache.entries, function(cached) {
          return fileData.fileName == cached.fileName;
        }) > -1);

      case 'hash':
        return (_.findIndex(cache.entries, function(cached) {
          return fileData.hash == cached.hash;
        }) > -1);

      default: // check for both
        return (_.findIndex(cache.entries, function(cached) {
          return fileData.hash == cached.hash ||
            fileData.fileName == cached.fileName;
        }) > -1);
    }
  };

  //update the cache with a new file
  var updateSync = function(fileData) {
    //sequential hash and saving
    saveStep(hashStepSync(fileData));
  };

  //async hashing function closure used with through module
  var createHash = function(fileData, cb) {

    //create new xhash object
    var hasher = new xhash(seed);

    return {
      onData: function(data) {
        //update hash with stream data
        hasher.update(data);
      },
      onEnd: function() {
        //digest hash and save
        fileData.hash = hasher.digest();

        //on next roll of event loop, save and fire cb
        process.nextTick(function() {
          cb(saveStep(fileData));
        });
      }
    };
  };

  var updateAsync = function(inputFileInfo, cb) {

    var fileData = {
      fileName: inputFileInfo.fileName,
      size: inputFileInfo.size,
      stale: inputFileInfo.size === 0,
      passCount: 0
    };

    if (fileData.stale) {
      markStaleAndClean(fileData);
      cb({
        action: 'removed',
        fileData: fileData
      });
      return;
    }

    checkForExistence();

    var hasher = createHash(fileData, cb);

    var readStream = fs.createReadStream(fileData.fileName);

    var tr = new through(hasher.onData, hasher.onEnd);

    sb.push({
      source: readStream,
      destination: tr
    });

  };

  //get all files in the cache
  var getStoredFiles = function() {
    return cache.entries;
  };

  var validateCache = function(dirToValidate) {
    readdirp({
      root: dirToValidate,
      directoryFilter: ['!*modules', '!.*']
    })
      .on('data', function(entry) {
        updateAsync({
          fileName: entry.fullPath,
          size: entry.stat.size
        }, function(data) {
          if (data)
            console.log('updating cache with ', data);
        });
      }).on('end', function() {
        _emit('ready', {});
      });
  };

  var beginWatch = function() {

    //we should do a full recursive scan here to create the cache
    // or at least validate its starting state.


    watch.createMonitor(dirToWatch, function(monitor) {

      monitor.on("created", function(f, stat) {
        updateAsync({
          fileName: f,
          size: stat ? stat.size : 0
        }, function(data) {

          if (data.err)
            _emit('error', err);

          _emit(data.action, data.fileData);

        });
      });

      // monitor.on("changed", function(f, curr, prev) {
      //   updateAsync({
      //     fileName: f,
      //     size: stat ? stat.size : 0
      //   }, function(data) {
      //
      //     if (data.err)
      //       emit('error', err);
      //
      //     emit(data.action, data);
      //
      //   });
      // });

      monitor.on("removed", function(f, stat) {
        updateAsync({
          fileName: f,
          size: stat ? stat.size : 0
        }, function(data) {

          if (data.err)
            _emit('error', err);

          _emit(data.action, data);

        });
      });
    });
  };

  validateCache(dirToWatch);

  return {
    updateSync: updateSync,
    update: updateAsync,
    getStoredFiles: getStoredFiles,
    close: close,
    beginWatch: beginWatch,
    on: _on
  };
};

util.inherits(fsDif, events.EventEmitter);

module.exports = fsDif;

var helpers = {
  inSameDirectory: function(file1, file2) {
    return path.dirname(file1) == path.dirname(file2);
  },
  sameFileName: function(file1, file2) {
    return path.basename(file1) == path.basename(file2);
  }
};
