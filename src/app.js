const express = require('express');
const {
  dialogflow,
  Image,
  SignIn,
  NewSurface,
  Suggestions,
  BasicCard,
  Button
} = require('actions-on-google');  
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const moment = require('moment');
const hbs = require('hbs');
const cors = require('cors');

const {db} = require('./db/firestore');
const {transporter} = require('./email/email');

var app = express();

app.use(cors());

app.use(bodyParser.json());

app.set('view engine', 'hbs');

app.use(express.static('public'));

const SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'];


// Connecting to the Dialogflow
var agent = dialogflow({
  debug: true,
  clientId: '122184330678-o5i7c2s7t4sdu2scg4n5b5b7tvellnkm.apps.googleusercontent.com'
});

// Simple format function
function formatNumber(num) {
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

// Welcone Intent
agent.intent('Default Welcome Intent', (conv) => {
  if(!conv.user.last.seen) {      //First time user's
    conv.ask('<speak> Hi, welcome to your YouTube Assistant.  \nI can provide latest updates <break time="200ms" /> about your YouTube channel <break time="300ms" /> or about your last video uploaded.  \nFor a demo, let say I have a YouTube channel "shivurocks".  \nAnd I want updates about my last video uploaded. So this is what I get. </speak>');
    conv.ask('<speak> Your video  "<emphasis level="moderate">Title of the Video</emphasis>" has got <break time="200ms" /> :-  \n10,000 Views <break time="300ms" />,  \n5,000 Likes <break time="300ms" />,  \n2,000 Comments <break time="300ms" /> and,  \n50 Dislikes <break time="500ms" />.  \nIn order to get connected please say Sign In </speak>');
    conv.ask(new BasicCard({
      image: new Image({
        url: `https://youtube-assistant.herokuapp.com/images/introdemo.jpg`,
        alt: 'title of the video',
      }),
      title: 'Title of the Video',
      subtitle: `1st Jun 2019`,
      text:'Views : 10,000  \nLikes : 5,000  \nComments : 2,000  \nDislikes : 50',
      buttons: new Button({
        title: 'Link to the video',
        url: 'https://youtube-assistant.herokuapp.com/'
      })
    })); 
    conv.ask(new Suggestions(['Sign In','Demo','Developer','Help']));
  } else {                       //Old users
    const {payload} = conv.user.profile;
    if(!payload) {               
      conv.ask('Hey, welcome back to your YouTube Assistant. \nAs I can see you are not Signed In.');
      conv.ask('To continue please say Sign In');
      conv.ask(new Suggestions(['Sign In','Demo','Help','Developer']));
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
            conv.ask(`<speak> Hey ${data.name} !  \nWelcome back to your YouTube Assistant.  \nAs I can see <break time="200ms" /> you have not given me an access to read your YouTube data. </speak>`);
            conv.ask('Please go to the following link, in order to continue with me.');
            conv.close(new BasicCard({
              text:'In order to give me access to **Read** your Youtube data',
              buttons: new Button({
                title: 'Go to this link ...',
                url: `${url}`
              })
            }));
          } else if(screenAvailable && browserAvailable) {
            let context = `Hey ${data.name} !  \nWelcome back to your YouTube Assistant.  \nAs I can see you have not given me an access to read your YouTube data.  \nAlso you don\'t have a Web browser on this device.  \nTo provide you a YouTube Access link.`;
            let notification = 'YouTube Access Link';
            let capabilities = ['actions.capability.WEB_BROWSER','actions.capability.SCREEN_OUTPUT'];
            conv.ask(new NewSurface({context, notification, capabilities}));
          } else {
            // send link via email
            conv.ask(`<speak> Hey ${data.name} !  \nWelcome back to your YouTube Assistant.  \nAs I can see <break time="200ms" /> you have not given me an access to read your YouTube data.  \nAlso <break time="200ms" /> you don\'t have a Web browser on this device. So I have mailed you the link.</speak>`);
            conv.close('Please go to that link and give me an access to Read your Youtube data, in order to continue with me.');
            return transporter.sendMail({
              to: `${payload.email}`,
              from: 'My-YouTuber-Channel@youtube-assistant.herokuapp.com',
              subject: 'YouTube Access Link',
              html: compiledTemplate.render({url})
            }).catch(e => console.log(e));
          }
        } else {
          // if access granted : normal flow
          conv.data.token = data.token;
          conv.ask(`Hey ${data.name} !  \nWelcome back to your YouTube Assistant.  \nHow may I help you...`);
          conv.ask(new Suggestions(['Video Reports','Channel Reports','Demo','Help','Developer']));
        }
      }).catch((err) => {
        conv.close('Sorry, some error occured, please try again later');
      });
    }
  }
});

// Ask For Sign In Intent
agent.intent('ask_for_sign_in', (conv) => {
  const {payload} = conv.user.profile;
  if(!payload){
    conv.ask(new SignIn('In order to get personalised assistance'));
  } else {
    conv.ask('I can see, you are already Signed In');
    conv.ask('So you can ask me about your channel or video reports.  \nOr probably ask for a demo!');
    conv.ask(new Suggestions(['Video Reports','Channel Reports','Demo','Help','Developer']));
  }
})

// Sign In Response Intent
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
        conv.ask('I got your account details.  \nNow one last step left.  \nTo get authorised from youtube.');
        conv.ask('Please go to the following link, in order to continue with me.');
        conv.close(new BasicCard({
          text:'In order to give me access to **Read** your Youtube data',
          buttons: new Button({
            title: 'Go to this link ...',
            url: `${url}`
          })
        }));        
      } else if(screenAvailable && browserAvailable) {
        let context = `I got your account details.  \nNow one last step left.  \nTo get authorised from youtube.  \nAs you don\'t have a Web browser on this device.  \nTo provide you a YouTube Access link.`;
        let notification = 'YouTube Access Link';
        let capabilities = ['actions.capability.WEB_BROWSER','actions.capability.SCREEN_OUTPUT'];
        conv.ask(new NewSurface({context, notification, capabilities}));
      } else {
        // send link via email
        conv.ask(`I got your account details.  \nNow one last step left.  \nTo get authorised from youtube.  \nAs you don\'t have a Web browser on this device. So I have mailed you the link.`);
        conv.close('Please go to that link and give me an access to Read your Youtube data, in order to continue with me.');
        return transporter.sendMail({
          to: `${payload.email}`,
          from: 'My-YouTuber-Channel@youtube-assistant.herokuapp.com',
          subject: 'YouTube Access Link',
          html: compiledTemplate.render({url})
        }).catch(e => console.log(e));
      } 
    }).catch((err) => {
      conv.close('Sorry, some error occured, please try again later');
    });
    } else {
      conv.close('Getting Signed In, is an esential part to continue.  \nAnd remember you can always ask for a demo...');
      conv.close(new BasicCard({
        text:'To know more about the application, you may visit to our website.',
        buttons: new Button({
          title: 'Visit Website',
          url: 'https://youtube-assistant.herokuapp.com/'
        })
      }));      
    }
});

// New Surface Intent
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
      from: 'My-YouTuber-Channel@youtube-assistant.herokuapp.com',
      subject: 'YouTube Access Link',
      html: compiledTemplate.render({url})
    }).catch(e => console.log(e));
  }
});

// Demo Intent
agent.intent('demo', (conv) => {
  const {payload} = conv.user.profile;  

  conv.ask('For a demo, let say I have a YouTube channel "shivurocks".  \nAnd I want updates about my last video uploaded. So this is what I get.');
  
  if(!payload) {
    conv.ask('<speak> Your video "<emphasis level="moderate">Title of the Video</emphasis>" has got <break time="200ms" /> :-  \n10,000 Views <break time="300ms" />,  \n5,000 Likes <break time="300ms" />,  \n2,000 Comments <break time="300ms" /> and,  \n50 dislikes <break time="500ms" />.  \nIn order to get connected, please say Sign In </speak>');
    conv.ask(new Suggestions(['Sign In','Help','Developer']));
  } else {
    conv.ask('<speak> Your video "<emphasis level="moderate">Title of the Video</emphasis>" has got <break time="200ms" /> :-  \n10,000 Views <break time="300ms" />,  \n5,000 Likes <break time="300ms" />,  \n2,000 Comments <break time="300ms" /> and,  \n50 dislikes <break time="500ms" />.  \nSo, how can I help you ? </speak>');
    conv.ask(new Suggestions(['Video Reports','Channel Reports','Help','Developer']));
  }

  conv.ask(new BasicCard({
    image: new Image({
      url: 'https://youtube-assistant.herokuapp.com/images/introdemo.jpg',
      alt: 'title of the video',
    }),
    title: 'Title of the Video',
    subtitle: `1st Jun 2019`,
    text:'Views : 10,000  \nLikes : 5,000  \nComments : 2,000  \nDislikes : 50',
    buttons: new Button({
      title: 'Link to the video',
      url: 'https://youtube-assistant.herokuapp.com/'
    })
  }));
});

// Channel Intent
agent.intent('channel', (conv) => {
  const {payload} = conv.user.profile;  
  if(!payload) {
    conv.ask('Sure! But in order to identify your YouTube channel, I want you to Sign In');
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
      mine: true
    }).then((result) => {
      let data = result.data.items[0];

      conv.ask('<speak> Sure! <break time="200ms" /> </speak>');
      
      conv.close(`<speak> Your YouTube channel " <emphasis level="moderate">${data.snippet.title}</emphasis> " is currently having <break time="200ms" /> :-  \n${formatNumber(data.statistics.subscriberCount)} Subscribers <break time="300ms" />,  \n${formatNumber(data.statistics.videoCount)} Videos <break time="300ms" /> and  \n${formatNumber(data.statistics.viewCount)} Views </speak>`);

      conv.close(new BasicCard({
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
        })
      }));
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

// Get Latest Video Intent
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

    // if playlistId already known. (saves one step)
    if(playlistId) {
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
        let imgres = data.snippet.thumbnails.maxres || data.snippet.thumbnails.standard || data.snippet.thumbnails.high;
        let thumbnail = imgres.url;
        let videoId = data.snippet.resourceId.videoId;
        return service.videos.list({
          auth: oauth2Client,
          part: 'statistics',
          id: videoId
        }).then((video) => {
          let data = video.data.items[0];

          conv.ask('<speak> Sure! <break time="200ms" /> </speak>');

          conv.close(`<speak> Your video " <emphasis level="moderate">${title}</emphasis> " has got <break time="200ms" /> :-  \n${formatNumber(data.statistics.viewCount)} Views <break time="300ms" />,  \n${formatNumber(data.statistics.likeCount)} Likes <break time="300ms" />,  \n${formatNumber(data.statistics.commentCount)} Comments <break time="300ms" /> and  \n${formatNumber(data.statistics.dislikeCount)} Dislikes </speak>`);

          conv.close(new BasicCard({
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
        }).catch((err) => {
          if(err.data.error.errors[0].reason === 'forbidden') {
            conv.close('YouTube access has removed. Please get authorized to use my services');
          } else if(err.data.error.errors[0].reason === 'quotaExceeded') {
            conv.close('Data request limit exceeded for the day. Please try again tommorow ...');
          } else {
            conv.close('oops! some glitch occurred. Please try again in few seconds.');
          }
        });        
      }).catch((err) => {
        if(err.data.error.errors[0].reason === 'forbidden') {
          conv.user.storage.playlistId = null;
          conv.close('YouTube access has removed. Please get authorized to use my services');
        } else if(err.data.error.errors[0].reason === 'quotaExceeded') {
          conv.close('Data request limit exceeded for the day. Please try again tommorow ...');
        } else {
          conv.user.storage.playlistId = null;
          conv.close('oops! some glitch occurred. Please try again in few seconds.');
        }
      });

    } else {

      // else when playlistId is not known.
      return service.channels.list({
        auth: oauth2Client,
        part: 'contentDetails',
        mine: true
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
          let imgres = data.snippet.thumbnails.maxres || data.snippet.thumbnails.standard || data.snippet.thumbnails.high;
          let thumbnail = imgres.url;
          let videoId = data.snippet.resourceId.videoId;
          return service.videos.list({
            auth: oauth2Client,
            part: 'statistics',
            id: videoId
          }).then((video) => {
            let data = video.data.items[0];

            conv.ask('<speak> Sure! <break time="200ms" /> </speak>');

            conv.close(`<speak> Your video " <emphasis level="moderate">${title}</emphasis> " has got <break time="200ms" /> :-  \n${formatNumber(data.statistics.viewCount)} Views <break time="300ms" />,  \n${formatNumber(data.statistics.likeCount)} Likes <break time="300ms" />,  \n${formatNumber(data.statistics.commentCount)} Comments <break time="300ms" /> and  \n${formatNumber(data.statistics.dislikeCount)} Dislikes </speak>`);
  
            conv.close(new BasicCard({
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
          }).catch((err) => {
            if(err.data.error.errors[0].reason === 'forbidden') {
              conv.close('YouTube access has removed. Please get authorized to use my services');
            } else if(err.data.error.errors[0].reason === 'quotaExceeded') {
              conv.close('Data request limit exceeded for the day. Please try again tommorow ...');
            } else {
              conv.close('oops! some glitch occurred. Please try again in few seconds.');
            }
          });          
        }).catch((err) => {
          if(err.data.error.errors[0].reason === 'forbidden') {
            conv.close('YouTube access has removed. Please get authorized to use my services');
          } else if(err.data.error.errors[0].reason === 'quotaExceeded') {
            conv.close('Data request limit exceeded for the day. Please try again tommorow ...');
          } else {
            conv.close('oops! some glitch occurred. Please try again in few seconds.');
          }
        });
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
  }
});

// Help Intent
agent.intent('help', (conv) => {
  const {payload} = conv.user.profile;
  conv.ask('<speak> "My YouTuber Channel" is a Google Assistant app. Where I provide latest updates <break time="200ms" /> about your YouTube channel <break time="300ms" /> or about your last video uploaded.  \nYou may say Channel Reports or Video Reports for the same, respectively. </speak>');
  if(!payload) {
    conv.ask('To continue please say Sign In.  \nOr you can also ask for a demo!');
    conv.ask(new Suggestions(['Sign In','Demo','Developer']));
  } else {
    conv.ask('So how may I help you ?');
    conv.ask(new Suggestions(['Video Reports','Channel Reports','Demo','Developer']));
  }
});

// Fallback Intent
agent.intent('Default Fallback Intent', (conv) => {
  const {payload} = conv.user.profile;  
  if(!payload) {
    conv.ask(`Sorry, I didn't get that. You should say Sign In. Or you can also ask for a demo.`);
    conv.ask(new Suggestions(['Sign In','Demo','Help','Developer']));
  } else {
    conv.ask(`Sorry, I didn't get that.`);
    conv.ask('You can ask me about your channel or video reports.  \nOr probably ask for a demo!');
    conv.ask(new Suggestions(['Video Reports','Channel Reports','Demo','Help','Developer']));
  }
});

// Developer Intent
agent.intent('developer', (conv) => {

  conv.ask('<speak> I am Developed by "Mr Shivam Sharma". <break time="200ms" /> An Indian Developer, who has created me with Love. </speak>');

  conv.ask(new BasicCard({
    image: new Image({
      url: 'https://youtube-assistant.herokuapp.com/images/ShivamSharma.jpg',
      alt: 'shivam sharma',
    }),
    title: 'Shivam Sharma',
    subtitle: 'An Indian Developer',
    text:  `I am Developed by "Mr. Shivam Sharma". An Indian Developer, who has created me with Love.  \nTo get connected with him, you can find him on Instagram by the name "shivamdotcom"`,
    buttons: new Button({
      title: 'Connect with Me',
      url: `https://www.instagram.com/shivamdotcom/`,
    })
  }));

  conv.close('To get connected with him, you can find him on Instagram by the name "shivamdotcom"');
});


// ROUTES Starts Here...



app.get('/', (req, res) => {
  res.render('home.hbs');
});

app.post('/agent', agent);

app.get('/email', (req, res) => {
  // res.render('email.hbs');
  var url = 'https://youtube-assistant.herokuapp.com';
  transporter.sendMail({
    to: `shivam231198@gmail.com`,
    from: 'My-YouTuber-Channel@youtube-assistant.herokuapp.com',
    subject: 'YouTube Access Link',
    html: compiledTemplate.render({url})
  }).then(() => {
    res.redirect('/');
  }).catch(e => console.log(e));
});

app.get('/oauthcallback/', (req, res) => {
  var state = req.query.state;
  var code = req.query.code; 
  var error = req.query.error;

  if(state && code && !error) {
    jwt.verify(state, '123abc', (err, decoded) => {
      if(err) {
        return res.render('error.hbs', {
          msg1: 'Request got Cancelled',
          msg2: 'There is a problem reading your URL. Please try again.'
        });
      }

      let {email} = decoded;
      db.collection('users').doc(`${email}`).get().then((doc) => {
        if(!doc.exists){
          return res.render('error.hbs', {
            msg1: 'Account does Not Exists ...',
            email: email,
            msg2: 'Your Data has been removed from the Database.'
          });
        }
        let data = doc.data();
        if(data.token !== null) {
          return res.render('error.hbs', {
            msg1: 'Access to this Account already Exists ...',
            email: email,
            msg2: 'You can only link one channel to a single Email Id.'
          });
        }
        oauth2Client.getToken(code).then((result) => {
          let token = result.tokens;
          db.collection('users').doc(`${email}`).update({token}).then(() => {
            res.render('success.hbs', {
              msg1: 'Access granted Successfully ...',
              email: email,
              msg2: 'Now you can go to the app and get latest updates about your YouTube Channel.'
            });
          });
        });
      }).catch((err) => {
        res.render('alert.hbs', {
          msg1: 'Access got Denied ...',
          email: email,
          msg2: 'There is a problem while connecting to the database. Please try again after some time.'
        });        
      });
    });
  } else if(state && (error === 'access_denied')) {
    jwt.verify(state, '123abc', (err, decoded) => {
      if(err) {
        return res.render('error.hbs', {
          msg1: 'Request got Cancelled',
          msg2: 'There is a problem reading your URL. Please try again.'
        });
      }
      let {email} = decoded;
      res.render('alert.hbs', {
        msg1: 'Access got Denied ...',
        email: email,
        msg2: 'In order to use this application, it is nesessary to give your YouTube Data Access.'
      });
    });  
  } else {
    res.redirect('/');
  }
});

var port = process.env.PORT || 2000;

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});