/* global before, afterEach, after, describe, it */
'use strict';

const
  rewire = require('rewire')
, expect = require('chai').expect
, sinon = require('sinon')
;



//### Module to be tested
let AutoEnvConfig = rewire('../lib/AutoEnvConfig.js');



//### Setup, mocks and cleanup
const
  fs = require('fs')
, path = require('path');

let
  sandbox,
  AutoEnvConfigClass
;

let leftoverFiles = [], replaceFiles = {};

//# Setup
before(() => {
  let mockRootPath = __dirname;
  let mockSearchPath = path.resolve(mockRootPath, 'envs');

  let _ = AutoEnvConfig.__get__('_');
  AutoEnvConfigClass = AutoEnvConfig.__get__('AutoEnvConfig');
  _.rootPath = mockRootPath; //override search path
  _.envsPath = mockSearchPath; //override search path

  sandbox = sinon.sandbox.create();

  //This stub allows us to force loading of specific files with special
  //configurations without changing this module's code for consistent testing.
  let origReadFileSync = fs.readFileSync;

  let stubbedReadFileSync = function (filepath, encoding) {
    let pathparts = filepath.split(path.sep);
    let filename = pathparts.pop();
    if (replaceFiles[filename]) { //use invalid or different files for tests
      filename = replaceFiles[filename];
    }
    pathparts.push(filename);
    filepath = pathparts.join(path.sep);

    let content = origReadFileSync(filepath, encoding);

    //if it's the right file, let's replace the path to the current one
    if (filename == 'magic.json') {
      content = content.replace('%curpath%', JSON.stringify(mockRootPath));
    }
    return content;
  };
  sandbox.stub(fs, 'readFileSync').callsFake(stubbedReadFileSync);
});

//# Reset on each test
afterEach(() => {
  //clear replace files list
  replaceFiles = {};
  //remove leftovers
  leftoverFiles.forEach((file) => fs.unlinkSync(file));
  leftoverFiles = [];
  //reset all internal state
  AutoEnvConfig._reset();
});

//# Cleanup
after(() => {
  sandbox.restore();
});



//### Tests :)
describe('Load Error Handling', function() {
  it('throws exception when no ".schema" is present', function () {
    replaceFiles = {'config.schema': 'dontexist.schema'};
    let expectedErrMessage = 'There is no "config.schema" file in your envs folder!';
    expect(AutoEnvConfig.load).to.throw(expectedErrMessage);
  });

  it('throws exception when ".schema" is invalid (parse error)', function () {
    replaceFiles = {'config.schema': 'config_parseError.schema'};
    let expectedErrMessage = 'There is a syntax error in your schema file ';
    expect(AutoEnvConfig.load).to.throw(expectedErrMessage);
  });

  it('throw exception when ".schema" have keys without required prefix', function () {
    replaceFiles = {'config.schema': 'config_noprefix.schema'};
    let expectedErrMessage = 'Schema key "deep.key.supported" doesn\'t have a required prefix!';
    expect(AutoEnvConfig.load).to.throw(expectedErrMessage);
  });

  it('throws exception when "env.conf" is invalid (parse error)', function () {
    let fn = function () { AutoEnvConfig.load('env_parseError.json'); };
    let expectedErrMessage = 'There is a syntax error in your config file';
    expect(fn).to.throw(expectedErrMessage);
  });

  it('throws exception when "env.conf" have properties not present in ".schema"', function () {
    let fn = function () { AutoEnvConfig.load('env_unexpectedProperty.json'); };
    let expectedErrMessage = 'Unexpected key "deep.key.unexpected" in current env config.';
    expect(fn).to.throw(expectedErrMessage);
  });

  it('throws exception when "env.conf" does not have some required property', function () {
    let fn = function () { AutoEnvConfig.load('env_missingProperty.json'); };
    let expectedErrMessage = 'Required key "deep.key.supported" missing from your current env config!';
    expect(fn).to.throw(expectedErrMessage);
  });

  it('throws exception when "env.conf" have a property with a type that does not match schema', function () {
    let fn = function () { AutoEnvConfig.load('env_typeMismatch.json'); };
    let expectedErrMessage = 'Env config key "deep.key" must be of type "object" ("string" found)';
    expect(fn).to.throw(expectedErrMessage);
  });

  it('"module.load" returns false when there is no matching env path', function () {
    replaceFiles = {'magic.json': 'env1.json'};
    let magicInstance = AutoEnvConfig.load();
    expect(magicInstance).to.be.false;
  });

  it('"module.load" should use "defaultEnvID" cache even with "forceNew" flag', function () {
    var readdirSyncSpy = sinon.spy(fs, 'readdirSync');
    AutoEnvConfig.load('', 'forceNew');
    AutoEnvConfig.load('', 'forceNew');
    AutoEnvConfig.load('', 'forceNew');
    AutoEnvConfig.load();
    readdirSyncSpy.restore();
    expect(readdirSyncSpy.callCount).to.be.equal(1);
  });

  it('throws exception when it cannot create persistence file', function () {
    let fn = function () {
      AutoEnvConfig.enablePersistence();
      AutoEnvConfig.load('env_persist_cantCreate');
    };
    let expectedErrMessage = 'The persistence file "/invalid/path.json" does not exists and could not be created';
    expect(fn).to.throw(expectedErrMessage);
  });

  it('throws exception when the persistence file content is invalid', function () {
    let fn = function () {
      AutoEnvConfig.enablePersistence();
      AutoEnvConfig.load('env_persist_invalid');
    };
    let expectedErrMessage = 'There is a syntax error in your persistence file';
    expect(fn).to.throw(expectedErrMessage);
  });
});


describe('Specific Loading', function() {
  it('"module.load(name)" should load <name>', function () {
    let specificInstance = AutoEnvConfig.load('env1');
    let specificKey      = specificInstance.get('requiredKey');
    expect(specificInstance).to.be.instanceof(AutoEnvConfigClass);
    expect(specificKey).to.be.equal('value1');
  });

  it('"module.load(name.json)" should load <name>', function () {
    let specificInstance = AutoEnvConfig.load('env1.json');
    let specificKey      = specificInstance.get('requiredKey');
    expect(specificInstance).to.be.instanceof(AutoEnvConfigClass);
    expect(specificKey).to.be.equal('value1');
  });

  it('"instance.load(name)" should load <name>', function () {
    let specificInstance1 = AutoEnvConfig.load('env1');
    let specificKey1      = specificInstance1.get('requiredKey');
    let specificInstance2 = specificInstance1.load('env2');
    let specificKey2      = specificInstance2.get('requiredKey');
    expect(specificInstance1).to.be.instanceof(AutoEnvConfigClass);
    expect(specificInstance2).to.be.instanceof(AutoEnvConfigClass);
    expect(specificInstance1).to.not.be.equal(specificInstance2);
    expect(specificKey1).to.be.equal('value1');
    expect(specificKey2).to.be.equal('value2');
  });
});


describe('Singleton-by-default behavior', function() {
  it('will reuse the same instance by default', function () {
    let specificInstance = AutoEnvConfig.load('env1');
    let specificKey = specificInstance.get('requiredKey');
    expect(specificKey).to.be.equal('value1');
    //replace in-memory
    specificInstance.set('requiredKey', 'set_by_code');
    specificKey = specificInstance.get('requiredKey');
    expect(specificKey).to.be.equal('set_by_code');
    //load. internall cache should return the same instance
    let specificInstanceCopy = AutoEnvConfig.load('env1');
    let specificKeyCopy = specificInstanceCopy.get('requiredKey');
    expect(specificKeyCopy).to.be.equal('set_by_code');
  });

  it('will reuse the same instance when two IDs resolve to the same env file', function () {
    let specificInstance = AutoEnvConfig.load('env1');
    let specificKey = specificInstance.get('requiredKey');
    expect(specificKey).to.be.equal('value1');
    specificInstance.set('requiredKey', 'set_by_code');
    let specificInstanceCopy = AutoEnvConfig.load('env1.json');
    let specificKeyCopy = specificInstanceCopy.get('requiredKey');
    expect(specificKeyCopy).to.be.equal('set_by_code');
  });

  it('will use a new instance if "forceNew" flag is passed to "load" method', function () {
    let specificInstance = AutoEnvConfig.load('env1');
    let specificKey = specificInstance.get('requiredKey');
    expect(specificKey).to.be.equal('value1');
    specificInstance.set('requiredKey', 'set_by_code');
    specificKey = specificInstance.get('requiredKey');
    expect(specificKey).to.be.equal('set_by_code');
    let specificInstanceCopy = AutoEnvConfig.load('env1', 'forceNew');
    let specificKeyCopy = specificInstanceCopy.get('requiredKey');
    expect(specificKeyCopy).to.be.equal('value1');
  });

  it('will use a new instance if "forceNew" flag is passed to "load" method when two IDs resolve to the same env file', function () {
    let specificInstance = AutoEnvConfig.load('env1');
    let specificKey = specificInstance.get('requiredKey');
    expect(specificKey).to.be.equal('value1');
    specificInstance.set('requiredKey', 'set_by_code');
    specificKey = specificInstance.get('requiredKey');
    expect(specificKey).to.be.equal('set_by_code');
    let specificInstanceCopy = AutoEnvConfig.load('env1.json', 'forceNew');
    let specificKeyCopy = specificInstanceCopy.get('requiredKey');
    expect(specificKeyCopy).to.be.equal('value1');
  });
});


describe('Magic Loading', function() {
  it('"module.load()" should use <default>', function () {
    let magicInstance = AutoEnvConfig.load();
    let magicKey      = magicInstance.get('requiredKey');
    expect(magicInstance).to.be.instanceof(AutoEnvConfigClass);
    expect(magicKey).to.be.equal('magic');
  });

  it('"module.load()" ID should not include ".json"', function () {
    let magicInstance = AutoEnvConfig.load();
    expect(magicInstance.id).to.be.equal('magic');
  });

  it('"module.get" should use <default>', function () {
    let magicKey = AutoEnvConfig.get('requiredKey');
    expect(magicKey).to.be.equal('magic');
  });

  it('"module.load()" should use <default> even after "module.load(name)"', function () {
    let specificInstance = AutoEnvConfig.load('env1');
    let specificKey      = specificInstance.get('requiredKey');
    let magicInstance    = AutoEnvConfig.load();
    let magicKey         = magicInstance.get('requiredKey');
    expect(magicInstance).to.be.instanceof(AutoEnvConfigClass);
    expect(specificInstance).to.be.instanceof(AutoEnvConfigClass);
    expect(magicInstance).to.not.be.equal(specificInstance);
    expect(specificKey).to.be.equal('value1');
    expect(magicKey).to.be.equal('magic');
  });

  it('"module.get" should use <name> after "module.load(name)"', function () {
    let specificInstance = AutoEnvConfig.load('env1');
    let magicKey         = AutoEnvConfig.get("requiredKey");
    expect(specificInstance).to.be.instanceof(AutoEnvConfigClass);
    expect(magicKey).to.be.equal('value1');
  });
});


describe('Instance Load and Magic Load equivalence', function() {
  it('"module.load()" object should be the same as "module.load(defaultEnv)" object', function () {
    let magicInstance    = AutoEnvConfig.load();
    let specificInstance = AutoEnvConfig.load('magic');
    expect(magicInstance).to.be.equal(specificInstance);
  });
  it('"module.has" should be the same as "instance.has"', function () {
    let magicInstance    = AutoEnvConfig.load();
    let specificInstance = AutoEnvConfig.load('env1');
    expect(magicInstance).to.not.be.equal(specificInstance);
    expect(magicInstance.has).to.be.equal(specificInstance.has);
  });
  it('"module.get" should be the same as "instance.get"', function () {
    let magicInstance    = AutoEnvConfig.load();
    let specificInstance = AutoEnvConfig.load('env1');
    expect(magicInstance).to.not.be.equal(specificInstance);
    expect(magicInstance.get).to.be.equal(specificInstance.get);
  });
  it('"module.set" should be the same as "instance.set"', function () {
    let magicInstance    = AutoEnvConfig.load();
    let specificInstance = AutoEnvConfig.load('env1');
    expect(magicInstance).to.not.be.equal(specificInstance);
    expect(magicInstance.set).to.be.equal(specificInstance.set);
  });
  it('"module.persist" should be the same as "instance.persist"', function () {
    let magicInstance    = AutoEnvConfig.load();
    let specificInstance = AutoEnvConfig.load('env1');
    expect(magicInstance).to.not.be.equal(specificInstance);
    expect(magicInstance.persist).to.be.equal(specificInstance.persist);
  });
});


describe('Methods', function() {
  it('"module.has(key)" should return true when key is present', function () {
    let hasMagicKey = AutoEnvConfig.has('requiredKey');
    expect(hasMagicKey).to.be.true;
  });
  it('"module.has(key)" should return false when key is not present', function () {
    let hasMagicKey = AutoEnvConfig.has('nonexistentKey');
    expect(hasMagicKey).to.be.false;
  });
  it('"module.get(key)" should return value when key is present', function () {
    let magicKey = AutoEnvConfig.get('requiredKey');
    expect(magicKey).to.be.equal('magic');
  });
  it('"module.get(key)" should throw when key is not present', function () {
    let fn = function () { AutoEnvConfig.get('nonexistentKey'); };
    expect(fn).to.throw('Can\'t find key "nonexistentKey" on current env config ("magic") and there was no default on function call!');
  });
  it('"module.get(key, default)" should return "key value" even when _default_ is supplied if _key_ is present', function () {
    let magicKey = AutoEnvConfig.get('requiredKey', 'defaultValue');
    expect(magicKey).to.be.equal('magic');
  });
  it('"module.get(key, default)" should return "default" when it is supplied and _key_ is not present', function () {
    let magicKey = AutoEnvConfig.get('nonexistentKey', 'defaultValue');
    expect(magicKey).to.be.equal('defaultValue');
  });
  it('"module.set(key, value)" should update the value when _key_ exists', function () {
    AutoEnvConfig.set('requiredKey', 'updated');
    let magicKey = AutoEnvConfig.get('requiredKey');
    expect(magicKey).to.be.equal('updated');
  });
  it('"module.set(key, value)" should update the value of deep keys when _key_ exists', function () {
    AutoEnvConfig.set('deep.key.supported', 'updated');
    let magicKey = AutoEnvConfig.get('deep.key.supported');
    expect(magicKey).to.be.equal('updated');
  });
  it('"module.set(key, value)" should throw when _value_ type mismatch', function () {
    let fn = function () { AutoEnvConfig.set('deep.key', 'updated'); };
    expect(fn).to.throw('Env config key "deep.key" must be of type "object" ("string" received)');
  });
  it('"module.set(key, value)" should throw when _key_ is not present in schema', function () {
    let fn = function () { AutoEnvConfig.set('nonexistentKey'); };
    expect(fn).to.throw('Can\'t find key "nonexistentKey" on current env config ("magic").');
  });
  it('"module.persist(key, value)" should throw when called in a disabled persistence setting', function () {
    let fn = function () {
      AutoEnvConfig.set('requiredKey', 'ok');
      AutoEnvConfig.persist('requiredKey', 'fail');
    };
    expect(fn).to.throw('The current instance of AutoEnvConfig was not set to have persistence activated!');
  });
  it('"instance.persist(key, value)" should throw when called in an instance created with persistence but disabled later on', function () {
    let fn = function () {
      AutoEnvConfig.enablePersistence();
      let specificInstance = AutoEnvConfig.load('env1');
      specificInstance.set('requiredKey', 'ok');
      specificInstance.persist('requiredKey', 'ok');
      specificInstance.disablePersistence();
      specificInstance.persist('requiredKey', 'fail');
    };
    expect(fn).to.throw('The current instance of AutoEnvConfig was not set to have persistence activated!');
    leftoverFiles = ['test/envs/env1.persist.json'];
  });
});


describe('Persistence Files', function() {
  it('create a persistence file in default location when persistence is enabled and no special settings are in place', function () {
    AutoEnvConfig.enablePersistence();
    AutoEnvConfig.load('env1');
    expect(fs.readFileSync('test/envs/env1.persist.json').toString()).to.be.equal('{}');
    leftoverFiles = ['test/envs/env1.persist.json'];
  });

  it('create a persistence file in the specified location when persistence is enabled with a specific path', function () {
    AutoEnvConfig.enablePersistence();
    AutoEnvConfig.load('env_persist_specific');
    expect(fs.readFileSync('specificPath.persist.json').toString()).to.be.equal('{}');
    leftoverFiles = ['specificPath.persist.json'];
  });

  it('NOT create a persistence file when persistence is disabled', function () {
    AutoEnvConfig.load('env1');
    expect(fs.existsSync('test/envs/env1.persist.json')).to.be.false;
  });
});


describe('Global and Instance Persistence settings', function() {
  it('disabling persistence on global setting should also disable it on Magic Instance', function () {
    let fn = function () {
      AutoEnvConfig.enablePersistence();
      AutoEnvConfig.set('requiredKey', 'ok');
      AutoEnvConfig.persist('requiredKey', 'ok');
      //disabled globally. also disabled it on magic instance.
      AutoEnvConfig.disablePersistence();
      AutoEnvConfig.persist('requiredKey', 'ok');
    };
    expect(fn).to.throw('The current instance of AutoEnvConfig was not set to have persistence activated!');
    leftoverFiles = ['test/envs/magic.persist.json'];
  });

  it('you can also disable global persistence setting without affecting Magic Instance', function () {
    let fn = function () {
      AutoEnvConfig.enablePersistence();
      AutoEnvConfig.set('requiredKey', 'ok');
      AutoEnvConfig.persist('requiredKey', 'ok');
      AutoEnvConfig.disablePersistence(false);
      AutoEnvConfig.persist('requiredKey', 'ok');
    };
    expect(fn).to.not.throw();
    leftoverFiles = ['test/envs/magic.persist.json'];
  });

  it('do NOT load persisted data when persistence is disabled', function () {
    AutoEnvConfig.load('env_persist_existing');
    let specificKey = AutoEnvConfig.get('requiredKey');
    expect(specificKey).to.be.equal('not_loaded');
  });

  it('load persisted data on load when persistence is globally enabled', function () {
    AutoEnvConfig.enablePersistence();
    AutoEnvConfig.load('env_persist_existing');
    let specificKey = AutoEnvConfig.get('requiredKey');
    expect(specificKey).to.be.equal('loaded_from_persistence');
  });

  it('load persisted data when persistence is enabled only later in the code execution', function () {
    AutoEnvConfig.load('env_persist_existing');
    let specificKey = AutoEnvConfig.get('requiredKey');
    expect(specificKey).to.be.equal('not_loaded');
    //now enable persistence and retry
    AutoEnvConfig.enablePersistence();
    specificKey = AutoEnvConfig.get('requiredKey');
    expect(specificKey).to.be.equal('loaded_from_persistence');
  });

  it('enable persistence in an instance without overwriting current in-memory config', function () {
    let specificInstance = AutoEnvConfig.load('env_persist_existing');
    specificInstance.enablePersistence(); //overwrite
    let specificKey = specificInstance.get('requiredKey');
    expect(specificKey).to.be.equal('loaded_from_persistence');
    //load new instance and enable persistence without override
    let specificInstanceCopy = AutoEnvConfig.load('env_persist_existing', 'forceNew');
    specificInstanceCopy.enablePersistence(120, false); //don't overwrite
    let specificKeyCopy = specificInstanceCopy.get('requiredKey');
    expect(specificKeyCopy).to.be.equal('not_loaded');
  });

  it('do NOT persist data when using "set" method even with persistence enabled', function () {
    AutoEnvConfig.enablePersistence();
    let specificInstance = AutoEnvConfig.load('env_persist_existing');
    //check low level implementation as well.
    var internalWriteCall = sinon.spy(specificInstance.eventualPersistence, '_writeToDisk');
    let specificKey = specificInstance.get('requiredKey');
    expect(specificInstance.get('requiredKey')).to.be.equal('loaded_from_persistence');
    //persistence activated, but replace in-memory only!
    specificInstance.set('requiredKey', 'replaced_by_code');
    //check that the in-memory value was changed
    specificKey = specificInstance.get('requiredKey');
    expect(specificKey).to.be.equal('replaced_by_code');
    //check number of calls to persist the file
    internalWriteCall.restore();
    expect(internalWriteCall.callCount).to.be.equal(0);
    //load new instance, which will re-read the persistence data
    let specificInstanceCopy = AutoEnvConfig.load('env_persist_existing', 'forceNew');
    specificInstanceCopy.enablePersistence(120, false); //don't overwrite
    let specificKeyCopy = specificInstanceCopy.get('requiredKey');
    //it should not be changed!
    expect(specificKeyCopy).to.be.equal('loaded_from_persistence');
  });
});
