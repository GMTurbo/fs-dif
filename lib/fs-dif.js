//

var xhash = require('xxhash'),
  fs = require('fs'),
  path = require('path'),
  _ = require('lodash'),
  mkdirp = require('mkdirp');

function fsDif(options) {

  options = options || {};

  var cachePath = '.sync/diff.cache';
  var cache = getFromDisk() || {
    entries: []
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
  var hashStep = function(fileData) {
    fileData.hash = xhash.hash(fileData.data, 0xCAFEBABE);
    delete fileData.data;
    return fileData;
  };

  //save the file object to disk
  var saveStep = function(fileData) {

    if (!checkIfCached(fileData, 'fullname') &&
      !checkIfCached(fileData, 'hash')) {
      saveToCache(fileData);
    } else {
      overWriteInCache(fileData);
    }

  };

  var saveToCache = function(fileData) {

    cache.entries.push(fileData);

    saveToDisk();
  };

  var overWriteInCache = function(fileData) {

    var index = _.findIndex(cache.entries, function(cached) {
      return fileData.hash == cached.hash;
    });

    cache.entries[index] = fileData;

    saveToDisk();

  };

  var saveToDisk = function() {
    fs.writeFile(cachePath, JSON.stringify(cache), function(err) {
      if (err)
        console.log(err);
    });
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
    }
  };

  //update the cache with a new file
  var update = function(fileData) {
    saveStep(hashStep(fileData));
  };

  //get all files in the cache
  var getStoredFiles = function() {
    return cache.entries;
  };

  return {
    update: update,
    getStoredFiles: getStoredFiles
  };
}

module.exports = fsDif;
