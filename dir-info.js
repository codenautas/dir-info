"use strict";

var dirInfo = {}; 

var Path = require('path');
var fs = require('fs-promise');
var exec = require('child-process-promise').exec;
var readYaml = require('read-yaml-promise');
//var winOS = Path.sep==='\\';
var ncu = require('npm-check-updates');

dirInfo.config = { gitDir:false };

/*
    Esta funcion toma el path de git de:
    - dirInfo.config.gitDir
    - local-config.yaml git_dir
    - process.env.GITDIR
    O asume que está en el PATH y devuelve ''
 */
dirInfo.gitPath = function gitPath() {
    var localyaml='./local-config.yaml';
    return Promise.resolve().then(function() {
        return fs.exists(localyaml);
    }).then(function(existsYAML) {
        if(existsYAML) { return readYaml(localyaml); }
        return false;
    }).then(function(yconf){
        if(dirInfo.config.gitDir) { return dirInfo.config.gitDir; }
        if(yconf && yconf.git_dir) { return yconf.git_dir; }
        if(process.env.GITDIR) { return process.env.GITDIR; }
        return '';
    });
};

function gitRegExpTo(cual) {
    // es posible que siempre sea https y sobre el '?', pero esto asegura
    return new RegExp('^((https?://)?[^.]+'+cual+'\.com)');
}

dirInfo.getInfo = function getInfo(path, opts){
    opts = opts || {};
    var info={ origin:null };
    return Promise.resolve().then(function(){
        if(!path) { throw new Error('null path'); }
        info.name = Path.basename(path); // BAD! only the last dirname
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
            }).catch(function(/*err*/){
                return false;
            }).then(function(isDirDotGit) {
                if(isDirDotGit){
                    info.isGit = true;
                }
                if(opts.cmd) {
                    return Promise.resolve().then(function(){
                        return dirInfo.gitPath();
                    }).then(function(gitDir) {
                        execOptions.cwd = path;
                        execOptions.env = process.env;
                        if(execOptions.env.PATH.indexOf(gitDir)===-1) {
                            execOptions.env.PATH+=Path.delimiter+gitDir;
                        }
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
                                if(gitRegExpTo('github').test(resConfig.stdout)) {
                                    info.isGithub = true;
                                }
                                if(gitRegExpTo('gitlab').test(resConfig.stdout)) {
                                    info.isGitlab = true;
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
                        if(opts.net && (info.isGithub || info.isGitlab)) {
                            return exec('git remote show origin', execOptions).catch(function(/*err*/) {
                                return {errorInExec:true};
                            }).then(function(resRemote) {
                                if(!resRemote.errorInExec) {
                                    if(resRemote.stdout.match(/local out of date/)) {
                                        info.syncPending = true;
                                    }             
                                    if(info.isGitlab) {
                                        if(resRemote.stdout.match(/fast-forwardable/)) {
                                            info.pushPending = true;
                                        }
                                    }
                                }
                                return exec('git log --branches --not --remotes', execOptions);
                            }).then(function(resLOG) {
                                if(info.isGithub) {
                                    var rst=resLOG.stdout.substring(0, resLOG.stdout.length-1);
                                    if(rst !== "") { info.pushPending = true; }
                                }
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
                return fs.readJson(path).catch(function(/*err*/) {
                    info.hasError = true;
                    return {errorInRJS:true};
                }).then(function(json) {
                    if(!json.errorInRJS && opts.cmd) {
                        if(opts.net) {
                            return ncu.run({packageFile: Path.normalize(path)}).then(function(npmres) {
                                function hasUpdates(o) {
                                    for(var prop in o) { if (o.hasOwnProperty(prop)) { return true; } }
                                    return false;
                                }
                                if(hasUpdates(npmres)) {
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
