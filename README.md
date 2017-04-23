autoenvconfig
=============
### Environment config that Just Works™!

Stop worrying about the hassle of **loading environment config files everywhere**, **config files with missing entries** or **schemas that gets old when you forget to add a new config key to it**.

**AutoEnvConfig** is a fully-tested no-nonsense no-dependencies package to help you keep your ever expanding project under control.

**AutoEnvConfig** was designed with simple but very powerful goals:

* **Blazingly fast**: it caches everything it can, loads your files only once and check your schema on load, not on usage;
* **No extra configuration needed**: this package follows the idea of _convention over configuration_, so it keeps the required environment files to a minimum and there is nothing to thinker with before start using it;
* **Never out of sync**: when loading the environment configuration file, it checks the schema for *missing AND for extra keys*, alerting you when you are missing some key in your config or in your schema file;
* **Auto load the right config file**: you can set the root path of the project in the environment config file and it will load automatically.

Simply create your [schema file](#sampleschema) specifying optional and required keys (plus: it can contain default values, too!), setup an [environment file](#sampleenv) with optional specific overrides and you're good to go!

Check out the [Installation Instructions](#installation), [Quick Start Guide](#quickstart), [Conventions](#conventions) and the [Public Methods API](#methods).


## <a id="installation">Installation</a>
The simplest way to install this package is using [npm](http://www.npmjs.com/):
```bash
$ npm i -S AutoEnvConfig
```

You can also manually download the [latest release](https://github.com/dnunes/autoenvconfig/zipball/master) from [our project page](http://dnunes.com/autoenvconfig/) or any release from [our GitHub repository](https://github.com/dnunes/autoenvconfig/) on the [releases page](https://github.com/dnunes/autoenvconfig/releases/).


## <a id="quickstart">Quick Start Guide</a>

There are just four steps needed to start using this package:

1. Create a folder named `envs` on your project's root;
2. Create a [`config.schema`](#sampleschema) file with your schema;
3. Create a [`ENVNAME.json`](#sampleenv) file for each environment with its specific configuration (where `ENVNAME` is whatever name you wish to use);
4. Load the package. It is ready to read your config.

In your code:

```javascript
const AutoEnvConfig = require('autoenvconfig');

let isValuePresent = AutoEnvConfig.has('deep.key.supported'));
if (isValuePresent) {
  let valueFromConfig = AutoEnvConfig.get('deep.key.supported'));
  console.log(valueFromConfig); //"myValue"
}
```

## <a id="conventions">Conventions</a>

### <a id="magicload">Magic Loading</a>

One of the nicest features of the package is that you don't need to specify the environment, as it will magicly detect and load the correct file based on some values. This auto generated instance is called [_magic instance_](#magicload).

For the magic load to happen, your [`config.schema`](#sampleschema) and [`ENVNAME.json`](#sampleenv) files must have a "path" key with the path of your project's root. It will find the correct environment checking this value by default. You can, however, safely ignore this convention and manually specify the file name.

### <a id="magicload">Schema and Environment File formats</a>
The schema and environment config files are simple JSON files. The only limit for the _keys_ is the dot character ("`.`") which is forbidden (because it is used as a separator when loading), but I suggest you to limit your keys to alphanumeric chars for simplicity.

In the schema files, every key _MUST_ be prefixed with either `#` or `?`, indicating mandatory or optional key, respectively.


## <a id="samples">Sample Files</a>

### <a id="sampleschema">Sample config.schema</a>
```json
{
  "# id": "",
  "# envtype": "",
  "# path": "",

  "# requiredKey": "",
  "? deep": {
    "? key": {
      "# supported": "myValue",
      "? asWell": "otherValue"
    }
  }
}
```

You can have a required key inside an optional object (in this sample, the `supported` required key is inside optional `deep` and `key` objects), so that you can omit the whole object (it will use the defaults), but if it exists in the environment config file, it must include at least these required keys.

### <a id="sampleenv">Sample ENVNAME.json</a>
```json
{
  "id": "dev",
  "envtype": "local",
  "path": "/home/dnunes/code/node/autoenvconfig",

  "requiredKey": "value"
}
```


## <a id="methods">Methods</a>

All the methods can be called in a specific instance (from a `AutoEnvConfig.load` call) or in the [_magic instance_](#magicload). You can save a reference for the [_magic instance_](#magicload) using a `AutoEnvConfig.load()` call and call methods on this instance as well and it will work exactly the same as calling the methods directly on the package.

### <a id="magicmethods">Magic Methods</a>

- <a id="mautoload">`AutoEnvConfig.load([<envName>])`</a>
This method will return a new instance of `AutoEnvConfig` class (actually, prototype). If you ommit the `<envName>` parameter, it will try to [_magic load_](#magicload) it. If you pass the `<envName>` parameter, it will just return the config for the specified env. It returns false if it cannot find an environment config.

- <a id="mautoget">`AutoEnvConfig.get(<key>[, <defaultValueIfNotPresent>])`</a>
This method will return the value of `<key>` in the [_magic instance_](#magicload). If `key` is not present in the [_magic instance_](#magicload), it will either return `<defaultValueIfNotPresent>` or throw an error if there the default value parameter was committed.

- <a id="mautohas">`AutoEnvConfig.has(<key>)`</a>
This method will return boolean `true` if the `<key>` is present in the [_magic instance_](#magicload) or boolean `false` if not.

- <a id="mautoset">`AutoEnvConfig.set(<key>, <value>)`</a>
This method will replace the contents of `<key>` for the [_magic instance_](#magicload) with `<value>`;


### <a id="instancemethods">Instance Methods</a>

- <a id="minsload">`<Instance>.load([<envName>])`</a>
This method will return a new instance of `AutoEnvConfig` class (actually, prototype). If you ommit the `<envName>` parameter, it will try to [_magic load_](#magicload) it. If you pass the `<envName>` parameter, it will just return the config for the specified env. It returns false if it cannot find an environment config.

- <a id="minsget">`<Instance>.get(<key>[, <defaultValueIfNotPresent>])`</a>
This method will return the value of `<key>` in the `<Instance>` object. If `<key>` is not present in the `<Instance>` object, it will either return `<defaultValueIfNotPresent>` or throw an error if there the default value parameter was committed.

-  <a id="minshas">`<Instance>.has(<key>)`</a>
This method will return boolean `true` if the `<key>` is present in the `<Instance>` object or boolean `false` if not.

- <a id="minsset">`<Instance>.set(<key>, <value>)`</a>
This method will replace the  contents of `<key>` for the `<Instance>` object with `<value>`;


## <a id="advancedusage">Advanced Usage</a>

You can override the default file and bypass the environment file search routine by calling the `load` method:
```javascript
//will load envs/other.json
AutoEnvConfig = require('autoenvconfig').load('other');
AutoEnvConfig.get('key.in.other.file');
```

You can also load multiple configs if ever needed:
```javascript
AutoEnvConfig = require('autoenvconfig');

//load the right env based on "path" config value
let rightConfig = AutoEnvConfig.load();
rightConfig.get('key.in.right.file');

//load "envs/other.json"
let otherConfig = AutoEnvConfig.load('other');
otherConfig.get('key.in.other.file');

//load "envs/oneMore.json"
let oneMoreConfig = rightConfig.load('oneMore.json');
oneMoreConfig.get('key.in.onemore.file');
```
Note that you can call `load` directly on the package or on any `AutoEnvConfig` object returned by the `load` method.


## <a id="releaseh">Release History</a>

* [0.1.6](https://github.com/dnunes/autoenvconfig/releases/tag/v0.1.6) Added unit tests for "[set](#mautoset)" methods and finished pending test for internal cache;

* [0.1.5](https://github.com/dnunes/autoenvconfig/releases/tag/v0.1.5) Added "[set](#mautoset)" methods and started improving documentation for API. Missing unit tests on it;

* [0.1.4](https://github.com/dnunes/autoenvconfig/releases/tag/v0.1.4) 100% functions coverage and almost 100% branch coverage;

* [0.1.3](https://github.com/dnunes/autoenvconfig/releases/tag/v0.1.3) Removed "get" aliases, fixed "[instance.get()](#minsget)" and added "[has](#mautohas)" methods;

* [0.1.2](https://github.com/dnunes/autoenvconfig/releases/tag/v0.1.2) Improved syntaxerror handling in schema files;

* [0.1.1](https://github.com/dnunes/autoenvconfig/releases/tag/v0.1.1) Bugfix for using natural expected behavior after [.load('name')](#mautoload);

* [0.1.0](https://github.com/dnunes/autoenvconfig/releases/tag/v0.1.0) Initial release.


## <a id="credits">Credits</a>

Created and maintained (with much ♡) by [diego nunes](http://dnunes.com)

Donations with Bitcoin to _1PQyeHqusUj3SuTmw6DPqWSHptVHkYZ33R_:

![1PQyeHqusUj3SuTmw6DPqWSHptVHkYZ33R](http://chart.apis.google.com/chart?cht=qr&chs=200x200&chl=bitcoin:1PQyeHqusUj3SuTmw6DPqWSHptVHkYZ33R)
