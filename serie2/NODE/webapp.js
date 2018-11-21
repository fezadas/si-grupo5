const express = require('express')
const app = express()
var request = require('request');
const hbs = require('hbs')
const fs = require('fs')

const port = 3001

app.set('view engine', 'hbs')
hbs.registerPartials('./views/partials')

// system variables where RP credentials are stored
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET

const DROPBOX_KEY = process.env.DROPBOX_KEY
const DROPBOX_SECRET = process.env.DROPBOX_SECRET

const DROPBOX_COOKIE_ID = 'idDropBox'
const DRIVE_COOKIE_ID = 'idDrive'

let map_access_token = {}
let map_dropbox_access_token = {};

app.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }
    console.log(`server is listening on ${port}`)
})

app.get('/', (req, resp) => {
    resp.render('home.hbs')
})

app.get('/login', (req, resp) => {
    resp.redirect(302,
    // authorization endpoint
    'https://accounts.google.com/o/oauth2/v2/auth?'
    // client id
    + 'client_id='+ CLIENT_ID +'&'
    // scope "openid email"
    + 'scope=openid%20email%20https://www.googleapis.com/auth/drive.readonly&'
    // responde_type for "authorization code grant"
    + 'response_type=code&'
    // redirect uri used to register RP
    + 'redirect_uri=http://localhost:3001/googlecallback')
})

app.get('/googlecallback', (req, resp) => {
    console.log('making request to token endpoint')
    request
        .post(
            { 
                url: 'https://www.googleapis.com/oauth2/v3/token',
                form: {
                    code: req.query.code,
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    redirect_uri: 'http://localhost:3001/googlecallback',
                    grant_type: 'authorization_code'
                }
            }, 
            function(err,httpResponse,body){
                console.log(body);
                var json_response = JSON.parse(body);
                let id = Math.random()
                resp.setHeader('Set-Cookie', [DRIVE_COOKIE_ID+"="+id]);
                map_access_token[id]=json_response.access_token                
                resp.redirect(302,'https://www.dropbox.com/oauth2/authorize?client_id='+DROPBOX_KEY+
                '&response_type=code&redirect_uri=http://localhost:3001/dropboxcallback')
            }
        );
})

app.get('/dropboxcallback',(req,resp) => {

    request
        .post(
            { 
                url: 'https://api.dropbox.com/1/oauth2/token',
                form: {
                    code: req.query.code,
                    client_id: DROPBOX_KEY,
                    client_secret: DROPBOX_SECRET,
                    redirect_uri: 'http://localhost:3001/dropboxcallback',
                    grant_type: 'authorization_code'
                }
            }, 
            function(err,httpResponse,body){
                console.log(body);
                var json_response = JSON.parse(body);
                let id = Math.random()
                resp.setHeader('Set-Cookie', [DROPBOX_COOKIE_ID+"="+id]);
                map_dropbox_access_token[id]=json_response.access_token
                resp.redirect(302,'/googleDriveFiles')
            })    
    })

app.get('/googleDriveFiles',(req,resp) => {

    let drive_key = getCookieId(req.headers.cookie,DRIVE_COOKIE_ID)

    if(!drive_key) resp.redirect(302,'/login') //if user doesnt have cookie, must login again

    request
            .get({
                url: 'https://www.googleapis.com/drive/v2/files',
                headers: {
                    Authorization: "Bearer "+map_access_token[drive_key]
                }   
            },
            (err, res, body) => {
                var info = JSON.parse(body)
                var list = info.items.map(file => {
                    return {
                        id : file.id,
                        name : file.title,
                        size: file.quotaBytesUsed
                    }
                
            })
            resp.render('googlefiles.hbs',{files:list})
    })
})

app.get('/googleDriveFiles/file',(req,resp) => {
    const id = req.query.id
    const name = req.query.name
    resp.render('googlefile.hbs',{id:id,name:name})
})

app.get('/uploadFile/file',(req,resp) => {

    let drive_key = getCookieId(req.headers.cookie,DRIVE_COOKIE_ID)
    let dropbox_key = getCookieId(req.headers.cookie,DROPBOX_COOKIE_ID)

    if(!drive_key || !dropbox_key) resp.redirect(302,'/login')

    const id = req.query.id
    request
            .get({
                url: 'https://www.googleapis.com/drive/v2/files/'+id,
                headers: {
                    Authorization: "Bearer "+map_access_token[drive_key]
                }   
            },
            (err, res, body) => {

                var google_file_json = JSON.parse(body);
                let downloadUrl = google_file_json.downloadUrl
                let fileExtension = google_file_json.fileExtension
                let fileName = google_file_json.title
                var tempFileName = __dirname+ "/tmp/file." + fileExtension
                
                console.log(downloadUrl)
                var dest = fs.createWriteStream(tempFileName)
            
                request
                    .get({
                        url: downloadUrl,
                        encoding:null,
                        headers: {
                            Authorization: "Bearer "+map_access_token[drive_key]
                        } 
                    },
                    (err, res, body) => {
                        dest.write(body, function() {
                            console.log('Now the data has been written on the temp file.')
                            fs.readFile(tempFileName, (err, data) => {
                                if (err) throw err;
                                uploadDropbox(data,fileName,map_dropbox_access_token[dropbox_key])   
                            resp.redirect(302,'/updateDone')
                            });
                    })
                });
            })
})

app.get('/updateDone',(req,resp) => {
    resp.render('updateDone.hbs')
})

function uploadDropbox(data, fileName,token){

    var Dropbox_API_Arg ={
        path: "/GoogleDriveFiles/"+fileName,
        mode: 'add',
        autorename: false,
        mute: false,
        strict_conflict: false
    }

    request
        .post('https://content.dropboxapi.com/2/files/upload', {
            headers: {
                Authorization: "Bearer "+token,
                'Dropbox-API-Arg':JSON.stringify(Dropbox_API_Arg),
                'Content-Type': 'application/octet-stream'
                    },
            body: data
            },
            (err, res, body) => {
                console.log(body)
                console.log('Finished Copy.')
    })
}

function getCookieId(cookies,id){
    let value = "; " + cookies;
    let parts = value.split("; "+id+"=")
    return parts.pop().split(";").shift()
}