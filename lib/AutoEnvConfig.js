'use strict';

const
  fs = require('fs')
, path = require('path')
;

let magicInstance = null;
let defaultEnvID = null;
let instancesCache = {};

let _ = {
  'ensureMagicInstance': function (instance) {
    if (magicInstance) { return magicInstance; }
    if (!instance) { return publicFuncs.load(); }
    magicInstance = instance;
    return magicInstance;
  },

  'rootPath': path.resolve(path.dirname(require.main.filename)),
  'envsPath': path.resolve(path.dirname(require.main.filename), 'envs'),
  'getConfigFilePath': function (id) {
    return path.resolve(_.envsPath, id);
  },

  'getSchema': function (name) {
    if (!name) { name = 'config'; }
    let schemaPath = _.getConfigFilePath(name +'.schema');
    let schema;
    try {
      schema = _.loadReference(schemaPath);
    } catch (err) {
      if (~err.message.toLowerCase().indexOf('no such file or directory')) {
        throw new Error(
          'There is no "'+ name +'.schema" file in your envs folder!'
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
  'hasKeyInSchema': function (key, schema) {
    if (typeof(schema['# '+ key]) != 'undefined') { return '# '+ key; }
    if (typeof(schema['? '+ key]) != 'undefined') { return '? '+ key; }
    return false;
  },

  'getCleanSchema': function (schema, prefix) {
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
        val = _.getCleanSchema(val, prefixedEnvKey + '.');
      }
      clean[key.substring(2)] = val;
    }
    return clean;
  },

  'objType': function (obj) {
    let t = typeof(obj);
    if (t != 'object') { return t; }
    let isArr = (obj instanceof Array);
    return (isArr) ? 'array' : 'object';
  },
  'validateConfig': function (schema, envConfig) {
    _.checkUnexpectedKeys(envConfig, schema);
    _.checkMissingOrWrongKeys(envConfig, schema);
    return true;
  },
  'checkUnexpectedKeys': function (envConfig, schema, prefix) {
    //For friendly output
    if (!prefix) { prefix = ''; }

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
        _.checkUnexpectedKeys(val, schema[schemaKey], prefixedEnvKey +'.');
      }
    }
    return true;
  },
  'checkMissingOrWrongKeys': function (envConfig, schema, prefix) {
    //For friendly output
    if (!prefix) { prefix = ''; }
    let schemaKey, envKey, schemaVal, envVal, isOptional, isPresent;
    let prefixedEnvKey, schemaType, envType, isArr, isObj;

    for (schemaKey in schema) { //check each schema config key
      envKey = schemaKey.substr(2);
      schemaVal = schema[schemaKey];
      envVal = envConfig[envKey];

      isOptional = schemaKey.substr(0, 1) == '?';
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
        _.checkMissingOrWrongKeys(envVal, schemaVal, prefixedEnvKey +'.');
      }
    }
    return true;
  },

 'supermerge': function (o1, o2) { let r = {}, k, v;
    for (k in o1) { r[k] = o1[k]; }
    for (k in o2) { v = o2[k];
      if (o1[k] && o1[k].constructor === Object && v.constructor === Object) {
        r[k] = _.supermerge(o1[k], v); //array + array = merge
      } else { r[k] = v; } //other combination = override
    } return r;
  },

  'loadReference': function (filename) {
    if (path.extname(filename) == '') { filename += '.json'; }
    return JSON.parse(fs.readFileSync(filename, "utf8"));
  }
};

let publicFuncs = {
  '_reset': function () { //reset autoInstance and cache. mostly for unit tests
    defaultEnvID = null;
    magicInstance = null;
    instancesCache = {};
  },

  'getDefaultEnvID': function () {
    if (defaultEnvID) { return defaultEnvID; }

    let fileList = fs.readdirSync(_.envsPath);

    let envConfig;
    let envID = false;
    fileList.some((currentFile) => {
      if (path.extname(currentFile) != '.json') { return false; }

      try {
        envConfig = _.loadReference(_.getConfigFilePath(currentFile));
      } catch (err) {
        if (SyntaxError && err instanceof SyntaxError) {
          //ignore syntax errors when searching for default file
          return false;
        }
        throw err;
      }
      if (envConfig.path == _.rootPath) {
        envID = currentFile;
        return true;
      }
    });
    return (defaultEnvID = envID);
  },
  'load': function (envID, forceNew) {
    if (!envID) { envID = ''; }
    if (!forceNew && instancesCache[envID]) { return instancesCache[envID]; }

    let saveAsDefault = false;
    if (envID == '') {
      saveAsDefault = true;
      envID = publicFuncs.getDefaultEnvID();
      if (!envID) { return false; }
    }
    let autoEnvConfigInstance = new AutoEnvConfig(envID);
    if (saveAsDefault) {
      instancesCache[''] = autoEnvConfigInstance;
    }
    if (!forceNew) {
      instancesCache[envID] = autoEnvConfigInstance;
    }
    _.ensureMagicInstance(autoEnvConfigInstance);
    return autoEnvConfigInstance;
  },

  'has': function (key) { _.ensureMagicInstance();
    return magicInstance.has(key);
  },
  'get': function (key, def) {
    _.ensureMagicInstance();
    return magicInstance.get(key, def);
  }
};


class AutoEnvConfig {
  load(file) { return publicFuncs.load(file); }

  constructor(id) {
    this.id = id;
    let currentEnvFile;
    try {
      currentEnvFile = _.loadReference(_.getConfigFilePath(id));
    } catch (err) {
      if (SyntaxError && err instanceof SyntaxError) {
        throw new Error(
          'There is a syntax error in your config file "'+ id +'": '+
          '"'+ err.message +'". Please fix it and try again.'
        );
      }
      throw err;
    }

    let schema = _.getSchema();
    let defaultData = _.getCleanSchema(schema);
    _.validateConfig(schema, currentEnvFile);
    this.currentConfig = _.supermerge(defaultData, currentEnvFile);
  }

  has(key) {
    let toRet = this.currentConfig;
    let parts = key.split('.');
    let i, cur;
    for (i in parts) {
      cur = parts[i];
      toRet = toRet[cur];
      if (typeof(toRet) == 'undefined') {
        return false;
      }
    }
    return true;
  }
  get(key, def) {
    let toRet = this.currentConfig;
    let parts = key.split('.');
    let i, cur;
    for (i in parts) {
      cur = parts[i];
      toRet = toRet[cur];
      if (typeof(toRet) == 'undefined') {
        if (typeof(def) != 'undefined') { return def; }
        throw new Error(
          'Can\'t find key "'+ key +'" on current env config ("'+ this.id +'") and there was no default on function call!'
        );
      }
    }
    return toRet;
  }
}

module.exports = publicFuncs;