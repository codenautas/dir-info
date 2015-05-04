/*!
 * dir-info
 * 2015 Codenautas
 * GNU Licensed
 */

/**
 * Module dependencies.
 */

var Promise = require('promise');
var Path = require('path');
var fs = require('fs-promise');
var exec = require('child-process-promise').exec;

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
};

dirInfo.config = { gitDir:false };

/*
    This function will search for the directory containing the git executable
    in this order:
    - dirInfo.config.gitDir
    - config.gitDir in packaje.json
    - GITDIR environment variable
    - A set of predefinded paths
*/
dirInfo.findGitPath = function findGitPath() {
    return Promise.resolve().then(function() {
        var paths=[
            'c:\\Git\\bin',
            'c:\\Archivos de programa\\Git\\bin',
            'c:\\Program Files\\Git\\bin',
            'c:\\Program Files (x86)\\Git\\bin',
            '/usr/bin',
            '/usr/local/bin',
            '/bin'
        ];
        if(dirInfo.config.gitDir) {
            paths.unshift(dirInfo.config.gitDir);
        }
        var json=require('./package.json');
        if(json.config && json.config.gitDir) {
            paths.unshift(json.config.gitDir);
        }
        if(process.env.GITDIR) {
            paths.unshift(process.env.GITDIR);
        }
        //console.log("paths", paths);
        var foundedGitDir = '';
        return Promise.all(paths.map(function(gitDir) {
            return fs.exists(gitDir).then(function(exists) {
                if(exists) { return fs.stat(gitDir); }
                return Promise.resolve({ isDirectory:function() { return false;} });
            }).then(function(stat) {
                //console.log("GIT path", gitDir);
                if(''===foundedGitDir && stat.isDirectory()) { foundedGitDir = gitDir; }
            });
        })).then(function() {
            return Promise.resolve(foundedGitDir);
        });
    });
};

dirInfo.getInfo = function getInfo(path, opts){
    var info={
        dir:path, // BAD! only the last dirname
        is:'unknown',
        status:'unknown',
        server:'unknown'
    };
    var gitDir='';
    var currentDir=process.cwd();
    var netCheck = opts && opts.cmd && true == opts.cmd; // if have to run network tests
    var resolveRestoring = function() {
        process.chdir(currentDir); // restore current dir
        return Promise.resolve(info);
    };

    return Promise.resolve(path).then(function(path){
        if(!path) { throw new Error('null path'); }
        return fs.exists(path);
    }).then(function(exists) {
        if(!exists) { throw new Error("'"+path+"' does not exists"); }
        return fs.stat(path);
    }).then(function(stat) {
        if(false == stat.isDirectory()) { throw new Error("'"+path+"' is not a directory"); }
        gitDir = path+Path.sep+".git";
        return fs.stat(gitDir);
    }).then(function(stat) {
        if(false == stat.isDirectory()) {
            return Promise.resolve(info);
        }
    }).then(function() {
        return dirInfo.findGitPath();
    }).then(function(gitDir) {
        if(""===gitDir) { throw new Error("Could not find git"); }
        process.env.PATH += Path.delimiter + gitDir;
        process.chdir(path);
        return exec('git status');
    }).then(function(res) {
        info.is = "git";
        if(netCheck) { return exec('git config --get remote.origin.url');  }
        return resolveRestoring();
    }).then(function(res) {
        if(res.stdout.match(/github/)) { info.is = "github"; }
    }).catch(function (err) {
        // last git command returns 1 if remote.origin.url is not defined, but that is not an error!
    }).then(function() {
        return resolveRestoring();
    });
};

exports = module.exports = dirInfo;