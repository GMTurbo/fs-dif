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
  watch = require('watch');

function fsDif(options) {

  options = options || {};

  var cachePath = '.sync/diff.cache',
    seed = 0xCAFEBABE,
    changed = false,
    self = this;

  var sb = new StreamBouncer({
    streamsPerTick: 1,
    poll: 250,
  });

  var cache = getFromDisk() || {
    entries: []
  };

  var saveInterval = setInterval(function() {

    checkForExistence();

    if (!changed)
      return;
    saveToDisk();
    changed = false;
  }, 5000);

  var close = function() {
    clearInterval(saveInterval);
  };

  var _emit = function(event, data) {
    self.emit(event, data);
  };

  var _on = function(event, cb) {
    self.on(event, cb);
  };

  var checkForExistence = function() {
    var toRemove = _.filter(cache.entries, function(cached) {
      return !fs.existsSync(cached.fileName);
    });

    _.forEach(toRemove, function(removeMe) {
      removeFromCache(removeMe);
    });
  };
  //load the cache from disk
  function getFromDisk() {

    mkdirp.sync('.sync');

    if (!fs.existsSync(cachePath))
      return;

    var data = fs.readFileSync(cachePath);

    var json;

    try {
      json = JSON.parse(data);
    } catch (e) {
      console.error(e);
    }

    return json;
  }

  //hash the file passed to it
  var hashStepSync = function(fileData) {
    fileData.hash = xhash.hash(fileData.data, seed);
    //don't store the file.data after hash completed
    delete fileData.data;
    return fileData;
  };

  //save the file object to disk
  var saveStep = function(fileData) {

    var err;

    try {

      if (!checkIfCached(fileData)) {
        //cache if doesn't exists
        saveToCache(fileData);
        return {
          action: 'created',
          fileData: fileData
        };

      } else if (checkIfCached(fileData, 'hash')) {
        //if hash exists, then we need to make
        // sure that the file
        if (shouldOverWrite(fileData)) {
          overWriteInCache(fileData);
          return {
            action: 'renamed',
            fileData: fileData
          };
        } else {
          saveToCache(fileData);
          return {
            action: 'created',
            fileData: fileData
          };
        }
      }

    } catch (e) {
      err = e;
      changed = false;
    }

    return err;
  };

  var shouldOverWrite = function(newFileData) {
    //check if file already cached still exists,
    //if it does, then we want to save the new one,
    //else, we over write cache.

    var index = _.findIndex(cache.entries, function(cached) {
      return newFileData.hash == cached.hash;
    });

    if (!fs.existsSync(cache.entries[index].fileName))
      return true;

    //if the dirnames are the same, then overwrite, else add
    var overWrite = path.dirname(cache.entries[index].fileName) == path.dirname(newFileData.fileName);
    overWrite = overWrite &&
      path.basename(cache.entries[index].fileName) == path.basename(newFileData.fileName);
    return overWrite;
  };

  var removeFromCache = function(fileData) {
    _.remove(cache.entries, function(cached) {
      return cached.fileName == fileData.fileName;
    });
    changed = true;
    _emit('removed', fileData);
  };

  var saveToCache = function(fileData) {

    cache.entries.push(fileData);
    changed = true;
  };

  var overWriteInCache = function(fileData) {

    var index = _.findIndex(cache.entries, function(cached) {
      return fileData.hash == cached.hash;
    });

    cache.entries[index] = fileData;
    changed = true;
  };

  function saveToDisk() {
    fs.writeFile(cachePath, JSON.stringify(cache), function(err) {
      if (err)
        console.log(err);

      _emit('saved', {
        path: cachePath,
        success: !err
      });

    });
  }

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
      default:
        return (_.findIndex(cache.entries, function(cached) {
          return fileData.hash == cached.hash ||
            fileData.fileName == cached.fileName;
        }) > -1);
    }
  };

  //update the cache with a new file
  var updateSync = function(fileData) {
    saveStep(hashStepSync(fileData));
  };

  var createHash = function(fileData, cb) {

    var hasher = new xhash(seed);

    return {
      onData: function(data) {
        hasher.update(data);
      },
      onEnd: function() {
        fileData.hash = hasher.digest();
        process.nextTick(function() {
          cb(saveStep(fileData));
        });
      }
    };
  };

  var updateAsync = function(inputFileInfo, cb) {

    var fileData = {
      fileName: inputFileInfo.fileName,
      size: inputFileInfo.size
    };

    // if (fileData.size === 0) {
    //   removeFromCache(fileData);
    //   cb({
    //     action: 'removed',
    //     fileData: fileData
    //   });
    //   return;
    // }

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

  var beginWatch = function(dirToWatch) {

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

      // monitor.on("removed", function(f, stat) {
      //   updateAsync({
      //     fileName: f,
      //     size: stat ? stat.size : 0
      //   }, function(data) {
      //
      //     if (data.err)
      //       _emit('error', err);
      //
      //     _emit(data.action, data);
      //
      //   });
      // });
    });
  };

  return {
    updateSync: updateSync,
    update: updateAsync,
    getStoredFiles: getStoredFiles,
    close: close,
    beginWatch: beginWatch,
    on: _on
  };
}

util.inherits(fsDif, events.EventEmitter);

module.exports = fsDif;
