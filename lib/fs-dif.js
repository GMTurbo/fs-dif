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
    changed = false;

  var sb = new StreamBouncer({
    streamsPerTick: 1,
    poll: 250,
  });

  var cache = getFromDisk() || {
    entries: []
  };

  var saveInterval = setInterval(function() {
    if (!changed)
      return;
    saveToDisk();
    changed = false;
  }, 2500);

  var close = function() {
    clearInterval(saveInterval);
  };

  var emit = this.emit,
    on = this.on;
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
        // sure that the filen
        overWriteInCache(fileData);

        return {
          action: 'renamed',
          fileData: fileData
        };
      }

      changed = true;
    } catch (e) {
      err = e;
      changed = false;
    }

    return err;
  };

  var removeFromCache = function(fileData) {
    _.remove(cache.entities, function(cached) {
      return cached.fileName == fileData.fileName;
    });
  };

  var saveToCache = function(fileData) {

    cache.entries.push(fileData);

  };

  var overWriteInCache = function(fileData) {

    var index = _.findIndex(cache.entries, function(cached) {
      return fileData.hash == cached.hash;
    });

    cache.entries[index] = fileData;

  };

  function saveToDisk() {
    fs.writeFile(cachePath, JSON.stringify(cache), function(err) {
      if (err)
        console.log(err);

      emit('saved', {
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
          cb(saveStep(fileData), fileData);
        });
      }
    };
  };

  var updateAsync = function(filePath, cb) {

    var fileData = {
      fileName: filePath,
      size: fs.statSync(filePath).size
    };

    if (fileData.size === 0) {
      removeFromCache(fileData);
      cb(undefined, fileData);
    }

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
        updateAsync(f, function(err, data) {

          if (err)
            emit('error', err);

          emit(data.action, data.fileData);

        });
      });

      monitor.on("changed", function(f, curr, prev) {
        updateAsync(f, function(err, data) {

          if (err)
            emit('error', err);

          emit(data.action, data);

        });
      });

      monitor.on("removed", function(f, stat) {
        updateAsync(f, function(err, data) {

          if (err)
            emit('error', err);

          emit('removed', data);

        });
      });
    });
  };

  return {
    updateSync: updateSync,
    update: updateAsync,
    getStoredFiles: getStoredFiles,
    close: close,
    beginWatch: beginWatch,
    on: on
  };
}

util.inherits(fsDif, events.EventEmitter);

module.exports = fsDif;
