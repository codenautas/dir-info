﻿"use strict";

var expect = require('expect.js');
var dirInfo = require('..');
var fs = require('fs-extra');
var expectCalled = require('expect-called');
var Path = require('path');
var winOS = Path.sep==='\\';
var changing = require('best-globals').changing;

var dirbase;

if(process.env.TRAVIS){
    dirbase = process.env.HOME;
}else if(process.env.APPVEYOR){
    dirbase = process.env.APPVEYOR_BUILD_FOLDER;
    console.log('APPVEYOR ============ DIR',dirbase);
    dirbase = 'C:\\Users\\appveyor\\AppData\\Local\\Temp';
}else{
    dirbase = process.env.TMP || process.env.TEMP || '/tmp';
}
dirbase+='/temp-dir-info';

var skip = { // provisional
    summary:true
}

describe('dir-info', async function(){
    var paths=[{
        path:'simple-git',
        origin:null,
        branch:'master',
        isGit:true,
        modifieds:['only-one-staged.txt'],
        untrackeds:['another-un-staged-file.txt', 'un-staged-file.txt']
    },{
        skipped:'YES! THIS IS ONLY FOR A NON COMPRENSIVE TEST',
        path:'tree-git',
        origin:null,
        branch:'master',
        isGit:true,
        modifieds:['only-one-staged.txt'],
        untrackeds:['another-un-staged-file.txt', 'un-staged-file.txt']
    },{
        path:'auto-reference-github-unpushed',
        origin:'https://github.com/codenautas/dir-info.git',
        branch:'master',
        isGit:true,
        isGithub:true,
        untrackeds:['master', 'un-staged-file.txt'],
        pushPending:true,
        syncPending:true
    },{
        path:'auto-reference-github-unsynced',
        origin:'https://github.com/codenautas/dir-info.git',
        branch:'master',
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
    },{
        path:'simple-git-with-newbranch',
        origin:null,
        branch:'newbranch',
        modifieds:['newbranch.txt'],
        isGit:true
    // Este fixture está comentado porque:
    //   1. El repositorio es privado o inexistente
    //   2. Pide autenticación cuando opts.net == true, que corre comandos git que usan la red
    // Habría que remover el directorio test/fixtures/gitlab-private y este bloque comentado
    // },{
        // path:'gitlab-private',
        // origin:'https://gitlab.com/pert/mangrullo.git',
        // branch:'master',
        // isGit:true,
        // isGitlab:true
//    },{
//        path:'gitlab-unpushed',
//        origin:'https://gitlab.com/diegoefe/dir-info-check.git',
//        branch:'master',
//        isGit:true,
//        isGitlab:true,
//        pushPending:true
//    },{
//        path:'gitlab-unsynced',
//        origin:'https://gitlab.com/diegoefe/dir-info-check.git',
//        branch:'master',
//        isGit:true,
//        isGitlab:true,
//        syncPending:true
    }];
    before(async function(){
        this.timeout(5000);
        try{
            await fs.rm(dirbase, {recursive:true});
        }catch(err){
            if(err.code!='ENOENT') throw err;
        }
        await fs.copy('./test/fixtures', dirbase, {overrite:true});
        await Promise.all(paths.map(async function(path){
            if(path.isGit){
                await fs.rename(dirbase+'/'+path.path+'/dot-git',dirbase+'/'+path.path+'/.git');
            }
        }));
    });
    describe('gitPath tests', function(){
        var configOriginal;
        var envOriginal;
        beforeEach(function(){
            configOriginal = JSON.parse(JSON.stringify(dirInfo.config));
            envOriginal = process.env;
        });
        afterEach(function(){
            dirInfo.config = configOriginal;
            process.env = envOriginal;
        });
        it('should use git in dirInfo.config', function(done){
            var fakeDirInConfig = "/usr/bin";
            dirInfo.config = {gitDir: fakeDirInConfig};
            dirInfo.gitPath().then(function(git){
                expect(git).to.eql(fakeDirInConfig);
                done();
            }).catch(function(err) {
                console.log("err", err)
                done(err);
            });
        });
        it('should use git in local-config.yaml', function(done){
            var here=process.cwd();
            process.chdir(Path.normalize(dirbase+'/dir-with-yaml-conf'));
            dirInfo.gitPath().then(function(git){
                expect(git).to.eql('/some/directory/containing/the/git/binary');
                process.chdir(here);
                done();
            }).catch(done);
        });
        it('should use git in environment variable', function(done){
            var fakeEnvDir='c:\\directory\\containing\\git\\binary';
            process.env['GITDIR'] = fakeEnvDir;
            dirInfo.gitPath().then(function(git){
                expect(git).to.eql(fakeEnvDir);
                delete process.env['GITDIR'];
                done();
            }).catch(done);
        });
        it('shoud use git found in PATH', function(done){
            dirInfo.gitPath().then(function(gitdir){
                expect(gitdir).to.be.empty();
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
        it('accept files with spaces and ASII7 characters', function(done){
            //var expectedPath='grandson/nom français.txt';
            var expectedPath='grandson/¡nombre español!.txt';
            var inputFile=Path.normalize(dirbase+'/tree-git/son/'+expectedPath);
            dirInfo.getInfo(inputFile,{cmd:true}).then(function(info){
                //console.log(info);
                expect(info.name).to.eql(expectedPath);
                expect(info.origin).to.be.null;
                done();
            }).catch(done);
        });
        it('should fail if path is null', function(done){
            dirInfo.getInfo(null,null).then(function(info){
                done(info);
            }).catch(function(err){
                expect(err).to.match(/null path/);
                done();
            });
        });
        it('should fail if path does not exists', function(done){
            dirInfo.getInfo('/non existent path/',null).then(function(info){
                done(info);
            }).catch(function(err){
                expect(err).to.match(/does not exists/);
                done();
            });
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
                if(info.isGitlab){
                    delete info.isGitlab;
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
                delete info.branch;
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
            var path = JSON.parse(JSON.stringify(pathMayBeSkipped));
            delete path.skipped;
            calls.forEach(function(call){
                it('t: '+path.path+' of '+JSON.stringify(call.opts), function(done){
                    //console.log("call", call);
                    Promise.resolve().then(function(){
                        return dirInfo.getInfo(dirbase+'/'+path.path, call.opts);
                    }).then(function(info){
                        //console.log("ret info", info);
                        var expected = changing({}, changing(path, call.resultMask));
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
