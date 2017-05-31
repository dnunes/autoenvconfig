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
  leftoverFiles.forEach((file) => fs.unlinkSync(file));
  AutoEnvConfig._reset();
  leftoverFiles = [];
  replaceFiles = {};
}); //reset autoInstance and cache

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


describe('Magic Loading', function() {
  it('"module.load()" should use <default>', function () {
    let magicInstance = AutoEnvConfig.load();
    let magicKey      = magicInstance.get('requiredKey');
    expect(magicInstance).to.be.instanceof(AutoEnvConfigClass);
    expect(magicKey).to.be.equal('magic');
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
  it('magic "module.has(key)" should return true when key is present', function () {
    let hasMagicKey = AutoEnvConfig.has('requiredKey');
    expect(hasMagicKey).to.be.true;
  });
  it('magic "module.has(key)" should return false when key is not present', function () {
    let hasMagicKey = AutoEnvConfig.has('nonexistentKey');
    expect(hasMagicKey).to.be.false;
  });
  it('magic "module.get(key)" should return value when key is present', function () {
    let magicKey = AutoEnvConfig.get('requiredKey');
    expect(magicKey).to.be.equal('magic');
  });
  it('magic "module.get(key)" should throw when key is not present', function () {
    let fn = function () { AutoEnvConfig.get('nonexistentKey'); };
    expect(fn).to.throw('Can\'t find key "nonexistentKey" on current env config ("magic.json") and there was no default on function call!');
  });
  it('magic "module.get(key, default)" should return value when default is supplied and key is present', function () {
    let magicKey = AutoEnvConfig.get('requiredKey', 'defaultValue');
    expect(magicKey).to.be.equal('magic');
  });
  it('magic "module.get(key, default)" should return default it is supplied and key is not present', function () {
    let magicKey = AutoEnvConfig.get('nonexistentKey', 'defaultValue');
    expect(magicKey).to.be.equal('defaultValue');
  });
  it('magic "module.set(key, value)" should update the value when the key does exist', function () {
    AutoEnvConfig.set('requiredKey', 'updated');
    let magicKey = AutoEnvConfig.get('requiredKey');
    expect(magicKey).to.be.equal('updated');
  });
  it('magic "module.set(key, value)" should update the value of deep keys when the key does exist', function () {
    AutoEnvConfig.set('deep.key.supported', 'updated');
    let magicKey = AutoEnvConfig.get('deep.key.supported');
    expect(magicKey).to.be.equal('updated');
  });
  it('magic "module.set(key, value)" should throw when new value have different type', function () {
    let fn = function () { AutoEnvConfig.set('deep.key', 'updated'); };
    expect(fn).to.throw('Env config key "deep.key" must be of type "object" ("string" received)');
  });
  it('magic "module.set(key, value)" should throw when a key in not present in schema', function () {
    let fn = function () { AutoEnvConfig.set('nonexistentKey'); };
    expect(fn).to.throw('Can\'t find key "nonexistentKey" on current env config ("magic.json").');
  });
});



describe('Persistence', function() {
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
  });

  //first enable persistence, then disable it and then try ".persist"! It should error out!
  it('throws exception when using ".persist" in the magic instance with disabled persistence', function () {
  });

  it('throws exception when using ".persist" in an instance with disabled persistence', function () {
  });

  it('do NOT load persisted data when persistence is disabled', function () {
  });

  it('do NOT load persisted data when persistence is disabled', function () {
  });

  it('load persisted data when persistence is enabled', function () {
  });

  it('load persisted data when persistence is enabled later in the code execution', function () {
  });

  it('enable persistence without overwriting current settings when persistence is enabled later in the code execution with the right arguments', function () {
  });

  it('do NOT persist data when using "set" method even with persistence enabled', function () {
  });



  //get data from persistence AFTER loading (".enablePersistence")
  //use "set" and not "persist" and then get from persistence (should keep the same value)
  //
});
