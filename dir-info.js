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

dirInfo.findGitPath = function findGitPath() {
    var paths=[
        'c:\\Git\\bin',
        'c:\\Archivos de programa\\Git\\bin',
        'c:\\Program Files\\Git\\bin',
        'c:\\Program Files (x86)\\Git\\bin',
        '/usr/bin',
        '/usr/local/bin',
        '/bin'
    ];
    var foundedGit = '';
    return Promise.resolve().then(function() {
        return Promise.all(paths.map(function(gitPath) {
            return fs.exists(gitPath).then(function(exists) {
                if(exists) { return fs.stat(gitPath); }
                return Promise.resolve({ isDirectory:function() { return false;} });
            }).then(function(stat) {
                if(stat.isDirectory()) { foundedGit = gitPath; }
            });
        })).then(function() {
            return Promise.resolve(foundedGit);
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
        // add git to process' PATH
        return dirInfo.findGitPath();
    }).then(function(gitPath) {
        if(""===gitPath) { throw new Error("Could not find git"); }
        process.env.PATH += Path.delimiter + gitPath;
        process.chdir(path);
        return exec('git status');
    }).then(function(res) {
        //console.log("git status", res);
        info.is = "git";
        return exec('git config --get remote.origin.url')
    }).then(function(res) {
        //console.log("git config", res);
        if(res.stdout.match(/github/)) { info.is = "github"; }
    }).catch(function (err) {
        // last git command returns 1 if remote.origin.url is not defined, but that is not an error!
    }).then(function() {
        process.chdir(currentDir); // restore current dir
        return Promise.resolve(info);
    });
};

exports = module.exports = dirInfo;