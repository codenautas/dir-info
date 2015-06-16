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
        deletes:'D',
        changed:'C',
        unstaged:'U',
        ignored:'i',
        outdated:'O', // only for multilang
        ok:''
    },
    server:{
        unpushed:'P',
        unsynced:'S',
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
    //console.log('lo corro',Path.normalize(path));
    opts = opts || {};
    //if(opts.net) { opts.cmd=true; }
    var info={
        name:Path.basename(path), // BAD! only the last dirname
        is:'other',
        status:null,
        server:null,
        origin:null,
        modifieds:null,
        untrackeds:null
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
                    info.is='git';
                    info.isGit = true;
                    if(opts.cmd) {
                        return Promises.start(function(){
                        }).then(function() {
                            return dirInfo.findGitDir();
                        }).then(function(gitDir) {
                            if(""===gitDir) { throw new Error("Could not find git"); }
                            execOptions.cwd = path;
                            execOptions.env = {PATH: gitDir};
                            return exec('git status', execOptions);
                        }).then(function(res) {
                            return exec('git config --get remote.origin.url', execOptions).catch(function(err){
                                return {errorInExec:true};
                            }).then(function(resRemote) {
                                if(!resRemote.errorInExec){
                                    info.origin=resRemote.stdout.replace(/([\t\r\n ]*)$/g,'');
                                    if(resRemote.stdout.match(/github/)) { info.is = 'github'; }
                                }
                                return res;
                            });
                        }).then(function(res){
                            //console.log("git status", res.stdout);
                            var isUntracked=res.stdout.match(/untracked files:/i);
                            var reMods = /(modified|new file):\W+([^\n]+)\W*/igm;
                            var modifieds=[];
                            var news=[];
                            var untrackeds=[];
                            var mod;
                            while ((mod = reMods.exec(res.stdout)) !== null) {
                                var msg = 'Found ' + mod[1] + '. ';
                                if(mod[1]==='modified') {
                                    modifieds.push(mod[2]);
                                } else {
                                    news.push(mod[2]);
                                }
                                console.log(msg);
                            }
                            var reUntr = /untracked files:\W+(.+)\n\n*/igm;
                            var unt=reUntr.exec(res.stdout);
                            if(unt) {
                                var utfiles = res.stdout.substring(unt.index+unt[0].length);
                                utfiles = utfiles.split('\n\n')[0];
                                untrackeds = utfiles.split('\n');
                                for(var u=0; u<untrackeds.length; ++u) {
                                    untrackeds[u] = untrackeds[u].replace(/\s\s*$/, '').replace(/^\s\s*/, '');
                                }
                            }
                            
                            var isChanged=false;
                            if(modifieds.length || news.length || untrackeds.length) {
                                isChanged = true;
                                if(modifieds) { info.modifieds = modifieds; }
                                //if(news) { info.news = news; }
                                if(untrackeds) { info.untrackeds = untrackeds; }
                            }
                            if(opts.net && info.is=="github") {
                                if(isChanged) { info.status = 'changed'; }
                                if(isUntracked) { info.server = 'outdated'; }
                            }
                            if(opts.cmd) {
                                info.status = 'ok';
                                if(isChanged) { info.status = 'changed'; }
                                else if(isUntracked) { info.status = 'unstaged'; }
                            }
                            console.log("info", info);
                            return info;
                        });
                    }
                }
                else {
                    if(opts.cmd && info.is==='other') { info.status = 'ok'; }
                }
                console.log("info 2", info);
                return info;
            });
        } else { // it's a file
            info.name = Path.basename(Path.dirname(path))+'/'+Path.basename(path);
            if(path.match(/(package.json)$/i)) {
                info.is = 'package.json';
                info.isPackageJson = true;
            }
            if(path.match(/(\.json)$/i)) {
                if(!info.isPackageJson) { info.is = 'json'; }
                info.isJson = true;
            }
            if(info.is.match(/json/) && opts.cmd) {
                return fs.readJson(path).catch(function(err) {
                    info.status = 'error';
                    return {errorInRJS:true};
                }).then(function(json) {
                    if(!json.errorInRJS && opts.cmd) {
                        info.status = 'ok';
                        if(opts.net) {
                            return exec('node '+__dirname+'/node_modules/npm-check-updates/bin/npm-check-updates "'+Path.normalize(path)+'"').catch(function(err) {
                                throw new Error("Cannot find npm-check-updates");
                            }).then(function(npm) {
                                if(npm.stdout.match(/can be updated/)) {
                                    info.server = 'outdated';
                                    info.isOutdated = true;
                                } else {
                                    info.server = 'ok';
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
    });
};

exports = module.exports = dirInfo;
