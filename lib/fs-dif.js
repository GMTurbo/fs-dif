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
  readdirp = require('readdirp'),
  minimatch = require('minimatch');


var fsDif = function(options) {

  options = options || {};

  var seed = 0xCAFEBABE,
    closeDown = false,
    self = this,
    working = false,
    interval = null,
    debug = options.debugOutput || false,
    dirToWatch = options.dirToWatch,
    ignoreDotFiles = options.ignoreDotFiles || false,
    dirFilter = options.directoryFilter, //['!*modules']
    fileFilter = options.fileFilter; //['!*.js']

  var sb = new StreamBouncer({
    streamsPerTick: 1,
    poll: 100,
  });

  var cache = {
    entries: []
  };

  if (!dirToWatch) {
    var mes = 'dirToWatch must be supplied :/';
    if (debug)
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

      if (debug) {
        var removeCount = 0;
      }

      _.forEach(cache.entries, function(cached) {
        if (cached.stale) {
          _emit('removed', null, cached);
          if (debug)
            removeCount++;
        }
      });

      if (debug && removeCount)
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

    var err;

    if (_alreadyCached(fileData)) {
      return {
        action: 'exists',
        fileData: fileData
      };
    }

    try {
      //changed event happened
      if (fileData.type === 'changed') {

        _overWriteCache(fileData);

        return {
          action: 'changed',
          fileData: fileData
        };
      }

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
      if (debug)
        console.error('hash mismatch :(');
      _emit('error', 'hash mismatch :(');
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

    delete fileData.type;
    delete fileData.size; // haven't used this guy at this point

    //add new file to cache
    cache.entries.push(fileData);

    working = false;
    _startInterval();
  };

  var _overWriteCache = function(fileData) {

    //get index of fileData hash
    var index = _.findIndex(cache.entries, function(cached) {
      return fileData.fileName == cached.fileName;
    });

    if (index == -1)
      return;

    //update cache with new fileData
    cache.entries.splice(index, 1);

    _saveToCache(fileData);

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

  var _validateCache = function(dirToValidate, dirFilter, fileFilter) {

    dirFilter = dirFilter || ['*'];
    fileFilter = fileFilter || ['*'];

    readdirp({
      root: dirToValidate,
      directoryFilter: dirFilter,
      fileFilter: fileFilter
    }, function(entry) {
      updateAsync({
        fileName: entry.fullPath,
        type: 'created',
        size: entry.stat ? entry.stat.size : 0,
        isDirectory: entry.stat.isDirectory()
      }, function(data) {
        if (data && debug)
          console.log('updating cache with ', data);

        _emit('exists', data.err, data.fileData);
      });
    }, function(err) {
      _emit('ready', {});
    });
  };

  // ******** Exposed Methods ********

  var updateAsync = function(inputFileInfo, cb) {

    var fileData = inputFileInfo;
    fileData.stale = inputFileInfo.size === 0;

    if (fileData.isDirectory) {
      cb({
        action: 'created',
        fileData: fileData
      });
      return;
    }

    if (fileData.stale) {
      _markStaleAndClean(fileData);
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

    //this function maps the filters used in readdirp
    // to the watch module filter function
    var filterThese = function(dirFilter, fileFilter) {
      /*
        minimatch("bar.foo", "*.foo") // true!
        minimatch("bar.foo", "*.bar") // false!
      */
      //return true for allow, false for blow
    //  debugger;
      var fileFilterMM = helpers.normalizeFilter(fileFilter) || function() {
        return true;
      };
      var directoryFilterMM = helpers.normalizeFilter(dirFilter) || function() {
        return true;
      };

      return function(name, stat) {
        return stat.isDirectory() ?
          directoryFilterMM(name) :
          fileFilterMM(name);
      };

    };

    watch.createMonitor(dirToWatch, {
      filter: filterThese(dirFilter, fileFilter),
      ignoreDotFiles: ignoreDotFiles,
      ignoreUnreadableDir: true
    }, function(monitor) {

      monitor.on("created", function(f, stat) {
        updateAsync({
          fileName: f,
          type: 'created',
          size: stat ? stat.size : 0,
          isDirectory: stat.isDirectory()
        }, function(data) {

          data = data || {};

          if (data.err)
            _emit('error', err);

          _emit(data.action, data.err, data.fileData);

        });
      });

      monitor.on("changed", function(f, curr, prev) {
        updateAsync({
          fileName: f,
          size: curr ? curr.size : 0,
          isDirectory: curr.isDirectory(),
          type: 'changed'
        }, function(data) {

          if (data.err)
            _emit('error', err);

          _emit(data.action, data.err, data.fileData);

        });
      });

      monitor.on("removed", function(f, stat) {
        updateAsync({
          fileName: f,
          size: stat ? stat.size : 0,
          isDirectory: stat.isDirectory(),
          type: 'removed'
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

  _validateCache(dirToWatch, dirFilter, fileFilter);

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
  },
  isFunction: function(obj) {
    return toString.call(obj) === '[object Function]';
  },
  isString: function(obj) {
    return toString.call(obj) === '[object String]';
  },
  isRegExp: function(obj) {
    return toString.call(obj) === '[object RegExp]';
  },
  isUndefined: function(obj) {
    return obj === void 0;
  },
  //taken from https://github.com/thlorenz/readdirp/blob/master/readdirp.js
  normalizeFilter: function(filter) {

    if (this.isUndefined(filter))
      return undefined;

    function isNegated(filters) {

      function negated(f) {
        return f.indexOf('!') === 0;
      }

      var some = filters.some(negated);
      if (!some) {
        return false;
      } else {
        if (filters.every(negated)) {
          return true;
        } else {
          // if we detect illegal filters, bail out immediately
          throw new Error(
            'Cannot mix negated with non negated glob filters: ' + filters + '\n' +
            'https://github.com/thlorenz/readdirp#filters'
          );
        }
      }
    }

    // Turn all filters into a function
    if (this.isFunction(filter)) {

      return filter;

    } else if (this.isString(filter)) {

      return function(entryInfo) {
        return minimatch(entryInfo, filter.trim());
      };

    } else if (filter && Array.isArray(filter)) {

      if (filter) filter = filter.map(function(f) {
        return f.trim();
      });

      return isNegated(filter) ?
        // use AND to concat multiple negated filters
        function(entryInfo) {
          return filter.every(function(f) {
            return minimatch(entryInfo, f);
          });
        } :
        // use OR to concat multiple inclusive filters
        function(entryInfo) {
          return filter.some(function(f) {
            return minimatch(entryInfo, f);
          });
        };
    }
  }
};
