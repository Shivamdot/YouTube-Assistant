// const pyramid = (h) => {
//     let max = (h * 2) - 1;
//     for (let i = 1; i <= max; i += 2) {
//         let dif = max - i;
//         let sideSpace = dif / 2;
//         let row = "";
//         for (let j = 0; j < (sideSpace + i); j++) {
//             if(j < sideSpace) {
//                 row = row.concat(" ");
//                 continue;
//             }
//             row = row.concat("|");
//         }
//         console.log(row);
//     }
// }
// // pyramid(4);
// let x = 0;

// setInterval(() => {
//     pyramid(x);
//     x++;    
// }, 10);






// let items = [];

// let data = items[0];

// if(!data) {
//     console.log('no data');
// }

//UU_bJt7DbRio8fPYYQ6nMAJA

// date = '2013-08-03T02:00:00Z';

// console.log(date.substring(0, 10));




// const nodemailer = require('nodemailer');
// const sendgridTransport = require('nodemailer-sendgrid-transport');


// const transporter =  nodemailer.createTransport(sendgridTransport({
//   auth: {
//   api_key: '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'    
//   }
// }));

// transporter.sendMail({
//   to: `${payload.email}`,
//   from: 'MyRedChannel@gmail.com',
//   subject: 'YouTube Access Link',
//   html: `<h1>Pleas go to this link, in order to continue with me.</h1>
//   <a href="${url}">YouTube Access Link</a>
//   `
// }).then(() => {
//   console.log('send...')
// }).catch(e => console.log(e));

const jwt = require('jsonwebtoken');

var token = {
  email: 'shivam231198@gmail.com'
};

// var state = jwt.sign(token, '123abc');
// console.log(state);

let x = '1eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InNoaXZhbTIzMTE5OEBnbWFpbC5jb20iLCJpYXQiOjE1NTk5Mjc1MDh9.GGr1QyB-cfkIBaGzo_2XSLbpTE9HIQ0XJBJaKr39NN0';


jwt.verify(x, '123abc', function(err, result) {
    if(err) {
        return console.log(err);
    }
    console.log(result);
})


// const admin = require('firebase-admin');
// var serviceAccount = require('./../serviceAccountKey.json');

// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount)
//     // databaseURL: "https://assistant-a4a97.firebaseio.com"
//   });


// var db = admin.firestore();

// db.settings({
//   timestampsInSnapshots: true
// });

// var id = '5l6ZXbFraF93e5mwLMpF';

// db.collection('users').doc(id).get().then(doc => {
//   console.log(doc.data());
// }).catch(e => console.log(e));

// var citiesRef = db.collection('cities');

// var setSf = citiesRef.doc('SF').set({
//   name: 'San Francisco', state: 'CA', country: 'USA',
//   capital: false, population: 860000
// });


