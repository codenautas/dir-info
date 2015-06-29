/*!
 * dir-info
 * 2015 Codenautas
 * GNU Licensed
 */
"use strict";
/*jshint eqnull:true */
/*jshint globalstrict:true */
/*jshint node:true */
 
var Promises = require('best-promise');
var Path = require('path');
var fs = require('fs-promise');
var exec = require('child-process-promise').exec;

var dirInfo = {}; // this module

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
    return Promises.start(function() {
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
                        return Promises.reject('not dir');
                    }
                });
            });
        },Promises.reject());
    });
};

dirInfo.getInfo = function getInfo(path, opts){
    opts = opts || {};
    //if(opts.net) { opts.cmd=true; }
    var info={
        name:Path.basename(path), // BAD! only the last dirname
        origin:null
    };
    return Promises.start(function(){
        if(!path) { throw new Error('null path'); }
        return fs.exists(path);
    }).then(function(exists) {
        if(!exists) { throw new Error("'"+path+"' does not exists"); }
        return fs.stat(path);
    }).then(function(stat) {
        var gitDir='';
        var execOptions = {};
        if(stat.isDirectory()) {
            gitDir = path+Path.sep+".git";
            return fs.stat(gitDir).then(function(statDotGit){
                return statDotGit.isDirectory();
            }).catch(function(err){
                return false;
            }).then(function(isDirDotGit) {
                if(isDirDotGit){
                    info.isGit = true;
                }
                if(isDirDotGit || true){
                    if(opts.cmd) {
                        return Promises.start(function(){
                            return dirInfo.findGitDir();
                        }).then(function(gitDir) {
                            if(""===gitDir) { throw new Error("Could not find git"); }
                            execOptions.cwd = path;
                            execOptions.env = process.env;
                            execOptions.env.PATH+=Path.delimiter+gitDir;
                            return exec('git status -z', execOptions);
                        }).then(function(resStatus) {
                            if(!info.isGit){
                                info.isGitSubdir=true;
                            }
                            return exec('git config --get remote.origin.url', execOptions).catch(function(err){
                                return {errorInExec:true};
                            }).then(function(resConfig) {
                                if(!resConfig.errorInExec){
                                    info.origin=resConfig.stdout.replace(/([\t\r\n ]*)$/g,'');
                                    if(resConfig.stdout.match(/github/)) {
                                        info.isGithub = true;
                                    }
                                }
                                return exec('git rev-parse --show-toplevel', execOptions);
                            }).then(function(resTopLevel) {
                                resStatus.topLevel = resTopLevel.stdout;
                                return resStatus;
                            });
                        }).then(function(resStatus){
                            var topDir=resStatus.topLevel;
                            topDir = topDir.substring(0,topDir.length-1);
                            //var reMods = /(modified|new file|deleted):(?:\s|#)+([^#\n][^\n]*)\s*/igm;
                            var reMods = /(M|A|D|\?\?) (?:\s)?([^\u0000]+)\s*/g;
                            var modifieds=[];
                            var deletes=[];
                            var addeds=[];
                            var untrackeds=[];
                            var mod;
                            while ((mod = reMods.exec(resStatus.stdout)) !== null) {
                                //var msg = 'Found ' + mod[1] + ' ['+mod[2]+']'; console.log(msg);
                                var fullPath = topDir+'/'+mod[2];
                                // ATENCION: esto funciona porque nunca se incluyen los parent dirs
                                var file = fullPath.substring(path.length+1);
                                if(fullPath.indexOf(Path.basename(path))==-1){
                                    //console.log("excluded: ", file);
                                    continue;
                                }
                                ({
                                    M: modifieds,
                                    D: deletes,
                                    A: addeds,
                                    '??': untrackeds
                                })[mod[1]].push(file);
                            }                            
                            var hasChanges = modifieds.length || addeds.length || untrackeds.length || deletes.length;
                            if(hasChanges) {
                                if(modifieds.length) { info.modifieds = modifieds; }
                                if(deletes.length) {
                                    info.deletes = deletes;
                                }
                                if(addeds.length) { info.addeds = addeds; }
                                if(untrackeds.length) {
                                    info.untrackeds = untrackeds;
                                }
                            }
                            if(opts.net && info.isGithub) {
                                return exec('git remote show origin', execOptions).catch(function(err) {
                                    return {errorInExec:true};
                                }).then(function(resRemote) {
                                    if(!resRemote.errorInExec) {
                                        if(resRemote.stdout.match(/local out of date/)) {
                                            info.syncPending = true;
                                        }
                                    }
                                    return info;
                                });
                            }
                        }).catch(function(err){
                            if(err.code!=128){
                                throw err;
                            }
                        }).then(function(){
                            return info;
                        });
                    }
                }
                return info;
            });
        } else { // it's a file
            info.name = Path.basename(Path.dirname(path))+'/'+Path.basename(path);
            if(path.match(/(package.json)$/i)) {
                info.isPackageJson = true;
            }
            if(path.match(/(\.json)$/i)) {
                info.isJson = true;
            }
            if(info.isJson && opts.cmd) {
                return fs.readJson(path).catch(function(err) {
                    info.hasError = true;
                    return {errorInRJS:true};
                }).then(function(json) {
                    if(!json.errorInRJS && opts.cmd) {
                        if(opts.net) {
                            return exec('node '+__dirname+'/node_modules/npm-check-updates/bin/npm-check-updates "'+Path.normalize(path)+'"').catch(function(err) {
                                throw new Error("Cannot find npm-check-updates");
                            }).then(function(npm) {
                                if(npm.stdout.match(/can be updated/)) {
                                    info.isOutdated = true;
                                }
                               return info;
                            });
                        }
                    }
                    return info;
                });
            }            
            return info;
        }
    }).then(function(infoForClean){
        return infoForClean;
    });
};

exports = module.exports = dirInfo;
