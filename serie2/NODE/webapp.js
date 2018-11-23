const express = require('express')
const app = express()
var request = require('request');
const hbs = require('hbs')
const fs = require('fs')

const port = 3001

const crypto = require('crypto');

app.set('view engine', 'hbs')
hbs.registerPartials('./views/partials')

// system variables where RP credentials are stored
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET

const DROPBOX_KEY = process.env.DROPBOX_KEY
const DROPBOX_SECRET = process.env.DROPBOX_SECRET

const DROPBOX_COOKIE_ID = 'idDropBox'
const DROPBOX_TAG_ID = "tagDropbox"
const DRIVE_COOKIE_ID = 'idDrive'
const DRIVE_TAG_ID = "tagDrive"

let map_access_token = {}
let map_dropbox_access_token = {}
let session_key 
let states = {}

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

    let session_id = Math.random()
    states[session_id] = true

    resp.redirect(302,
    // authorization endpoint
    'https://accounts.google.com/o/oauth2/v2/auth?'
    // client id
    + 'client_id='+ CLIENT_ID +'&'
    // scope "openid email"
    + 'scope=openid%20email%20https://www.googleapis.com/auth/drive.readonly&'
    + `state=${session_id}&`
    // responde_type for "authorization code grant"
    + 'response_type=code&'
    // redirect uri used to register RP
    + 'redirect_uri=http://localhost:3001/googlecallback') //state
})

app.get('/googlecallback', (req, resp) => {
    let key = req.query.state
    if(!states[key]) 
        return resp.redirect(302,'/login')
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

                let h = crypto.createHmac('sha256', 'si-serie-2').digest(id)
                // convert to base64
                let hBase64 = Buffer.from(h).toString('base64');

                resp.setHeader('Set-Cookie', [DRIVE_COOKIE_ID+"="+id, DRIVE_TAG_ID + "=" + hBase64]);
                map_access_token[id]={
                    "token" : json_response.access_token,
                    "tag" : hBase64
                }                
                resp.redirect(302,'https://www.dropbox.com/oauth2/authorize?client_id='+ DROPBOX_KEY +
                '&response_type=code&'+ `state=${key}&`+'redirect_uri=http://localhost:3001/dropboxcallback')
            }
        );
})

app.get('/dropboxcallback',(req,resp) => {
    let key = req.query.state
    if(!states[key]) 
        return resp.redirect(302,'/login')
    delete states[key]
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

                let h = crypto.createHmac('sha256', 'si-serie-2').digest(id)
                // convert to base64
                let hBase64 = Buffer.from(h).toString('base64');

                resp.setHeader('Set-Cookie', [DROPBOX_COOKIE_ID + "=" + id, DROPBOX_TAG_ID + '='+hBase64]);
                map_dropbox_access_token[id]={
                    "token" : json_response.access_token,
                    "tag" : hBase64
                }
                resp.redirect(302,'/googleDriveFiles')            
        })    
    })

app.get('/googleDriveFiles',(req,resp) => {

    if(!verifyCookie(req, DRIVE_COOKIE_ID, DRIVE_TAG_ID,map_access_token)) 
        return resp.redirect(302,'/login')
        
    let drive_key = getCookieId(req.headers.cookie,DRIVE_COOKIE_ID)    

    request
            .get({
                url: 'https://www.googleapis.com/drive/v2/files',
                headers: {
                    Authorization: "Bearer "+map_access_token[drive_key].token
                }   
            },
            (err, res, body) => {
                if(res.statusCode != 200)
                   return resp.redirect(302,'/login')
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

    if(!verifyCookie(req, DROPBOX_COOKIE_ID, DROPBOX_TAG_ID,map_dropbox_access_token) &&
    !verifyCookie(req, DRIVE_COOKIE_ID, DRIVE_TAG_ID,map_access_token))
     resp.redirect(302,'/login')

    const id = req.query.id
    const name = req.query.name
    resp.render('googlefile.hbs',{id:id,name:name})
})

app.get('/uploadFile/file',(req,resp) => {

    if(!verifyCookie(req, DROPBOX_COOKIE_ID, DROPBOX_TAG_ID,map_dropbox_access_token) &&
       !verifyCookie(req, DRIVE_COOKIE_ID, DRIVE_TAG_ID,map_access_token))
        resp.redirect(302,'/login')

    let drive_key = getCookieId(req.headers.cookie,DRIVE_COOKIE_ID)
    let dropbox_key = getCookieId(req.headers.cookie,DROPBOX_COOKIE_ID)    

    const id = req.query.id
    request
            .get({
                url: 'https://www.googleapis.com/drive/v2/files/'+id,
                headers: {
                    Authorization: "Bearer "+map_access_token[drive_key].token
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
                            Authorization: "Bearer "+map_access_token[drive_key].token
                        } 
                    },
                    (err, res, body) => {
                        dest.write(body, function() {
                            console.log('Now the data has been written on the temp file.')
                            fs.readFile(tempFileName, (err, data) => {
                                if (err) throw err;
                                uploadDropbox(data,fileName,map_dropbox_access_token[dropbox_key].token)   
                            resp.redirect(302,'/updateDone')
                            });
                    })
                });
            })
})

app.get('/updateDone',(req,resp) => {

    if(!verifyCookie(req, DROPBOX_COOKIE_ID, DROPBOX_TAG_ID,map_dropbox_access_token) &&
    !verifyCookie(req, DRIVE_COOKIE_ID, DRIVE_TAG_ID,map_access_token))
     resp.redirect(302,'/login')

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

function verifyCookie(req, cookieId, cookieTag, map){
    let key = getCookieId(req.headers.cookie,cookieId)
    let tag = getCookieId(req.headers.cookie,cookieTag)
    return key && map[key] && map[key].tag == tag
}