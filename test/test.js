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
    var dirs=[{
        dir:'simple-git',
        is:{git:true, github:false, svn:false},
        status:{unstaged:true, changed:false},
        server:{outdated:null, origin:null}
    },{
        dir:'auto-reference-github',
        is:{git:true, github:true, svn:false},
        status:{unstaged:false, changed:true},
        server:{outdated:true, origin:'https://github.com/codenautas/fast-devel-server.git'}
    }];
    before(function(done){
        Promise.resolve().then(function(){
            return fs.remove(dirbase);
        }).then(function(){
            return fs.copy('./test/fixtures', dirbase, {clobber:true});
        }).then(function(){
            return Promise.all(dirs.map(function(dir){
                return fs.rename(dirbase+'/'+dir.dir+'/dot-git',dirbase+'/'+dir.dir+'/.git');
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
                expect(info.is.git).to.be.ok();
                expect(info.is.github).to.not.be.ok();
                if(!skip.summary){
                    expect(info.summary).to.eql('g');
                }
                done();
            }).catch(done);
        });
        it.skip('recognizes a github dir', function(done){
            dirInfo.getInfo(dirbase+'/auto-reference-github').then(function(info){
                expect(info.is.git).to.be.ok();
                expect(info.is.github).to.be.ok();
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
            opts:{cmd:true, net:false},
            resultMask:{}
        }];
        it.skip('call comprehensive tests', function(done){
            Promise.all(_.flatten(dirs.map(function(dir){
                return calls.map(function(call){
                    return dirInfo.getInfo(dirbase+'/'+dir.dir, call.opts).then(function(info){
                        var expected = _.merge({}, dir, call.resultMask);
                        expect(info).to.eql(expected);
                    }).catch(function(err){
                        console.log('ERROR in case',dir,call);
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
