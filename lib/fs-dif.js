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

  var seed = 0xCAFEBABE,
    changed = false,
    closeDown = false,
    self = this,
    working = false,
    interval = null,
    debug = options.debugOutput || false;
    dirToWatch = options.dirToWatch;

  var sb = new StreamBouncer({
    streamsPerTick: 1,
    poll: 100,
  });

  var cache = {
    entries: []
  };

  if (!dirToWatch) {
    var mes = 'dirToWatch must be supplied :/';
    if(debug)
      console.error(mes);
    _emit('error', mes);
    return;
  }

  //this guy will reset on each call
  var _startInterval = function() {

    if (interval)
      clearInterval(interval);

    interval = setInterval(function() {

      if (working)
        return;

      if(debug){
        var removeCount = 0;
      }

      _.forEach(cache.entries, function(cached) {
        if (cached.stale) {
          _emit('removed', null, cached);
          if(debug)
            removeCount++;
        }
      });

      if(debug && removeCount)
        console.log(removeCount + ' stale files removed');

      _.remove(cache.entries, function(cached) {
        return cached.stale;
      });

    }, 5000);

  };

  //EventEmitter forwarding functions
  function _emit(event, err, data) {
    self.emit(event, err, data);
  }

  //check that everything in cache exists
  var _checkForExistence = function() {

    //get list of cached files that no longer exists on disk
    var toRemove = _.filter(cache.entries, function(cached) {
      return !fs.existsSync(cached.fileName);
    });

    //remove non-existant cache entries
    _.forEach(toRemove, function(removeMe) {
      _markStaleAndClean(removeMe);
    });


  };

  var _alreadyCached = function(fileData) {
    return (_.findIndex(cache.entries, function(cached) {
      return fileData.hash == cached.hash &&
        fileData.fileName == cached.fileName &&
        !fileData.stale;
    }) > -1);
  };

  //save the file object to disk
  var _saveStep = function(fileData) {

    //if the fileData has a data property, get rid of it
    if (fileData.data) {
      //don't store the file.data after hash completed
      //fileData.data should only exists if we're doing
      //a sync hash
      delete fileData.data;
    }

    var err;

    if (_alreadyCached(fileData)) {
      return {
        action: 'exists',
        fileData: fileData
      };
    }

    try {

      if (_checkForRename(fileData)) {

        _saveToCache(fileData);

        return {
          action: 'renamed',
          fileData: fileData
        };

      } else if (_checkForMoved(fileData)) {

        _saveToCache(fileData);

        return {
          action: 'moved',
          fileData: fileData
        };

      } else if (!_checkIfCached(fileData, 'fullname')) {

        _saveToCache(fileData);

        return {
          action: 'created',
          fileData: fileData
        };
      }


    } catch (e) {
      err = e;
      changed = false;

    }

    return {
      action: 'error',
      fileData: undefined,
      error: err
    };

  };

  var _checkForRename = function(newFileData) {

    //a file has been renamed if all other file hashes
    //that exist in cache are stale and the directories are the same

    var index = _.findIndex(cache.entries, function(cached) {
      return newFileData.hash == cached.hash && cached.stale;
    });

    if (index == -1)
      return false;

    var result = !helpers.sameFileName(cache.entries[index].fileName, newFileData.fileName);

    //if we are going to rename, remove the old stale file
    if (result) {
      newFileData.old = cache.entries[index].fileName;
      cache.entries.splice(index, 1);
    }

    return result;
  };

  var _checkForMoved = function(newFileData) {

    //we should first check for stale file in cache with
    //the same filename

    var index = _.findIndex(cache.entries, function(cached) {
      var sameName = helpers.sameFileName(newFileData.fileName, cached.fileName);
      return sameName && cached.stale;
    });

    if (index == -1)
      return false;

    if (cache.entries[index].hash != newFileData.hash) {
      if(debug)
        console.error('hash mismatch :(');
      return false;
    }
    //~\Documents\node\fs-dif\file.txt
    //~\Documents\node\fs-dif\tmp\file copy.txt

    //we already checked for same file name, so we now have to ensure
    //that the files aren't in the same directory
    var result = !helpers.inSameDirectory(cache.entries[index].fileName, newFileData.hash.fileName);

    //if we are going to rename, remove the old stale file
    if (result) {
      newFileData.old = cache.entries[index].fileName;
      cache.entries.splice(index, 1);
    }

    return result;

  };

  var _markStaleAndClean = function(fileData) {

    var index = _.findIndex(cache.entries, function(cached) {
      return fileData.fileName == cached.fileName;
    });

    if (index == -1)
      return;

    var cached = cache.entries[index];
    //update cache with new fileData
    cached.stale = true;
  };

  var _saveToCache = function(fileData) {

    fileData.stale = false;
    //add new file to cache
    cache.entries.push(fileData);

    working = false;
    _startInterval();
  };

  //check if the file object has already been cached
  var _checkIfCached = function(fileData, property) {

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

  //async hashing function closure used with through module
  var _createHash = function(fileData, cb) {

    //create new xhash object
    var hasher = new xhash(seed);
    clearInterval(interval);
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
          var result = _saveStep(fileData);
          _checkForExistence();
          working = false;
          _startInterval();
          cb(result);
        });
      }
    };
  };

  var _validateCache = function(dirToValidate) {
    readdirp({
        root: dirToValidate,
        directoryFilter: ['!*modules', '!.*']
      })
      .on('data', function(entry) {
        updateAsync({
          fileName: entry.fullPath,
          size: entry.stat.size
        }, function(data) {
          if (data && debug)
            console.log('updating cache with ', data);
        });
      }).on('end', function() {
        _emit('ready', {});
      });
  };

  // ******** Exposed Methods ********

  var updateAsync = function(inputFileInfo, cb) {

    var fileData = {
      fileName: inputFileInfo.fileName,
      size: inputFileInfo.size,
      stale: inputFileInfo.size === 0
    };

    if (inputFileInfo.isDirectory) {
      cb({
        action: 'created',
        fileData: fileData
      });
      return;
    }

    if (fileData.stale) {

      _markStaleAndClean(fileData);

      // prepCb(cb, {
      //   action: 'removed',
      //   fileData: fileData
      // });

      //cb();

      return;
    }

    var hasher = _createHash(fileData, cb);

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

  var beginWatch = function() {

    watch.createMonitor(dirToWatch, function(monitor) {

      monitor.on("created", function(f, stat) {
        updateAsync({
          fileName: f,
          size: stat ? stat.size : 0,
          isDirectory: stat.isDirectory()
        }, function(data) {

          data = data || {};

          if (data.err)
            _emit('error', err);

          _emit(data.action, data.err, data.fileData);

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
          size: stat ? stat.size : 0,
          isDirectory: stat.isDirectory()
        }, function() {});
      });
    });
  };

  function close() {
    if (interval)
      clearInterval(interval);
  }

  //EventEmitter forwarding functions
  function _on(event, cb) {
    self.on(event, cb);
  }

  // ******** Exposed Methods ********

  _validateCache(dirToWatch);

  return {
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
