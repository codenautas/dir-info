"use strict";

var dirInfo = require('..');
var memoizee = require('memoizee');
var moment = require('moment');
var Promise = require('best-promise');

var getInfo;

function getInfoAsync(path, opts, callback){
    dirInfo.getInfo(path,opts).then(function(result){
        callback(null, result);
    }).catch(function(err){
        callback(err);
    });
}

function memoizeePromise2a(f){
    var memoized = memoizee(f, { async: true });
    return function(a1, a2){
        var parameters = arguments;
        return new Promise(function(resolve, reject){
            memoized(a1,a2,function(err,res){
                if(err){
                    reject(err);
                }else{
                    resolve(res);
                }
            });
        });
    }
}

// var thePath='../..';
var thePath='c:/hecho/npm/dir-info/package.json';

var opts={cmd:true, net:true};

Promise.resolve().then(function(){
    console.log('sin memo',moment().format());
    return dirInfo.getInfo(thePath,opts);
}).then(function(info){
    console.log('ceropia vez:',info);
    console.log('arranco',moment().format());
    getInfo = memoizeePromise2a(getInfoAsync);
    return getInfo(thePath,opts);
}).then(function(info){
    console.log('primera vez:',info);
    console.log('vamos',moment().format());
    return getInfo(thePath,opts);
}).then(function(info){
    console.log('segunda vez:',info);
    console.log('fin',moment().format());
}).catch(function(err){
    console.log('ERROR',err);
    console.log('STACK',err.stack);
});
