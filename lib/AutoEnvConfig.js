const
  _ = require('./helpers')
, EventualPersistence = require('./EventualPersistence')
;

const defaultSchemaFileName = 'config.schema';
const defaultPersistFileKey = '_persistFile';

let _schema = {
  //Schema Private Functions
  'get': function () {
    let schemaFileName = defaultSchemaFileName;
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
    for (key in schema) {
      val = schema[key];
      prefixedEnvKey = prefix + key;
      if (key.substring(0, 2) !== '# ' && key.substring(0, 2) !== '? ') {
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
  //Config Private Functions
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
      isPresent = (typeof envVal !== 'undefined');
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
      if (schemaType !== envType) {
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
    if (minPersistInterval === undefined) {
      let publicInterface = require('./publicInterface');
      minPersistInterval = publicInterface._getMinPersistInterval();
    }
    if (overrideMemory === undefined) { overrideMemory = true; }

    let persistenceFilePath = this.get(defaultPersistFileKey, false)
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


  load(file, forceNew) {
    let mainLoader = require('./mainLoader');
    return mainLoader.load(file, forceNew);
  }

  has(key) {
    let data = _.getSilently(this.currentConfig, key);
    return (typeof data !== 'undefined');
  }
  get(key, def) {
    let data = _.getSilently(this.currentConfig, key);
    if (typeof data === 'undefined') { //can't find.
      //default not passed, throw error
      if (typeof def === 'undefined') {
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
    if (typeof parent === 'undefined') {
      throw new Error(
        'Can\'t find key "'+ key +'" on current env config ("'+ this.id +'").'
      );
    }

    let parts = key.split('.');
    let propName = parts.pop();
    let curType = _.objType(parent[propName]);
    let newType = _.objType(value);
    if (curType !== newType) {
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


module.exports = AutoEnvConfig;
