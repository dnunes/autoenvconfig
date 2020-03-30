'use strict';

const
  AutoEnvConfig = require('./AutoEnvConfig')
, _ = require('./helpers')
, path = require('path')
;

let _magicInstance = null;
let _instancesCache = {};

let _persistenceActive = false;

let mainLoader = {
  //reset magicInstance, caches and persistence. for unit tests only!
  '_reset': function () {
    _magicInstance = null;
    _instancesCache = {};
  },

  'getMagicInstance': function () { return _magicInstance; },
  'load': function (envID = '', forceNew = false, pathToMatch = false) {
    if (envID) { //normalize envIDs (node ".json"!)
      let ext = path.extname(envID);
      if (ext === '.json') { envID = envID.slice(0, -5); }
    }

    //Try quick cache hit first
    if (_instancesCache[envID] && !forceNew) { return _instancesCache[envID]; }

    let newInstance = null;
    let saveAsMagic = false;
    if (envID === '') {
      envID = _.findMagicConfigFileID(pathToMatch);
      if (!envID) { return false; } //can't find a config file, can't load!

      saveAsMagic = true;
      //reuse existing instance using the returned envID
      if (_instancesCache[envID] && !forceNew) {
        newInstance = _instancesCache[envID];
      }
    }

    if (!newInstance) {
      let minPersistInterval = null;
      if (_persistenceActive) {
        let publicInterface = require('./publicInterface');
        minPersistInterval = publicInterface._getMinPersistInterval();
      }
      newInstance = new AutoEnvConfig(
        envID, _persistenceActive, minPersistInterval
      );
    }

    //Save references in cache for faster access
    if (saveAsMagic) {
      _instancesCache[''] = newInstance;
      _magicInstance = newInstance;
    }
    if (!_magicInstance) { _magicInstance = newInstance; }

    if (!_instancesCache[envID] && !forceNew) {
      _instancesCache[envID] = newInstance;
    }

    return newInstance;
  },
  'ensure': function () {
    if (_magicInstance) { return _magicInstance; }
    return mainLoader.load();
  },

  'setPersistence': function (status) {
    _persistenceActive = status;
  }
};

module.exports = mainLoader;
