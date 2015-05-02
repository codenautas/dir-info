
var expect = require('expect.js');
var dirInfo = require('..');

describe('dir-info', function(){
    describe('accesing the file system', function(){
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
        var calls=[{
            opts:{cmd:false, net:false},
            resultMask:{status:null, server:null}
        },{
            opts:{cmd:true, net:false},
            resultMask:{server:null}
        }];
        it('recognizes a git dir', function(done){
            dirInfo.getInfo('test/fixtures/simple-git').then(function(info){
                expect(info.is.git).to.be.ok();
                expect(info.is.github).to.not.be.ok();
                expect(info.summary).to.eql('g');
                done();
            }).catch(done);
        });
    });
});
