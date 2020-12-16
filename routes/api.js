const express = require('express');
const router = express.Router();
require('dotenv').config();

const CryptoJS = require("crypto-js");
const {AUTH_COOKIE_NAME, AUTH_COOKIE_SECRET} = require('../config');

const MongoClient = require('mongodb').MongoClient;
const uri = process.env.DB_URI;
const client = new MongoClient(uri, {useNewUrlParser: true, useUnifiedTopology: true});

client.connect(err => {
  if (err) {
    console.error(err);
  }
});

/** login auth */
router.post('/login', (req, res) => {
  const {email, password} = req.body;

  if (email && password) {
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (client.isConnected()) {
      const collection = client.db("reviews").collection("users");

      collection
        .findOne({email: cleanEmail, password: cleanPassword})
        .then((user) => {
          const cookieValue = CryptoJS.AES.encrypt(JSON.stringify(user.email), AUTH_COOKIE_SECRET).toString();

          res.status(202).cookie(AUTH_COOKIE_NAME, cookieValue, {maxAge: 7 * 24 * 3600000}).send();
        })
        .catch(() => {
          res.status(400).send('no such user');
        });
    } else {
      res.status(500).send('no connection to db');
    }
  } else {
    res.status(400).send('needed email and password');
  }
});

/** search in db */
router.get('/find', (req, res) => {
  const {
    album, group, rating, comment,
    perPage = 10, page = 1,
  } = req.query;

  /** prepare raw values */
  let perPagePrepared = +perPage;
  if (perPagePrepared > 999) {
    perPagePrepared = 999
  }
  /** end prepare raw values */

  const {email: userEmail} = req.user;
  const search = {
    u: userEmail
  };

  if (album) {
    search.a = {$regex: album.trim().toLowerCase(), $options: "gm"};
  }
  if (group) {
    search.g = {$regex: group.trim().toLowerCase(), $options: "gm"};
  }
  if (comment) {
    search.c = {$regex: comment.trim().toLowerCase(), $options: "gm"};
  }
  if (rating) {
    search.r = +rating;
  }

  if (client.isConnected()) {
    const collection = client.db("reviews").collection("reviews");

    collection
      .find(search)
      .sort({d: -1})
      .skip(page - 1)
      .limit(perPagePrepared)
      .toArray((err, docs) => {
        res.json(docs);
      });
  } else {
    res.status(500).send('no connection to db');
  }
});

// router.get('/import', function (req, res, next) {
//   console.log('starting import...');
//   const reviews = require('../json/reviews.json');
//
//   const response = Object.entries(reviews).map(([id, data]) => {
//     return {
//       a: data.album,
//       g: data.group,
//       c: data.comment,
//       r: data.rating,
//       d: data.date.value._seconds,
//       u: data.author,
//     }
//   });
//
//   client.connect(err => {
//     const collection = client.db("reviews").collection("reviews");
//
//     console.log('collection',collection);
//
//     collection
//       .insertMany(response)
//       .then(() => {
//         console.log('success all');
//         res.json(response);
//       })
//       .catch((e) => {
//         console.error('error import:', e);
//         res.json('error import:');
//       })
//       .finally(() => {
//         client.close();
//       });
//   });
// });

module.exports = router;
