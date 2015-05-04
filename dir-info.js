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

dirInfo.summaryTexts = {
    is:{
        github:'h',
        git:'g',
        svn:'s',
        multilang:'m',
        "package.json":'p',
        json:'j',
        other:'',
        unknown:'?'
    },
    status:{
        changed:'C',
        unstaged:'U',
        ignored:'i',
        error:'E', // for json & package.json
        ok:'',
        unknown:'?',
    },
    server:{
        outdated:'O',
        ok:'',
        unknown:'?',
    }
}

dirInfo.getInfo = function getInfo(path, opts){
    return Promise.resolve().then(function(){
        return {
            dir:path, // BAD! only the last dirname
            is:'unknown',
            status:'unknown',
            server:'unknown'
        };
    });
}

exports = module.exports = dirInfo;