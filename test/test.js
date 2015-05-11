"use strict";

var _ = require('lodash');
var expect = require('expect.js');
var dirInfo = require('..');
// var fsExtra = require('fs-extra');
var Promise = require('promise');
var fs = require('fs-promise');
var expectCalled = require('expect-called');

var dirbase = './test/working-fixtures';
var skip = { // provisional
    summary:true
}

describe('dir-info', function(){
    var paths=[{
        path:'simple-git',
        is:'git',
        status:'changed',
        server:null,
        origin:null
    },{
        skipped:true,
        path:'auto-reference-github',
        is:'github',
        status:'changed', // has priority over unstaged
        server:'outdated', 
        origin:'https://github.com/codenautas/fast-devel-server.git'
    },{
        skipped:true,
        path:'simple-dir',
        is:'other',
        status:'ok', 
        server:null,
        origin:null
    },{
        skipped:true,
        path:'simple-dir/package.json',
        is:'package.json',
        status:'ok', 
        server:'ok',
        origin:null
    },{
        skipped:true,
        path:'simple-git/other.json',
        is:'json',
        status:'error', 
        server:null,
        origin:null
    },{
        skipped:true,
        path:'simple-dir/package.json',
        is:'package.json',
        status:'ok', 
        server:'outdated', // because mocha version. can use npm-check-updates
        origin:null
    }];
    before(function(done){
        Promise.resolve().then(function(){
            return fs.remove(dirbase);
        }).then(function(){
            return fs.copy('./test/fixtures', dirbase, {clobber:true});
        }).then(function(){
            return Promise.all(paths.map(function(path){
                if(path.is.substr(0,3)==='git'){
                    return fs.rename(dirbase+'/'+path.path+'/dot-git',dirbase+'/'+path.path+'/.git');
                }else{
                    return Promise.resolve();
                }
            }));
        }).then(function(){
            done();
        }).catch(function(err){
            console.log(err);
            done(_.isArray(err)?err[0]:err);
        });
    });
    describe('find gitdir tests', function(){
        var configOriginal;
        var envOriginal;
        var controlFsStat;
        beforeEach(function(){
            configOriginal = _.cloneDeep(dirInfo.config);
            envOriginal = process.env;
            controlFsStat = expectCalled.control(fs,'stat',{returns:[
                Promise.resolve({isDirectory: function(){ return true;}})
            ]});
        });
        afterEach(function(){
            dirInfo.config = configOriginal;
            process.env = envOriginal;
            controlFsStat.stopControl();
        });
        it('find git in dirInfo.config', function(done){
            var fakeDirInConfig = "/usr/bin";
            dirInfo.config = {gitDir: fakeDirInConfig};
            dirInfo.findGitDir().then(function(git){
                expect(git).to.eql(fakeDirInConfig);
                expect(controlFsStat.calls).to.eql([
                    [fakeDirInConfig]
                ]);
                done();
            }).catch(done);
        });
        it('find git in package.json', function(done){
            var fakeJSON = {"config": {"gitDir": "/ubicacion/de/git" }};
            var controlReadJSon = expectCalled.control(fs,'readJson',{returns:[
                Promise.resolve(fakeJSON)
            ]});
            dirInfo.findGitDir().then(function(git){
                expect(git).to.eql(fakeJSON.config.gitDir);
                expect(controlFsStat.calls).to.eql([ [fakeJSON.config.gitDir] ]);
                done();
            }).catch(done).then(function() {
                controlReadJSon.stopControl();
            });
        });
        it('find git in environment variable', function(done){
            var fakeEnvDir='c:\\directorio\\donde\\esta\\git';
            process.env['GITDIR'] = fakeEnvDir;
            dirInfo.findGitDir().then(function(git){
                expect(git).to.eql(fakeEnvDir);
                expect(controlFsStat.calls).to.eql([ [fakeEnvDir] ]);
                done();
            }).catch(done);
        });
    });
    describe('simple tests', function(){
        it('recognizes a git dir', function(done){
            dirInfo.getInfo(dirbase+'/simple-git').then(function(info){
                expect(info.is).to.eql('git');
                done();
            }).catch(done);
        });
        it('recognizes a github dir as "git"', function(done){
            dirInfo.getInfo(dirbase+'/auto-reference-github').then(function(info){
                expect(info.is).to.eql('git');
                done();
            }).catch(done);
        });
        it('recognizes a github dir', function(done){
            dirInfo.getInfo(dirbase+'/auto-reference-github', {cmd:true}).then(function(info){
                expect(info.is).to.eql('github');
                done();
            }).catch(done);
        });
        it('run command for get more info', function(done){
            dirInfo.getInfo(dirbase+'/simple-git',{cmd:true}).then(function(info){
                expect(info.is).to.eql('git');
                expect(info.status).to.eql('changed');
                expect(info.server === null).to.be.ok();
                done();
            }).catch(done);
        });
        it('connect to the net for get more info', function(done){
            dirInfo.getInfo(dirbase+'/simple-git',{net:true}).then(function(info){
                expect(info.is).to.eql('git');
                expect(info.status).to.eql('changed');
                expect(info.server).to.eql('outdated');
                done();
            }).catch(done);
        });
    });
    describe.skip('comprehensive incomprehensible tests', function(){
        var calls=[{
            opts:{cmd:false, net:false},
            resultMask:{status:null, server:null, origin:null}
        },{
            opts:{cmd:true, net:false},
            resultMask:{server:null}
        },{
            opts:{cmd:true, net:true},
            resultMask:{}
        }];
        it('call comprehensive tests', function(done){
            Promise.all(_.flatten(paths.map(function(pathMayBeSkipped){
                if(pathMayBeSkipped.skipped) return Promise.resolve();
                var path = _.clone(pathMayBeSkipped);
                delete path.skipped;
                return calls.map(function(call){
                    return dirInfo.getInfo(dirbase+'/'+path.path, call.opts).then(function(info){
                        var expected = _.merge({}, path, call.resultMask);
                        expected.name = path.path;
                        delete expected.path;
                        expect(info).to.eql(expected);
                    }).catch(function(err){
                        console.log('ERROR in case',path,call);
                        console.log(err);
                        throw err;
                    });
                });
            }))).then(function(results){
                done();
            }).catch(function(err){
                done(err);
            });
        });
    });
});
