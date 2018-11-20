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

let access_token;
let dropbox_access_token;

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
                // body parameters
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
                // send code and id_token to user-agent, just for debug purpose
                var json_response = JSON.parse(body);
                access_token = json_response.access_token

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
                dropbox_access_token = json_response.access_token
                
                resp.redirect(302,'/googleDriveFiles')
            })
    
    function uploadDropbox(data, fileName){
    
        var json ={
            path: "/GoogleDriveFiles/"+fileName,
            mode: 'add',
            autorename: false,
            mute: false,
            strict_conflict: false
        }
        request
            .post('https://content.dropboxapi.com/2/files/upload', {
                headers: {
                    Authorization: "Bearer "+dropbox_access_token,
                    'Dropbox-API-Arg':JSON.stringify(json),
                    'Content-Type': 'application/octet-stream'
                        },
                body: data
                },
                (err, res, body) => {
                    console.log(body)
                    console.log('Finished Copy.')
        })
    }
    })

app.get('/googleDriveFiles',(req,resp) => {
    request
            .get({
                url: 'https://www.googleapis.com/drive/v3/files',
                headers: {
                    Authorization: "Bearer "+access_token
                }   
            },
            (err, res, body) => {
                var info = JSON.parse(body)
                var list = info.files.map(file => {
                    return {
                        id : file.id,
                        name : file.name,
                    }
            })
            resp.render('googlefiles.hbs',{files:list})
    })
})

app.get('/googleDriveFiles/file',(req,resp) => {
    const id = req.query.id
    resp.render('googlefile.hbs',{id:id})
})

app.get('/uploadFile/file',(req,resp) => {
    const id = req.query.id
    request
            .get({
                url: 'https://www.googleapis.com/drive/v2/files/'+id,
                headers: {
                    Authorization: "Bearer "+access_token
                }   
            },
            (err, res, body) => {

                var google_file_json = JSON.parse(body);
                let downloadUrl = google_file_json.downloadUrl
                let fileExtension = google_file_json.fileExtension
                let fileName = google_file_json.title
                var tempFileName = __dirname+ "/tmp/file." + fileExtension

                var dest = fs.createWriteStream(tempFileName)
            
                request
                    .get({
                        url: downloadUrl,
                        headers: {
                            Authorization: "Bearer "+access_token
                        }   
                    },
                    (err, res, body) => {

                        dest.write(body, function() {
                            console.log('Now the data has been written on the temp file.')
                            });

                        fs.readFile(tempFileName, (err, data) => {
                            if (err) throw err;
                            uploadDropbox(data,fileName)   
                        resp.redirect(302,'/updateDone')
                    })
                });
            })
})

app.get('/updateDone',(req,resp) => {
    resp.render('updateDone.hbs')
})

function uploadDropbox(data, fileName){

    var json ={
        path: "/GoogleDriveFiles/"+fileName,
        mode: 'add',
        autorename: false,
        mute: false,
        strict_conflict: false
    }
    request
        .post('https://content.dropboxapi.com/2/files/upload', {
            headers: {
                Authorization: "Bearer "+dropbox_access_token,
                'Dropbox-API-Arg':JSON.stringify(json),
                'Content-Type': 'application/octet-stream'
                    },
            body: data
            },
            (err, res, body) => {
                console.log(body)
                console.log('Finished Copy.')
    })
}