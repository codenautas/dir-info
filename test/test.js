﻿"use strict";

var _ = require('lodash');
var expect = require('expect.js');
var dirInfo = require('..');
// var fsExtra = require('fs-extra');
var Promises = require('best-promise');
var fs = require('fs-promise');
var expectCalled = require('expect-called');
var Path = require('path');

var dirbase;

if(process.env.TRAVIS){
    dirbase = process.env.HOME;
}else if(process.env.APPVEYOR){
    dirbase = process.env.APPVEYOR_BUILD_FOLDER;
}else{
    dirbase = process.env.TMP || process.env.TEMP || '/tmp';
}
dirbase+='/temp-dir-info';

var skip = { // provisional
    summary:true
}

describe('dir-info', function(){
    var paths=[{
        path:'simple-git',
        origin:null,
        isGit:true,
        modifieds:['only-one-staged.txt'],
        untrackeds:['another-un-staged-file.txt', 'un-staged-file.txt']
    },{
        skipped:'YES! THIS IS ONLY FOR A NON COMPRENSIVE TEST',
        path:'tree-git',
        origin:null,
        isGit:true,
        modifieds:['only-one-staged.txt'],
        untrackeds:['another-un-staged-file.txt', 'un-staged-file.txt']
    },{
        path:'auto-reference-github-unpushed',
        origin:'https://github.com/codenautas/dir-info.git',
        isGit:true,
        isGithub:true,
        untrackeds:['master', 'un-staged-file.txt'],
        // descomentar para pushPending #13
        //pushPending:true,
        syncPending:true
    },{
        path:'auto-reference-github-unsynced',
        origin:'https://github.com/codenautas/dir-info.git',
        isGit:true,
        isGithub:true,
        deletes: ['test/test.js'],
        syncPending:true
    },{
        path:'simple-dir',
        origin:null
    },{
        path:'simple-dir/package.json',
        origin:null,
        isJson:true,
        isPackageJson:true
    },{
        path:'simple-dir/other.json',
        origin:null,
        isJson:true,
        hasError:true
    },{
        path:'auto-reference-github-unpushed/package.json',
        origin:null,
        isJson:true,
        isPackageJson:true,
        isOutdated:true
    }];
    before(function(done){
        this.timeout(5000);
        Promises.start(function(){
            return fs.remove(dirbase);
        }).then(function(){
            return fs.copy('./test/fixtures', dirbase, {clobber:true});
        }).then(function(){
            return Promises.all(paths.map(function(path){
                if(path.isGit){
                    return fs.rename(dirbase+'/'+path.path+'/dot-git',dirbase+'/'+path.path+'/.git');
                }else{
                    return Promises.Promise.resolve();
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
                Promises.Promise.resolve({isDirectory: function(){ return true;}})
            ]});
        });
        afterEach(function(){
            dirInfo.config = configOriginal;
            process.env = envOriginal;
            controlFsStat.stopControl();
        });
        it.skip('find git in dirInfo.config', function(done){
            var fakeDirInConfig = "/usr/bin";
            dirInfo.config = {gitDir: fakeDirInConfig};
            dirInfo.findGitDir().then(function(git){
                console.log("git", git);
                expect(git).to.eql(fakeDirInConfig);
                expect(controlFsStat.calls).to.eql([
                    [fakeDirInConfig]
                ]);
                done();
            }).catch(done);
        });
        it.skip('find git in package.json', function(done){
            var fakeJSON = {"config": {"gitDir": "/ubicacion/de/git" }};
            var controlReadJSon = expectCalled.control(fs,'readJson',{returns:[
                Promises.Promise.resolve(fakeJSON)
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
        this.timeout(5000);
        it('recognizes a git dir', function(done){
            dirInfo.getInfo(dirbase+'/simple-git').then(function(info){
                expect(info.isGit).to.be.ok();
                done();
            }).catch(done);
        });
        it('recognizes a github dir as "git"', function(done){
            dirInfo.getInfo(dirbase+'/auto-reference-github-unpushed').then(function(info){
                expect(info.isGit).to.be.ok();
                done();
            }).catch(done);
        });
        it('recognizes a github dir', function(done){
            dirInfo.getInfo(dirbase+'/auto-reference-github-unpushed', {cmd:true}).then(function(info){
                expect(info.isGithub).to.be.ok();
                done();
            }).catch(done);
        });
        it('run command for get more info', function(done){
            dirInfo.getInfo(dirbase+'/simple-git',{cmd:true}).then(function(info){
                expect(info.isGit).to.be.ok();
                expect(info.isGitSubdir).to.not.be.ok();
                done();
            }).catch(done);
        });
        it('tree-git must recognize git dir', function(done){
            dirInfo.getInfo(dirbase+'/tree-git/son/grandson',{cmd:true}).then(function(info){
                expect(info.isGit).to.not.be.ok();
                expect(info.isGitSubdir).to.be.ok();
                expect(info.addeds[0]).to.eql('.other-added-');
                info.addeds.sort();
                var addedsExpected=['nom français.txt','¡nombre español!.txt','.other-added-','littleson-chad/added.txt'];
                addedsExpected.sort();
                // prueba para #9:
                expect(info.addeds).to.eql(addedsExpected);
                info.modifieds.sort();
                // files in uppers dirs must not be included: EJ: ../../only-one-staged.txt
                // prueba para #10:
                // Atencion! ser reemplaza la siguiente linea porque 'littleson-chad/modified2.txt' no es
                //         de un parent dir y deberia estar incluido
                //expect(info.modifieds).to.eql(['modified.txt']);
                expect(info.modifieds).to.eql(['littleson-chad/modified2.txt','modified.txt']);
                
                done();
            }).catch(done);
        });
        it('littleson-ok is a ok-dir inside modified git-dir', function(done){
            dirInfo.getInfo(dirbase+'/tree-git/son/grandson/littleson-ok',{cmd:true}).then(function(info){
                expect(info.isGit).to.not.be.ok();
                expect(info.isGitSubdir).to.be.ok();
                expect(info.deletes).to.not.be.ok();
                expect(info.addeds).to.not.be.ok();
                expect(info.modifieds).to.not.be.ok();
                done();
            }).catch(done);
        });
        it('littleson-chad has staged changes', function(done){
            dirInfo.getInfo(dirbase+'/tree-git/son/grandson/littleson-chad',{cmd:true}).then(function(info){
                expect(info.isGit).to.not.be.ok();
                expect(info.isGitSubdir).to.be.ok();
                expect(info.addeds).to.eql(['added.txt']);
                expect(info.modifieds).to.eql(['modified2.txt']);
                expect(info.deletes).to.eql(['deleted2.txt']);
                done();
            }).catch(done);
        });
        it('connect to the net for get more info', function(done){
            dirInfo.getInfo(dirbase+'/simple-git',{cmd:true, net:true}).then(function(info){
                expect(info.isGit).to.be.ok();
                done();
            }).catch(done);
        });
    });
    describe('tests with relative paths', function(){
        function checkWithRelativePath(relPath, done){
            var here=process.cwd();
            var db=dirbase+'/tree-git/son';
            try {
                process.chdir(relPath);
                var relPath = Path.relative(relPath, db);
                dirInfo.getInfo(relPath,{cmd:true}).then(function(info){
                    expect(info.isGit).to.not.be.ok();
                    expect(info.isGitSubdir).to.be.ok();
                    expect(info.addeds[0]).to.eql('grandson/.other-added-');
                    info.addeds.sort();
                    var addedsExpected=[
                        'grandson/nom français.txt',
                        'grandson/¡nombre español!.txt',
                        'grandson/.other-added-',
                        'grandson/littleson-chad/added.txt'];
                    expect(info.modifieds).to.eql(['grandson/littleson-chad/modified2.txt','grandson/modified.txt']);
                    // restore current working directory
                    process.chdir(here);
                    done();
                }).catch(function(err) {
                    done(err);
                });                
            } catch (err) {
                done(err);
            }
        };
        it('should work with a relative path (issue #14)', function(done){
            checkWithRelativePath(dirbase+'/simple-dir', done);
        });
        it('should work with a relative path that lacks a package.json (issue #15)', function(done) {
            checkWithRelativePath(dirbase+'/simple-git', done);
        });
    });
    describe('comprehensive incomprehensible tests', function(){
        this.timeout(20000);
        var calls=[{
            opts:{cmd:false, net:false},
            resultMask:{origin:null},
            reconvert:function(info){
                if(info.isGithub){
                    delete info.isGithub;
                }
                if(info.isJson){
                    delete info.hasError;
                }
                if(info.isPackageJson) {
                    delete info.isOutdated;                    
                }
                delete info.modifieds;
                delete info.deletes;
                delete info.untrackeds;
                delete info.syncPending;
                delete info.pushPending;
            }
        },{
            opts:{cmd:true, net:false},
            resultMask:{},
            reconvert:function(info) {
                if(info.isPackageJson) {
                    delete info.isOutdated;                    
                }
                delete info.syncPending;
                delete info.pushPending;
            }
        },{
            opts:{cmd:true, net:true},
            resultMask:{}
        }];
        paths.forEach(function(pathMayBeSkipped){
            if(pathMayBeSkipped.skipped) return;
            var path = _.clone(pathMayBeSkipped);
            delete path.skipped;
            calls.forEach(function(call){
                it('t: '+path.path+' of '+JSON.stringify(call.opts), function(done){
                    //console.log("call", call);
                    dirInfo.getInfo(dirbase+'/'+path.path, call.opts).then(function(info){
                        //console.log("ret info", info);
                        var expected = _.merge({}, path, call.resultMask);
                        (call.reconvert||function(){})(expected);
                        expected.name = path.path;
                        delete expected.path;
                        expect(info).to.eql(expected);
                        done();
                        /*
                    }).catch(function(err){
                        console.log('ERROR in case',path,call);
                        console.log(err);
                        console.log(err.stack);
                        throw err;
                        */
                    }).catch(done);
                });
            });
        });
    });
});
