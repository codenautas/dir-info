"use strict";

var _ = require('lodash');
var expect = require('expect.js');
var dirInfo = require('..');
// var fsExtra = require('fs-extra');
var Promise = require('promise');
var fs = require('fs-promise');

var dirbase = './test/working-fixtures';
var skip = { // provisional
    summary:true
}

describe('dir-info', function(){
    var paths=[{
        dir:'simple-git',
        is:'git',
        status:'unstaged',
        server:'',
        origin:'unknown'
    },{
        dir:'auto-reference-github',
        is:'github',
        status:'changed', // has priority over unstaged
        server:'outdated', 
        origin:'https://github.com/codenautas/fast-devel-server.git'
    },{
        dir:'simple-dir',
        is:'other',
        status:'ok', 
        server:''
    },{
        dir:'simple-dir/package.json',
        is:'package.json',
        status:'ok', 
        server:''
    },{
        dir:'simple-git/other.json',
        is:'json',
        status:'error', 
        server:''
    },{
        dir:'simple-dir/package.json',
        is:'package.json',
        status:'ok', 
        server:'outdated' // because mocha version. can use npm-check-updates
    }];
    before(function(done){
        Promise.resolve().then(function(){
            return fs.remove(dirbase);
        }).then(function(){
            return fs.copy('./test/fixtures', dirbase, {clobber:true});
        }).then(function(){
            return Promise.all(paths.map(function(path){
                if(path.is.substr(0,3)==='git'){
                    return fs.rename(dirbase+'/'+path.dir+'/dot-git',dirbase+'/'+path.dir+'/.git');
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
    describe('simple tests', function(){
        it.skip('recognizes a git dir', function(done){
            dirInfo.getInfo(dirbase+'/simple-git').then(function(info){
                expect(info.is).to.eql('git');
                done();
            }).catch(done);
        });
        it.skip('recognizes a github dir', function(done){
            dirInfo.getInfo(dirbase+'/auto-reference-github').then(function(info){
                expect(info.is).to.eql('github');
                done();
            }).catch(done);
        });
        it.skip('run command for get more info', function(done){
            dirInfo.getInfo(dirbase+'/simple-git',{cmd:true}).then(function(info){
                expect(info.is).to.eql('git');
                expect(info.status).to.eql('unstaged');
                expect(info.server === null).to.be.ok();
                done();
            }).catch(done);
        });
        it.skip('connect to de net for get more info', function(done){
            dirInfo.getInfo(dirbase+'/simple-git',{cmd:true}).then(function(info){
                expect(info.is).to.eql('git');
                expect(info.status).to.eql('changed');
                expect(info.server).to.eql('outdated');
                done();
            }).catch(done);
        });
    });
    describe('comprehensive incomprehensible tests', function(){
        var calls=[{
            opts:{cmd:false, net:false},
            resultMask:{status:null, server:null}
        },{
            opts:{cmd:true, net:false},
            resultMask:{server:null}
        },{
            opts:{cmd:true, net:true},
            resultMask:{}
        }];
        it.skip('call comprehensive tests', function(done){
            Promise.all(_.flatten(paths.map(function(path){
                return calls.map(function(call){
                    return dirInfo.getInfo(dirbase+'/'+path.dir, call.opts).then(function(info){
                        var expected = _.merge({}, path, call.resultMask);
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
