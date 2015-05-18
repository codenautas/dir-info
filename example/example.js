"use strict";

var dirInfo = require('..');
var memoizee = require('memoizee');
var moment = require('moment');
var Promise = require('best-promise');

var getInfo;

// var thePath='../..';
var thePath='c:/hecho/npm/dir-info/package.json';

Promise.resolve().then(function(){
    console.log('sin memo',moment().format());
    return dirInfo.getInfo(thePath,{cmd:true, net:true});
}).then(function(info){
    console.log('ceropia vez:',info);
    console.log('arranco',moment().format());
    getInfo = memoizee(dirInfo.getInfo);
    return getInfo(thePath,{cmd:true, net:true});
}).then(function(info){
    console.log('primera vez:',info);
    console.log('vamos',moment().format());
    return getInfo(thePath,{cmd:true, net:true});
}).then(function(info){
    console.log('segunda vez:',info);
    console.log('fin',moment().format());
}).catch(function(err){
    console.log('ERROR',err);
    console.log('STACK',err.stack);
});
