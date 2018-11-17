const express = require('express')
const app = express()
var request = require('request');
const hbs = require('hbs')
const fs = require('fs')

const port = 3001

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
    resp.send('<a href=/login>Use Google Account</a>')
})

// More information at:
//  https://developers.google.com/identity/protocols/OpenIDConnect

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
    // https://www.npmjs.com/package/request#examples
    // content-type: application/x-www-form-urlencoded (URL-Encoded Forms)
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
                request
                    .get({
                        url: 'https://www.googleapis.com/drive/v3/files',
                        headers: {
                            Authorization: "Bearer "+access_token
                        }   
                    },
                (err, res, body) => {
                    console.log(body)
                    resp.redirect(302,'https://www.dropbox.com/oauth2/authorize?client_id='+DROPBOX_KEY+
                    '&response_type=code&redirect_uri=http://localhost:3001/dropboxcallback')
                })
            }
        );
})


app.get('/dropboxcallback',(req,resp)=>{

    request
        .post(
            { 
                url: 'https://api.dropbox.com/1/oauth2/token',
                // body parameters
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
                // send code and id_token to user-agent, just for debug purpose
                var json_response = JSON.parse(body);
                dropbox_access_token = json_response.access_token

                request
                    .get({
                        url: 'https://www.googleapis.com/drive/v3/files/1XhrlKkdMgAxgayK9UkFeaAeSiZiKRJ2G?'+'alt=media',
                        headers: {
                            Authorization: "Bearer "+access_token
                        }   
                    },
                    (err, res, body) => {

                            var tempFileName = __dirname+'/tmp/file'

                            var dest = fs.createWriteStream(tempFileName)
                            //var readStream = fs.createReadStream(tempFileName);
                            let content 

                            dest.write(body, function() {
                                console.log('Now the data has been written.')
                                });

                            //readStream.pipe(content);

                            fs.readFile(tempFileName, (err, data) => {
                                if (err) throw err;
                                content = data
                            });
                            
                        

                            request
                                .post('https://content.dropboxapi.com/2/files/upload', {
                                    headers: {
                                        Authorization: "Bearer "+dropbox_access_token,
                                        'Dropbox-API-Arg':{
                                            path: "/Homework/math/Matrices.txt",
                                            mode: "add",
                                            autorename: false,
                                            mute: false,
                                            strict_conflict: false
                                        },
                                        'Content-Type': 'application/octet-stream'
                                        //'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                                            },
                                    body: content
                                    },
                                    (err, res, body) => {
                                        console.log(body)
                                        console.log('finished')
                                    })
                })
                        }
                    );
                })




