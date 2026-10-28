'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),root=path.join(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),index=fs.readFileSync(root+'/index.html'),version=index.toString('utf8').match(/name="planner-version" content="([^"]+)"/)?.[1];
if(!version||!/^\d+\.\d+\.\d+$/.test(version))throw Error('Missing version');
const assets=fs.readdirSync(root+'/assets').filter(n=>/^[a-z0-9-]+\.(js|css)$/.test(n)).sort().map(n=>({path:'assets/'+n,sha256:sha(fs.readFileSync(root+'/assets/'+n))}));
fs.writeFileSync(root+'/version.json',JSON.stringify({app:'planer-tras-rowerowych',version,indexSHA:sha(index),assets},null,2)+'\n');console.log('version.json: '+version+' / '+assets.length+' assets');
