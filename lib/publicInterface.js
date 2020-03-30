'use strict';

const
  mainLoader = require('./mainLoader')
, _ = require('./helpers')
;

let _defaultMinPersistInterval = 120;

let publicFuncs = {
  //reset magicInstance, caches and persistence. for unit tests only!
  '_reset': function () {
    publicFuncs.disableDefaultPersistence();
    mainLoader._reset();
    _._reset();
  },
  '_getMinPersistInterval': function () {
    return _defaultMinPersistInterval;
  },

  'enableDefaultPersistence': function (minPersistInterval, affectMagic = true) {
    if (isNaN(minPersistInterval)) {
      minPersistInterval = publicFuncs._getMinPersistInterval();
    }

    _defaultMinPersistInterval = minPersistInterval;
    mainLoader.setPersistence(true);
    let magicInstance = mainLoader.getMagicInstance();
    if (affectMagic && magicInstance) {
      magicInstance.enablePersistence(minPersistInterval);
    }
  },
  'disableDefaultPersistence': function (affectMagic = true) {
    mainLoader.setPersistence(false);
    if (affectMagic) {
      let magicInstance = mainLoader.getMagicInstance();
      if (magicInstance) {
        magicInstance.disablePersistence();
      }
    }
  },

  'load': mainLoader.load,

  'has': function (key) {
    let magicInstance = mainLoader.ensure();
    return magicInstance.has(key);
  },
  'get': function (key, def) {
    let magicInstance = mainLoader.ensure();
    return magicInstance.get(key, def);
  },
  'set': function (key, value) {
    let magicInstance = mainLoader.ensure();
    return magicInstance.set(key, value);
  },
  'persist': function (key, value) {
    let magicInstance = mainLoader.ensure();
    return magicInstance.persist(key, value);
  }
};

module.exports = publicFuncs;
