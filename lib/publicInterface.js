const
  mainLoader = require('./mainLoader')
, _ = require('./helpers')
;

let _defaultMinPersistInterval = 120;

let publicFuncs = {
  //reset magicInstance, caches and persistence. for unit tests only!
  '_reset': function () {
    publicFuncs.disablePersistence();
    mainLoader._reset();
    _._reset();
  },
  '_getMinPersistInterval': function () {
    return _defaultMinPersistInterval;
  },

  'enablePersistence': function (minPersistInterval, affectMagic) {
    if (minPersistInterval === undefined) { minPersistInterval = 120; }
    if (affectMagic === undefined) { affectMagic = true; }

    _defaultMinPersistInterval = minPersistInterval;
    mainLoader.setPersistence(true);
    let magicInstance = mainLoader.getMagicInstance();
    if (affectMagic && magicInstance) {
      magicInstance.enablePersistence(minPersistInterval);
    }
  },
  'disablePersistence': function (affectMagic) {
    if (affectMagic === undefined) { affectMagic = true; }

    mainLoader.setPersistence(false);
    let magicInstance = mainLoader.getMagicInstance();
    if (affectMagic && magicInstance) {
      magicInstance.disablePersistence();
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
