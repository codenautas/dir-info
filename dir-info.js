/*!
 * dir-info
 * 2015 Codenautas
 * GNU Licensed
 */

/**
 * Module dependencies.
 */

var Promise = require('promise');
 
var dirInfo = {}; // this module

dirInfo.getInfo = function getInfo(path, opts){
    return Promise.resolve().then(function(){
        return {
            dir:path, // BAD! only the last dirname
            is:{
                git:false,
                github:false,
                svn:false,
            },
            status:null,
            server:null
        };
    });
}

exports = module.exports = dirInfo;