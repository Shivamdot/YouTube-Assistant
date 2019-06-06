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
const bodyParser = require('body-parser');

var app = express();

app.use(bodyParser.json());

const agent = dialogflow({
    debug: true,
    clientId: '122184330678-o5i7c2s7t4sdu2scg4n5b5b7tvellnkm.apps.googleusercontent.com'
  });

const service = google.youtube('v3');

agent.intent('Default Welcome Intent', (conv) => {
  if(!conv.user.last.seen) {      //First time users
    conv.ask('Hi, welcome to your YouTube channel. I can tell your channel growth or provide a report about your last uploaded video.');
    conv.ask('As a demo, let say i have a youtube channel.');
  } else {                       //Old users
    const {payload} = conv.user.profile;
    if(!payload) {               
      conv.ask('Hey welcome back!\n As I can see you are not Signed In ');
      conv.ask('To continue please say Sign In');
    } else {
      conv.ask(`Hey ${payload.name}, welcome back!` + new BasicCard({
        text:'In order to give me access to **Read** your Youtube data',
        buttons: new Button({
          title: 'Go to this link...',
          url: 'https://github.com/Shivamdot'
        })
      }));
      // conv.ask(`This is your gmail id: ${payload.email}`);
      // conv.ask(); 
    }
  }
})

agent.intent('ask_for_sign_in', (conv) => {
  conv.ask(new SignIn('In order to get personalised assistance'));
})

agent.intent('Get Signin', (conv, params, signin) => {
  if (signin.status === 'OK') {
      const payload = conv.user.profile.payload;
      conv.close(`I got your account details, ${payload.name}. What do you want to do next? sir ji`);
    } else {
      conv.close(`I won't be able to save your data, but what do you want to do next?`);
    }
})


agent.intent('demo', (conv) => {
  conv.close('As a demo, let say i have a youtube channel.');
})



app.post('/', agent);

var port = process.env.PORT || 2000;

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});