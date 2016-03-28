var exec = require('child-process-promise').exec;

var pout=process.stdout, perr=process.stderr;
var logtag = "DIR-INFO: ";

pout.write(logtag+"Checking prerequisites...\n");
exec("git version", function(err, stdout, stderr) {
   if(err) {
       perr.write(logtag+"Error! git not found in PATH\n");
       //perr.write(logtag+"Error finding git: "+err+"\n");
       process.exit(1);
   }
   pout.write(logtag+"using "+ stdout);
});
