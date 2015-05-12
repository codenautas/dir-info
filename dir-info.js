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
dirInfo.findGitDir = function findGitDir() {
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
    //if(opts.net) { opts.cmd=true; }
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
        if(stat.isDirectory()) {
            gitDir = path+Path.sep+".git";
            return fs.stat(gitDir).then(function(statDotGit){
                return statDotGit.isDirectory();
            }).catch(function(err){
                return false;
            }).then(function(isDirDotGit) {
                if(isDirDotGit){
                    return Promise.resolve().then(function(){
                        info.is='git';
                    }).then(function() {
                        return dirInfo.findGitDir();
                    }).then(function(gitDir) {
                        if(""===gitDir) { throw new Error("Could not find git"); }
                        execOptions.cwd = path;
                        execOptions.env = {PATH: gitDir};
                        return exec('git status', execOptions);
                    }).then(function(res) {
                        info.is = 'git';
                        if(opts.cmd) {
                            return exec('git config --get remote.origin.url', execOptions).catch(function(err){
                                return {errorInExec:true};
                            }).then(function(resRemote) {
                                if(!resRemote.errorInExec){
                                    info.origin=resRemote.stdout.replace(/([\t\r\n ]*)$/g,'');
                                    if(resRemote.stdout.match(/github/)) { info.is = 'github'; }
                                }
                                return res;
                            });
                        }
                        return res;
                    }).then(function(res){
                        var isUntracked=res.stdout.match(/untracked files:/i);
                        var isChanged=res.stdout.match(/modified:/i);
                        if(opts.net && info.is=="github") {
                            if(isChanged) { info.status = 'changed'; }
                            if(isUntracked) { info.server = 'outdated'; }
                        }
                        if(opts.cmd) {
                            info.status = 'ok';
                            if(isChanged) { info.status = 'changed'; }
                            else if(isUntracked) { info.status = 'unstaged'; }
                        }
                        return info;
                    });
                }
                else {
                    if(opts.cmd && info.is==='other') { info.status = 'ok'; }
                }
                return info;
            });
        } else { // it's a file
            info.name = Path.basename(Path.dirname(path))+'/'+Path.basename(path);
            if(path.match(/(package.json)$/i)) { info.is = 'package.json'; }
            else if(path.match(/(\.json)$/i)) { info.is = 'json'; }
            if(info.is.match(/json/) && opts.cmd) {
                return fs.readJson(path).catch(function(err) {
                    info.status = 'error';
                    return {errorInRJS:true};
                }).then(function(json) {
                    if(!json.errorInRJS && opts.cmd) {
                        info.status = 'ok';
                        return exec('node ./node_modules/npm-check-updates/bin/npm-check-updates "'+Path.normalize(path)+'"').catch(function(err) {
                            throw new Error("Cannot find npm-check-updates");
                        }).then(function(npm) {
                            if(opts.net) {
                                info.server = npm.stdout.match(/can be updated/) ? 'outdated' : 'ok';
                            }
                            return info;
                        });
                    }
                    return info;
                });
            }            
            return info;
        }
    });
};

exports = module.exports = dirInfo;