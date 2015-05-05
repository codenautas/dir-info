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
        other:''
    },
    status:{
        error:'E', // for json & package.json
        changed:'C',
        unstaged:'U',
        ignored:'i',
        outdated:'O', // only for multilang
        ok:''
    },
    server:{
        outdated:'O',
        ok:''
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
    var paths;
    return Promise.resolve().then(function() {
        paths=[
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
        return fs.readJson('./package.json');
    }).then(function(json){
        if(json.config && json.config.gitDir) {
            paths.unshift(json.config.gitDir);
        }
        if(process.env.GITDIR) {
            paths.unshift(process.env.GITDIR);
        }
        //console.log("paths", paths);
        return paths.reduce(function(promiseChain, path){
            return promiseChain.catch(function(){
                return fs.stat(path).then(function(stat){
                    if(stat.isDirectory()){
                        return path;
                    }else{
                        return Promise.reject('not dir');
                    }
                });
            });
        },Promise.reject());
    });
};

dirInfo.getInfo = function getInfo(path, opts){
    opts = opts || {};
    var info={
        name:Path.basename(path), // BAD! only the last dirname
        is:'other',
        status:null,
        server:null,
        origin:null
    };
    var gitDir='';
    var execOptions = {};
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
        execOptions.cwd = path;
        execOptions.env = {PATH: gitDir};
        return exec('git status', execOptions);
    }).then(function(res) {
        info.is = "git";
        if(opts.cmd) { return exec('git config --get remote.origin.url', execOptions);  }
        return Promise.resolve(info);
    }).then(function(res) {
        if(res.stdout.match(/github/)) { info.is = "github"; }
    }).catch(function (err) {
        // last git command returns 1 if remote.origin.url is not defined, but that is not an error!
    }).then(function() {
        return Promise.resolve(info);
    });
};

exports = module.exports = dirInfo;