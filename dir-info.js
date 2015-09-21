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
var readYaml = require('read-yaml-promise');
var winOS = Path.sep==='\\';

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
    var localyaml='./local-config.yaml';
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
        return fs.exists(localyaml);
    }).then(function(existsYAML) {
        if(existsYAML) { return readYaml(localyaml); }
        return false;
    }).then(function(yconf){
        if(yconf && yconf.git_dir) {
            paths.unshift(yconf.git_dir);
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
                if(opts.cmd) {
                    return Promises.start(function(){
                        return dirInfo.findGitDir();
                    }).then(function(gitDir) {
                        execOptions.cwd = path;
                        execOptions.env = process.env;
                        execOptions.env.PATH+=Path.delimiter+gitDir;
                        return exec('git status -z', execOptions);
                    }).then(function(resStatusZ) {
                        if(!info.isGit){
                            info.isGitSubdir=true;
                        }
                        return exec('git config --get remote.origin.url', execOptions).catch(function(err){
                            if(err.code===1){
                                return {errorInExec:true};
                            }else{
                                throw err;
                            }
                        }).then(function(resConfig) {
                            if(!resConfig.errorInExec){
                                info.origin=resConfig.stdout.replace(/([\t\r\n ]*)$/g,'');
                                if(resConfig.stdout.match(/github/)) {
                                    info.isGithub = true;
                                }
                            }
                            return exec('git rev-parse --abbrev-ref HEAD', execOptions);
                        }).then(function(resBranch) {
                            info.branch = resBranch.stdout.substring(0, resBranch.stdout.length-1);
                            return exec('git rev-parse --show-toplevel', execOptions);
                        }).then(function(resTopLevel) {
                            resStatusZ.topLevel = resTopLevel.stdout;
                            return resStatusZ;
                        });
                    }).then(function(resStatusZ){
                        var topDir=resStatusZ.topLevel;
                        topDir = topDir.substring(0,topDir.length-1);
                        var reMods = /(M|A|D|\?\?) (?:\s)?([^\u0000]+)\s*/g;
                        var modifieds=[];
                        var deletes=[];
                        var addeds=[];
                        var untrackeds=[];
                        var absPath=Path.resolve(path);
                        var mod;
                        while ((mod = reMods.exec(resStatusZ.stdout)) !== null) {
                            //var msg = 'Found ' + mod[1] + ' ['+mod[2]+']'; console.log(msg);
                            var fullPath = topDir+'/'+mod[2];
                            // ATENCION: esto funciona porque nunca se incluyen los parent dirs
                            if(Path.resolve(fullPath).substring(0,absPath.length)===absPath){
                                var file = fullPath.substring(absPath.length+1);
                                if(fullPath.indexOf(Path.basename(path))==-1){
                                    continue;
                                }
                                ({
                                    M: modifieds,
                                    D: deletes,
                                    A: addeds,
                                    '??': untrackeds
                                })[mod[1]].push(file);
                            }
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
                                return exec('git log --branches --not --remotes', execOptions);
                            }).then(function(resLOG) {
                                var rst=resLOG.stdout.substring(0, resLOG.stdout.length-1);
                                if(rst !== "") { info.pushPending = true; }
                                return info;
                            });
                        }
                    }).catch(function(err){
                        //console.log("Error en path ", path, ":", err);
                        if(err.code!=128){
                            throw err;
                        }
                    }).then(function(){
                        return info;
                    });
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
                            var ncu = __dirname+'/node_modules/npm-check-updates/bin/npm-check-updates';
                            var cat = winOS ? 'type' : 'cat';
                            return fs.exists(ncu).then(function(haveNCU) {
                                if(!haveNCU) {
                                    throw new Error("Cannot find npm-check-updates");
                                }
                                var input=Path.normalize(path);
                                var cmd = cat + ' "'+input+'" | node '+ncu;
                                return exec(cmd).catch(function(err) {
                                }).then(function(npm) {
                                    //console.log("npm", npm.stdout);
                                    //console.log(input, " outdated:", npm.stdout.match(/(can be updated)|(version is behind)/));
                                    if(npm.stdout.match(/(can be updated)|(version is behind)/)) {
                                        info.isOutdated = true;
                                    }
                                   return info;
                                });
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
