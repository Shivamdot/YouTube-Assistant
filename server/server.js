const express = require('express');
const admin = require('firebase-admin');
const {
  dialogflow,
  Image,
  SignIn,
  NewSurface,
  Suggestions,
  BasicCard,
  Button
} = require('actions-on-google');  
const {google} = require('googleapis');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
const bodyParser = require('body-parser');
const moment = require('moment');

var app = express();

app.use(bodyParser.json());

var agent = dialogflow({
  debug: true,
  clientId: '122184330678-o5i7c2s7t4sdu2scg4n5b5b7tvellnkm.apps.googleusercontent.com'
});

const serviceAccount = require('./../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://assistant-a4a97.firebaseio.com"
});

var db = admin.firestore();

db.settings({
  timestampsInSnapshots: true
});

const YOUR_CLIENT_ID = "122184330678-3557i6676ekrctmr3r6jom5a5vb27gej.apps.googleusercontent.com";
const YOUR_CLIENT_SECRET = "lEshPCDKSzkDeAL45xormMd8";
// const YOUR_REDIRECT_URL = "https://youtube-assistant.herokuapp.com/oauthcallback/";
const YOUR_REDIRECT_URL = "http://localhost:2000/oauthcallback/";
const SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'];

const oauth2Client = new google.auth.OAuth2(
  YOUR_CLIENT_ID,
  YOUR_CLIENT_SECRET,
  YOUR_REDIRECT_URL
);  

const transporter =  nodemailer.createTransport(sendgridTransport({
  auth: {
  api_key: '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'    
  }
}));

const service = google.youtube('v3');

function formatNumber(num) {
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

agent.intent('Default Welcome Intent', (conv) => {
  if(!conv.user.last.seen) {      //First time user's
    conv.ask('Hi, welcome to your YouTube Assistant.  \nI can give you latest updates about your YouTube channel or about your last video uploaded.  \nFor a demo, let say I have a YouTube channel "shivurocks".  \nAnd I want updates about my last video uploaded. So this is what I get.');
    conv.ask(new BasicCard({
      image: new Image({
        url: `https://i.ytimg.com/vi/u-zo07xOskM/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLC4DahnW-iJfKfW3m9r1HQMGiDIdQ`,
        alt: 'shivam sharma',
      }),
      title: 'Demo of My Red Channel',
      subtitle: `08-06-2019`,
      text:'Views : 10,000  \nLikes : 5,000  \nComments : 2,000  \nDislikes : 50',
      buttons: new Button({
        title: 'Link to this video ...',
        url: 'https://www.youtube.com/watch?v=u-zo07xOskM'
      })
    })); 
    conv.ask('Your video  "Demo of My Red Channel" has got:  \n10,000 views  \n5,000 likes  \n2,000 comments and  \n50 dislikes.  \nIn order to get connected please say Sign In');
    conv.ask(new Suggestions(['Sign In','Demo']));
  } else {                       //Old users
    const {payload} = conv.user.profile;
    if(!payload) {               
      conv.ask('Hey, welcome back to your YouTube Assistant. \nAs I can see you are not Signed In ');
      conv.ask('To continue please say Sign In');
      conv.ask(new Suggestions(['Sign In','Demo','Help']));
    } else {
      // make a get(payload.email) request to the database   
      return db.collection('users').doc(`${payload.email}`).get().then((doc) => {
        let data = doc.data();
        // check for youtube access token
        if(data.token === null) {
          // if access not granted : ask for youtube access and provide link          
          let token = {
            email: `${payload.email}`
          };
    
          let state = jwt.sign(token, '123abc');
    
          let url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            response_type: 'code',
            scope: SCOPES,
            state: `${state}`
          });

          let hasScreen = conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
          let hasWebBrowser = conv.surface.capabilities.has('actions.capability.WEB_BROWSER');

          let screenAvailable = conv.available.surfaces.capabilities.has('actions.capability.SCREEN_OUTPUT');
          let browserAvailable = conv.available.surfaces.capabilities.has('actions.capability.WEB_BROWSER');

          if(hasScreen && hasWebBrowser) {
            conv.ask(`Hey ${data.name} !  \nWelcome back to your YouTube Assistant.  \nAs I can see you have not given me an access to read your YouTube data.`);
            conv.ask('Please go to the following link, in order to continue with me.');
            conv.close(new BasicCard({
              text:'In order to give me access to **Read** your Youtube data',
              buttons: new Button({
                title: 'Go to this link ...',
                url: `${url}`
              })
            }));
          } else if(screenAvailable && browserAvailable) {
            let context = `Hey ${data.name} !  \nWelcome back to your YouTube Assistant.  \nAs I can see you have not given me an access to read your YouTube data.  \nAlso you don\'t have a Web browser on this device.  \nTo provide you a YouTube Access link`;
            let notification = 'YouTube Access Link';
            let capabilities = ['actions.capability.WEB_BROWSER','actions.capability.SCREEN_OUTPUT'];
            conv.ask(new NewSurface({context, notification, capabilities}));
          } else {
            // send link via email
            conv.ask(`Hey ${data.name} !  \nWelcome back to your YouTube Assistant.  \nAs I can see you have not given me an access to read your YouTube data.  \nAlso you don\'t have a Web browser on this device. So I have mailed you the link.`);
            conv.close('Please go to that link and give me access to Read your Youtube data, in order to continue with me.');
            return transporter.sendMail({
              to: `${payload.email}`,
              from: 'youtube-assistant.herokuapp.com',
              subject: 'YouTube Access Link',
              html: `<h1>Pleas go to this link, in order to continue with me.</h1>
              <a href="${url}">YouTube Access Link</a>
              `
            }).catch(e => console.log(e));
          }
        } else {
          // if access granted : normal flow
          conv.data.token = data.token;
          conv.ask(`Hey ${data.name} !  \nWelcome back to your YouTube Assistant.  \nHow may I help you...`);
          conv.ask(new Suggestions(['Video Reports','Channel Reports','Demo','Help']));
        }
      }).catch((err) => {
        conv.close('Sorry, some error occured, please try again later');
      });
    }
  }
});

agent.intent('ask_for_sign_in', (conv) => {
  const {payload} = conv.user.profile;
  if(!payload){
    conv.ask(new SignIn('In order to get personalised assistance'));
  } else {
    conv.ask('I can see, you are already Signed In');
    conv.ask('So you can ask me about your channel or video reports.  \nOr probably ask for a demo!');
    conv.ask(new Suggestions(['Video Reports','Channel Reports','Demo','Help']));
  }
})

agent.intent('Get Signin', (conv, params, signin) => {
  if (signin.status === 'OK') {
    const {payload} = conv.user.profile;  
    let data = {
      name: `${payload.name}`,
      picture: `${payload.picture}`,
      token: null
    };
    return db.collection('users').doc(`${payload.email}`).set(data).then((res) => {      
      //Create url for the given email
      let token = {
        email: `${payload.email}`
      };

      let state = jwt.sign(token, '123abc');

      let url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        response_type: 'code',
        scope: SCOPES,
        state: `${state}`
      });

      let hasScreen = conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
      let hasWebBrowser = conv.surface.capabilities.has('actions.capability.WEB_BROWSER');

      let screenAvailable = conv.available.surfaces.capabilities.has('actions.capability.SCREEN_OUTPUT');
      let browserAvailable = conv.available.surfaces.capabilities.has('actions.capability.WEB_BROWSER');

      if(hasScreen && hasWebBrowser) {
        conv.ask('I got your account details.  \nNow one last step left.  \nTo get authorised from youtube');
        conv.ask('Please go to the following link, in order to continue with me.');
        conv.close(new BasicCard({
          text:'In order to give me access to **Read** your Youtube data',
          buttons: new Button({
            title: 'Go to this link ...',
            url: `${url}`
          })
        }));
      } else if(screenAvailable && browserAvailable) {
        let context = `I got your account details.  \nNow one last step left.  \nTo get authorised from youtube  \nAs you don\'t have a Web browser on this device.  \nTo provide you a YouTube Access link`;
        let notification = 'YouTube Access Link';
        let capabilities = ['actions.capability.WEB_BROWSER','actions.capability.SCREEN_OUTPUT'];
        conv.ask(new NewSurface({context, notification, capabilities}));
      } else {
        // send link via email
        conv.ask(`I got your account details.  \nNow one last step left.  \nTo get authorised from youtube.  \nAs you don\'t have a Web browser on this device. So I have mailed you the link.`);
        conv.close('Please go to that link and give me an access to Read your Youtube data, in order to continue with me.');
        return transporter.sendMail({
          to: `${payload.email}`,
          from: 'youtube-assistant.herokuapp.com',
          subject: 'YouTube Access Link',
          html: `<h1>Pleas go to this link, in order to continue with me.</h1>
          <a href="${url}">YouTube Access Link</a>
          `
        }).catch(e => console.log(e));
      } 
    }).catch((err) => {
      conv.close('Sorry, some error occured, please try again later');
    });
    } else {
      conv.close('Getting Signed In, is an esential part to continue.  \nAnd remember you can always ask for a demo...');
    }
});

agent.intent('new_surface_intent', (conv, input, newSurface) => {
  const {payload} = conv.user.profile;  
  
  let token = {
    email: `${payload.email}`
  };

  let state = jwt.sign(token, '123abc');

  let url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    response_type: 'code',
    scope: SCOPES,
    state: `${state}`
  });

  if (newSurface.status === 'OK') {
    conv.ask('Please go to the following link, in order to continue with me.');
    conv.close(new BasicCard({
      text:'In order to give me access to **Read** your Youtube data',
      buttons: new Button({
        title: 'Go to this link ...',
        url: `${url}`
      })
    }));

  } else {
    conv.ask(`Ok, I understand. So I have mailed you the link.`);
    conv.close('Please go to that link and give me an access to Read your Youtube data, in order to continue with me.');
    return transporter.sendMail({
      to: `${payload.email}`,
      from: 'youtube-assistant.herokuapp.com',
      subject: 'YouTube Access Link',
      html: `<h1>Pleas go to this link, in order to continue with me.</h1>
      <a href="${url}">YouTube Access Link</a>
      `
    }).catch(e => console.log(e));
  }
});

agent.intent('demo', (conv) => {
  const {payload} = conv.user.profile;  

  conv.ask('For a demo, let say I have a YouTube channel "shivurocks".  \nAnd I want updates about my last video uploaded. So this is what I get.');
  conv.ask(new BasicCard({
    image: new Image({
      url: `https://i.ytimg.com/vi/u-zo07xOskM/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLC4DahnW-iJfKfW3m9r1HQMGiDIdQ`,
      alt: 'shivam sharma',
    }),
    title: 'Demo of My Red Channel',
    subtitle: `08-06-2019`,
    text:'Views : 10,000  \nLikes : 5,000  \nComments : 2,000  \nDislikes : 50',
    buttons: new Button({
      title: 'Link to this video ...',
      url: 'https://www.youtube.com/watch?v=u-zo07xOskM'
    })
  }));
  if(!payload) {
    conv.ask('Your video  "Demo of My Red Channel" has got:  \n10,000 views  \n5,000 likes  \n2,000 comments and  \n50 dislikes.  \nIn order to get connected please say Sign In');
  } else {
    conv.ask('Your video  "Demo of My Red Channel" has got:  \n10,000 views  \n5,000 likes  \n2,000 comments and  \n50 dislikes.  \nSo how can I help you?');
    conv.ask(new Suggestions(['Video Reports','Channel Reports','Help']));
  }
});

agent.intent('channel', (conv) => {
  const {payload} = conv.user.profile;  
  if(!payload) {
    conv.ask('Sure! But in order to identify your YouTube channel I want you to Sign In');
    conv.ask('To continue please say Sign In');
    conv.ask(new Suggestions(['Sign In','Demo','Help']));
  } else {
    let token = conv.data.token;

    // set auth for the user
    oauth2Client.setCredentials(token);

    // if access token gets expired, renew it from the refresh token
    oauth2Client.on('tokens', (tokens) => {
      // update the database with the new access token and its new expiry date
      let access_token = tokens.access_token;
      let expiry_date = tokens.expiry_date;
      db.collection('users').doc(`${payload.email}`).update({
        'token.access_token': access_token,
        'token.expiry_date': expiry_date
      })
    });

    // making request to youtube data api with auth
    return service.channels.list({
      auth: oauth2Client,
      part: 'snippet,statistics',
      // mine: true
      id: 'UCLNgu_OupwoeESgtab33CCw'
    }).then((result) => {
      let data = result.data.items[0];

      conv.ask('Sure!');
      
      conv.ask(new BasicCard({
        image: new Image({
          url: data.snippet.thumbnails.high.url,
          alt: data.snippet.title,
        }),
        title: data.snippet.title,
        subtitle:  `since: ${moment(data.snippet.publishedAt).format("Do MMM YYYY")}`,
        text:  `Subscribers: ${formatNumber(data.statistics.subscriberCount)}  \nVideos: ${formatNumber(data.statistics.videoCount)}  \nViews: ${formatNumber(data.statistics.viewCount)}`,
        buttons: new Button({
          title: 'Link to the channel',
          url: `https://www.youtube.com/channel/${data.id}`,
        }),
        display: 'CROPPED',
      }));

      conv.close(`Your YouTube channel "${data.snippet.title}" is currently having :-  \n${formatNumber(data.statistics.subscriberCount)} subscribers  \n${formatNumber(data.statistics.videoCount)} videos and  \n${formatNumber(data.statistics.viewCount)} views`);
    }).catch((err) => {
      if(err.data.error.errors[0].reason === 'forbidden') {
        conv.close('YouTube access has removed. Please get authorized to use my services');
      } else if(err.data.error.errors[0].reason === 'quotaExceeded') {
        conv.close('Data request limit exceeded for the day. Please try again tommorow ...');
      } else {
        conv.close('oops! some glitch occurred. Please try again in few seconds.');
      }
    });
  }
});

agent.intent('video', (conv) => {
  const {payload} = conv.user.profile;  
  if(!payload) {
    conv.ask('Sure! But in order to identify your YouTube channel I want you to Sign In');
    conv.ask('To continue please say Sign In');
    conv.ask(new Suggestions(['Sign In','Demo','Help']));
  } else {
    let token = conv.data.token;

    // set auth for the user
    oauth2Client.setCredentials(token);

    // if access token gets expired, renew it from the refresh token
    oauth2Client.on('tokens', (tokens) => {
      // update the database with the new access token and its new expiry date
      let access_token = tokens.access_token;
      let expiry_date = tokens.expiry_date;
      db.collection('users').doc(`${payload.email}`).update({
        'token.access_token': access_token,
        'token.expiry_date': expiry_date
      })
    });
    //perform youtube data api request
    let playlistId = conv.user.storage.playlistId;

    if(!playlistId) {
      return service.playlistItems.list({
        auth: oauth2Client,
        part: 'snippet',
        maxResults: 1,
        playlistId 
      }).then((videos) => {
        let data = videos.data.items[0];
        if(!data) {
          return conv.close('Sorry, you have not uploaded any video yet!');
        }
        let date = moment(data.snippet.publishedAt).format("Do MMM YYYY");
        let title = data.snippet.title;
        let thumbnail = data.snippet.thumbnails.maxres.url || data.snippet.thumbnails.standard.url || data.snippet.thumbnails.high.url;
        let videoId = data.snippet.resourceId.videoId;
        return service.videos.list({
          auth: oauth2Client,
          part: 'statistics',
          id: videoId
        }).then((video) => {
          let data = video.data.items[0];

          conv.ask('Sure!');

          conv.ask(new BasicCard({
            image: new Image({
              url: thumbnail,
              alt: title,
            }),
            title: title,
            subtitle: date,
            text:  `Views : ${formatNumber(data.statistics.viewCount)}  \nLikes : ${formatNumber(data.statistics.likeCount)}  \nComments : ${formatNumber(data.statistics.commentCount)}  \nDislikes : ${formatNumber(data.statistics.dislikeCount)}`,
            buttons: new Button({
              title: 'Link to the Video',
              url: `https://www.youtube.com/watch?v=${videoId}`,
            }),
            display: 'CROPPED',
          }));

          conv.close(`Your video  "${title}" has got :-  \n${formatNumber(data.statistics.viewCount)} Views  \n${formatNumber(data.statistics.likeCount)} Likes  \n${formatNumber(data.statistics.commentCount)} Comments and  \n${formatNumber(data.statistics.dislikeCount)} Dislikes.`)
        })
      })

    } else {
      return service.channels.list({
        auth: oauth2Client,
        part: 'contentDetails',
        // mine: true
        id: 'UCW75jYjikWk74lCyxeg1JVws'
      }).then((result) => {
        let data = result.data.items[0];
        let playlistId = data.contentDetails.relatedPlaylists.uploads;
        conv.user.storage.playlistId = playlistId;
        return service.playlistItems.list({
          auth: oauth2Client,
          part: 'snippet',
          maxResults: 1,
          playlistId 
        }).then((videos) => {
          let data = videos.data.items[0];
          if(!data) {
            return conv.close('Sorry, you have not uploaded any video yet!');
          }          
          let date = moment(data.snippet.publishedAt).format("Do MMM YYYY");
          let title = data.snippet.title;
          let thumbnail = data.snippet.thumbnails.high.url;
          // if(data.snippet.thumbnails.maxres.url) {
          //   thumbnail = data.snippet.thumbnails.maxres.url;
          // } else if(data.snippet.thumbnails.standard.url) {
          //   thumbnail = data.snippet.thumbnails.standard.url;
          // } else {
          //   thumbnail = data.snippet.thumbnails.high.url; 
          // }
          let videoId = data.snippet.resourceId.videoId;
          return service.videos.list({
            auth: oauth2Client,
            part: 'statistics',
            id: videoId
          }).then((video) => {
            let data = video.data.items[0];

            conv.ask('Sure!');

            conv.ask(new BasicCard({
              image: new Image({
                url: thumbnail,
                alt: title,
              }),
              title: title,
              subtitle: date,
              text:  `Views : ${formatNumber(data.statistics.viewCount)}  \nLikes : ${formatNumber(data.statistics.likeCount)}  \nComments : ${formatNumber(data.statistics.commentCount)}  \nDislikes : ${formatNumber(data.statistics.dislikeCount)}`,
              buttons: new Button({
                title: 'Link to the Video',
                url: `https://www.youtube.com/watch?v=${videoId}`,
              }),
              display: 'CROPPED',
            }));

            conv.close(`Your video  "${title}" has got :-  \n${formatNumber(data.statistics.viewCount)} Views  \n${formatNumber(data.statistics.likeCount)} Likes  \n${formatNumber(data.statistics.commentCount)} Comments and  \n${formatNumber(data.statistics.dislikeCount)} Dislikes.`)
          })
        })
      })      
    }
  }
});

app.post('/', agent);

app.get('/oauthcallback/', (req, res) => {
  var state = req.query.state;
  var code = req.query.code; 
  var error = req.query.error;

  if(state && code && !error) {
    let {email} = jwt.verify(state, '123abc');
    db.collection('users').doc(`${email}`).get().then((doc) => {
      if(!doc.exists){
        return res.send('Account does not exists ...');
      }
      let data = doc.data();
      if(data.token !== null) {
        return res.send('Access to this account already exists');
      }
      oauth2Client.getToken(code).then((result) => {
        let token = result.tokens;
        db.collection('users').doc(`${email}`).update({token}).then(() => {
          res.send('Access granted Succesfully ...');
        });
      });
    }).catch((err) => {
      res.send('error getting the document' + err);
    });
  } else if(state && (error === 'access_denied')) {
    res.send('some error occured or probably access not given');
  } else {
    res.send('your are not authorized to this page');
  }
});

var port = process.env.PORT || 2000;

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});