# dir-info
Put data into tables

![designing](https://img.shields.io/badge/stability-desgining-red.svg)
[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Linux Build][travis-image]][travis-url]
[![Windows Build][appveyor-image]][appveyor-url]
[![Test Coverage][coveralls-image]][coveralls-url]
[![climate](https://img.shields.io/codeclimate/github/codenautas/dir-info.svg)](https://codeclimate.com/github/codenautas/dir-info)

## Install

```sh
$ npm install dir-info
```

## API

```js
var dirInfo = require('dir-info');

var info = dirInfo.getInfo('/home/user/devel/my-module');

console.log(info);
```

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/dir-info.svg?style=flat
[npm-url]: https://npmjs.org/package/dir-info
[travis-image]: https://img.shields.io/travis/codenautas/dir-info/master.svg?label=linux&style=flat
[travis-url]: https://travis-ci.org/codenautas/dir-info
[appveyor-image]: https://img.shields.io/appveyor/ci/emilioplatzer/dir-info/master.svg?label=windows&style=flat
[appveyor-url]: https://ci.appveyor.com/project/emilioplatzer/dir-info
[coveralls-image]: https://img.shields.io/coveralls/codenautas/dir-info/master.svg?style=flat
[coveralls-url]: https://coveralls.io/r/codenautas/dir-info
[downloads-image]: https://img.shields.io/npm/dm/dir-info.svg?style=flat
[downloads-url]: https://npmjs.org/package/dir-info
