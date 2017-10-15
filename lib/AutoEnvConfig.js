'use strict';

const
  fs = require('fs')
, path = require('path')
;

const default_envsFolder = 'envs';
const default_schemaFileName = 'config.schema';
const default_persistFileKey = '_persistFile';

let p_magicInstance = null;
let p_defaultEnvID = null;
let p_instancesCache = {};

let p_persistenceActive = false;
let p_minPersistInterval = 120;


//Helpers
let _ = {
  'ensureMagicInstance': function (instance) {
    if (p_magicInstance) { return p_magicInstance; }
    if (!instance) { return publicFuncs.load(); }
    p_magicInstance = instance;
    return p_magicInstance;
  },

  'rootPath': path.resolve(path.dirname(require.main.filename)),
  'envsPath': path.resolve(
    path.dirname(require.main.filename),
    default_envsFolder
  ),
  'getConfigFilePath': function (id) {
    return path.resolve(_.envsPath, id);
  },
  'getDefaultPersistenceFilePath': function (id) {
    let configFileInfo = path.parse(id);
    let persistenceFileName = configFileInfo['name'] + '.persist.json'
    return path.resolve(_.envsPath, persistenceFileName);
  },
  'getDefaultEnvID': function () {
    if (p_defaultEnvID) { return p_defaultEnvID; }
    let fileList = fs.readdirSync(_.envsPath);

    let envConfig;
    let envID = false;
    fileList.some((currentFile) => {
      if (path.extname(currentFile) != '.json') { return false; }

      try {
        envConfig = _.loadReference(_.getConfigFilePath(currentFile));
      } catch (err) {
        if (SyntaxError && err instanceof SyntaxError) {
          //Use real debugging log here.
          /* console.log(
            'There is a syntax error in your config file "'+ currentFile +'": '+
            '"'+ err.message +'". This file is being ignored by AutoEnvConfig.'
          ); */
          return false;
        }
        throw err;
      }

      if (envConfig['_path'] == _.rootPath) {
        envID = path.basename(currentFile, '.json');
        return true;
      }
    });
    return (p_defaultEnvID = envID);
  },


  //Generic Helpers
  'objType': function (obj) {
    let t = typeof(obj);
    if (t != 'object') { return t; }
    let isArr = (obj instanceof Array);
    return (isArr) ? 'array' : 'object';
  },
  'supermerge': function (o1, o2) { let r = {}, k, v;
    for (k in o1) { r[k] = o1[k]; }
    for (k in o2) { v = o2[k];
      if (o1[k] && o1[k].constructor === Object && v.constructor === Object) {
        r[k] = _.supermerge(o1[k], v); //array + array = merge
      } else { r[k] = v; } //other combination = override
    } return r;
  },

  //Specific Helpers
  'hasKeyInSchema': function (key, schema) {
    if (typeof(schema['# '+ key]) != 'undefined') { return '# '+ key; }
    if (typeof(schema['? '+ key]) != 'undefined') { return '? '+ key; }
    return false;
  },
  'loadReference': function (filename) {
    if (path.extname(filename) === '') { filename += '.json'; }
    return JSON.parse(fs.readFileSync(filename, "utf8"));
  },

  //DRY Helpers
  'getSilently': function (envConfig, key, returnParent) {
    let cur = envConfig;
    let parent = envConfig;
    let parts = key.split('.');

    let i = 0, n = parts.length;
    let nextKey;
    for (;i<n;i++) { nextKey = parts[i];
      parent = cur;
      cur = cur[nextKey];
      if (typeof(cur) === 'undefined') { return undefined; }
    }
    return (returnParent) ? parent : cur;
  }
};

let _schema = {
  //Schema Private Functions
  'get': function () {
    let schemaFileName = default_schemaFileName;
    let schemaPath = _.getConfigFilePath(schemaFileName);
    let schema;
    try {
      schema = _.loadReference(schemaPath);
    } catch (err) {
      if (~err.message.toLowerCase().indexOf('no such file or directory')) {
        throw new Error(
          'There is no "'+ schemaFileName +'" file in your envs folder!'
        );
      } else if (SyntaxError && err instanceof SyntaxError) {
        throw new Error(
          'There is a syntax error in your schema file "'+ schemaPath +'": '+
          '"'+ err.message +'". Please fix it and try again.'
        );
      }
      throw err;
    }
    return schema;
  },
  'getClean': function (schema, prefix) {
    //For friendly output
    if (!prefix) { prefix = ''; }

    let key, val, prefixedEnvKey, clean = {};
    for (key in schema) { val = schema[key];
      prefixedEnvKey = prefix + key;
      if (key.substring(0, 2) != '# ' && key.substring(0, 2) != '? ') {
        throw new Error(
          'Schema key "'+ prefixedEnvKey +'" doesn\'t have a required prefix!'
        );
      }
      prefixedEnvKey = prefix + key.substring(2);

      let isArr = (val instanceof Array);
      let isObj = (val instanceof Object);
      if (isObj && !isArr) {
        val = _schema.getClean(val, prefixedEnvKey + '.');
      }
      clean[key.substring(2)] = val;
    }
    return clean;
  }
};

let _config = {
  'load': function (path) {
    let envFile;
    try {
      envFile = _.loadReference(path);
    } catch (err) {
      if (SyntaxError && err instanceof SyntaxError) {
        throw new Error(
          'There is a syntax error in your config file "'+ path +'": '+
          '"'+ err.message +'". Please fix it and try loading it again.'
        );
      }
      throw err;
    }
    return envFile;
  },

  'validate': function (schema, envConfig) {
    _config.checkUnexpectedKeys(envConfig, schema);
    _config.checkMissingOrWrongKeys(envConfig, schema);
    return true;
  },

  'checkUnexpectedKeys': function (envConfig, schema, prefix) {
    if (!prefix) { prefix = ''; } //For friendly output
    let envKey, schemaKey, prefixedEnvKey, val;
    for (envKey in envConfig) { //check each config key
      schemaKey = _.hasKeyInSchema(envKey, schema);
      prefixedEnvKey = prefix + envKey;
      //Checking unexpected keys
      if (!schemaKey) {
        throw new Error(
          'Unexpected key "'+ prefixedEnvKey +'" in current env config.'
        );
      }
      //Going deeper in recursion
      val = envConfig[envKey];
      let isArr = (val instanceof Array);
      let isObj = (val instanceof Object);
      if (isObj && !isArr) {
        _config.checkUnexpectedKeys(
          val,
          schema[schemaKey],
          prefixedEnvKey +'.'
        );
      }
    }
    return true;
  },
  'checkMissingOrWrongKeys': function (envConfig, schema, prefix) {
    if (!prefix) { prefix = ''; } //For friendly output
    let schemaKey, envKey, schemaVal, envVal, isOptional, isPresent;
    let prefixedEnvKey, schemaType, envType, isArr, isObj;
    for (schemaKey in schema) { //check each schema config key
      envKey = schemaKey.substr(2);
      schemaVal = schema[schemaKey];
      envVal = envConfig[envKey];

      isOptional = schemaKey.substr(0, 1) === '?';
      isPresent = (typeof(envVal) != 'undefined');
      prefixedEnvKey = prefix + envKey;
      //Checking required keys
      if (!isPresent) {
        if (isOptional) { continue; }
        throw new Error(
          'Required key "'+ prefixedEnvKey +'" missing '+
          'from your current env config!'
        );
      }
      //Checking types
      schemaType = _.objType(schemaVal);
      envType = _.objType(envVal);
      if (schemaType != envType) {
        throw new Error(
          'Env config key "'+ prefixedEnvKey +'" must be of '+
          'type "'+ schemaType +'" ("'+ envType +'" found)'
        );
      }
      //Going deeper in recursion
      isArr = (schemaVal instanceof Array);
      isObj = (schemaVal instanceof Object);
      if (isObj && !isArr) {
        _config.checkMissingOrWrongKeys(envVal, schemaVal, prefixedEnvKey +'.');
      }
    }
    return true;
  }
};


let publicFuncs = {
  //reset autoInstance, cache and persistence. unit tests only
  '_reset': function () {
    publicFuncs.disablePersistence();
    p_defaultEnvID = null;
    p_magicInstance = null;
    p_instancesCache = {};
  },

  'enablePersistence': function (minPersistInterval, affectMagic) {
    if (minPersistInterval == null) { minPersistInterval = 120; }
    if (affectMagic == null) { affectMagic = true; }

    p_minPersistInterval = minPersistInterval;
    p_persistenceActive = true;
    if (affectMagic && p_magicInstance) {
      p_magicInstance.enablePersistence(minPersistInterval);
    }
  },
  'disablePersistence': function (affectMagic) {
    if (affectMagic == null) { affectMagic = true; }

    p_persistenceActive = false;
    if (affectMagic && p_magicInstance) {
      p_magicInstance.disablePersistence();
    }
  },

  'load': function (envID, forceNew) {
    if (envID) {
      let ext = path.extname(envID);
      if (ext === '.json') { envID = envID.slice(0, -5); }
    }

    if (!envID) { envID = ''; }
    if (!forceNew && p_instancesCache[envID]) {
      return p_instancesCache[envID];
    }

    let saveAsDefault = false;
    if (envID === '') {
      saveAsDefault = true;
      envID = _.getDefaultEnvID();
      if (!envID) { return false; }
    }
    let autoEnvConfigInstance = new AutoEnvConfig(
      envID, p_persistenceActive, p_minPersistInterval
    );
    if (saveAsDefault) {
      p_instancesCache[''] = autoEnvConfigInstance;
    }
    if (!forceNew) {
      p_instancesCache[envID] = autoEnvConfigInstance;
    }
    _.ensureMagicInstance(autoEnvConfigInstance);
    return autoEnvConfigInstance;
  },

  'has': function (key) {
    _.ensureMagicInstance();
    return p_magicInstance.has(key);
  },
  'get': function (key, def) {
    _.ensureMagicInstance();
    return p_magicInstance.get(key, def);
  },
  'set': function (key, value) {
    _.ensureMagicInstance();
    return p_magicInstance.set(key, value);
  },
  'persist': function (key, value) {
    _.ensureMagicInstance();
    return p_magicInstance.persist(key, value);
  }
};


class EventualPersistence {
  constructor(path, minPersistInterval) {
    if (minPersistInterval == null) { minPersistInterval = 120; }

    this._path = path;
    this._minPersistInterval = minPersistInterval;

    this._timeout = null;

    let persistedData;
    try {
      persistedData = _.loadReference(path);

    } catch (err) {

      if (err.code === 'ENOENT') { //Missing file. Try to create it.
        try {
          this._create();
          persistedData = {};
        } catch (err) { //Couldn't create it. Invalid path/wrong permissions?
          throw new Error(
            'The persistence file "'+ path +'" does not exists and could not '+
            'be created: "'+ err.message +'". Check the path and permissions.'
          );
        }

      } else if (SyntaxError && err instanceof SyntaxError) {
        //TODO: add option to ignore error and create a new file on error!
        //if (false) { //purge the file and write "{}" on it.
        //  persistedData = {};
        //}

        //Syntax error on persistence file. This should never happen.
        throw new Error(
          'There is a syntax error in your persistence file "'+ path +'". '+
          'Maybe it got corrupted? Please fix or purge it and try again. '+
          'Error message: "'+ err.message +'".'
        );

      } else { //Other errors
        throw new Error(
          'Unknown error while loading your persistence file "'+ path +'". '+
          'Error message: "'+ err.message +'".'
        );
      }
    }

    this._persistedData = persistedData;
  }

  _create() {
    fs.writeFileSync(this._path, '{}');
    return true;
  }

  getPersistedData() { return this._persistedData; }

  _setDirty() {
    this._dirty = true;
    this._persist();
  }

  _persist() {
    //no need or already running
    if (!this._dirty || this._running) { return false; }
    //too early
    if (this._timeout) { return false; }

    this._dirty = false;
    this._running = true;
    this._writeToDisk();
  }

  _writeToDisk() {
    let contents = JSON.stringify(this.getPersistedData());
    fs.writeFile(this._path, contents, (error) => {
      if (error) { return this._persistFailed(); }
      else { return this._persistOK(); }
    });
  }
  _persistOK() {
    this._running = false;
    return this._throttle();
  }
  _persistFailed() {
    this._dirty = true;
    this._running = false;
    return this._throttle();
  }

  _throttle() {
    this._timeout = setTimeout(
      this._throttleRelease.bind(this), this._minPersistInterval *1000
    );
  }
  _throttleRelease() {
    this._timeout = null;
    return this._persist();
  }

  update(key, value) {
    let cur = this._persistedData;
    let parts = key.split('.'), last = parts.pop();

    let i = 0, n = parts.length, nextKey;
    for (;i<n;i++) { nextKey = parts[i];
      if (typeof(cur[nextKey]) === 'undefined') { cur[nextKey] = {}; }
      cur = cur[nextKey];
    }

    if (cur[last] == value) { return false; }

    cur[last] = value;
    return this._setDirty();
  }
}


class AutoEnvConfig {
  constructor(id, activatePersistence, minPersistInterval) {
    this.id = id;
    this.eventualPersistence = null;

    let schema = _schema.get();
    let defaultData = _schema.getClean(schema);
    let envFile = _config.load(_.getConfigFilePath(id));

    _config.validate(schema, envFile);
    this.currentConfig = _.supermerge(defaultData, envFile);

    if (activatePersistence) {
      this.enablePersistence(minPersistInterval);
    }
  }

  enablePersistence(minPersistInterval, overrideMemory) {
    if (minPersistInterval == null) {
      minPersistInterval = p_minPersistInterval;
    }
    if (overrideMemory == null) { overrideMemory = true; }

    let persistenceFilePath = this.get(default_persistFileKey, false)
      || _.getDefaultPersistenceFilePath(this.id);
    this.eventualPersistence =
      new EventualPersistence(persistenceFilePath, minPersistInterval);

    let persistedData = this.eventualPersistence.getPersistedData();

    if (overrideMemory) {
      this.currentConfig = _.supermerge(this.currentConfig, persistedData);
    }
  }
  disablePersistence() {
    this.eventualPersistence = null;
  }


  load(file, forceNew) { return publicFuncs.load(file, forceNew); }

  has(key) {
    let data = _.getSilently(this.currentConfig, key);
    return (typeof(data) !== 'undefined');
  }
  get(key, def) {
    let data = _.getSilently(this.currentConfig, key);
    if (typeof(data) === 'undefined') { //can't find.
      //default not passed, throw error
      if (typeof(def) === 'undefined') {
        throw new Error(
          'Can\'t find key "'+ key +'" on current env config '+
          '("'+ this.id +'") and there was no default on function call!'
        );
      }
      //default passed. use it.
      return def;
    }
    return data;
  }
  set(key, value) {
    let parent = _.getSilently(this.currentConfig, key, 'returnParent');
    if (typeof(parent) === 'undefined') {
      throw new Error(
        'Can\'t find key "'+ key +'" on current env config ("'+ this.id +'").'
      );
    }

    let parts = key.split('.');
    let propName = parts.pop();
    let curType = _.objType(parent[propName]);
    let newType = _.objType(value);
    if (curType != newType) {
      throw new Error(
        'Env config key "'+ key +'" must be of '+
        'type "'+ curType +'" ("'+ newType +'" received)'
      );
    }
    parent[propName] = value;
    return true;
  }
  persist(key, value) {
    if (!this.eventualPersistence) {
      throw new Error(
        'The current instance of AutoEnvConfig was not set to have '+
        'persistence activated!'
      );
    }

    this.set(key, value);
    this.eventualPersistence.update(key, value);

    return true;
  }
}

module.exports = publicFuncs;
