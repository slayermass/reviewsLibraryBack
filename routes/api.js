const express = require('express');
const router = express.Router();
require('dotenv').config();

const CryptoJS = require("crypto-js");
const {AUTH_COOKIE_NAME, AUTH_COOKIE_SECRET} = require('../config');

const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectId;
const uri = process.env.DB_URI;
const client = new MongoClient(uri, {useNewUrlParser: true, useUnifiedTopology: true});

client.connect(err => {
  if (err) {
    console.error(err);
  }
});

/** check if connection to db is active */
const isDbConnected = (res) => {
  if (client.isConnected()) {
    return true;
  } else {
    res.status(500).send('no connection to db');
    return false
  }
}

/** check auth */
router.get('/me', (req, res) => {
  res.status(200).send({email: req.user.email});
})

/** login auth */
router.post('/login', (req, res) => {
  const {email, password} = req.body;

  if (email && password) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (client.isConnected()) {
      const collection = client.db("reviews").collection("users");

      collection
        .findOne({email: cleanEmail, password: cleanPassword})
        .then((user) => {
          if (user) {
            const cookieValue = CryptoJS.AES.encrypt(JSON.stringify(user.email), AUTH_COOKIE_SECRET).toString();

            res.status(202).cookie(AUTH_COOKIE_NAME, cookieValue, {
              maxAge: 31 * 24 * 3600000,
              sameSite: 'none',
              secure: true,
            }).send('logged in');
          } else {
            res.status(400).send('no such user');
          }
        })
        .catch((e) => {
          res.status(500).send(e.toString());
        });
    }
  } else {
    res.status(400).send('needed email and password');
  }
});


router.post('/checkreview', (req, res) => {
  const {
    album, group, author,
  } = req.body;

  if (album && group && author) {
    if (isDbConnected(res)) {
      const collection = client.db("reviews").collection("reviews");

      collection.findOne({
        a: album,
        g: group,
        u: author,
      })
        .then((response) => {
          res.send({
            found: !!response
          });
        })
        .catch((e) => {
          console.error('errer', e);
          res.status(500).send(e);
        })
    }
  } else {
    res.status(400).send('no required parameters to create');
  }
});

/** create a review */
router.post('/review', (req, res) => {
  const {
    album, group, rating, comment, author, date,
  } = req.body;

  // TODO more validation (trim)
  if (album && group && rating && comment && author && date) {
    if (isDbConnected(res)) {
      const collection = client.db("reviews").collection("reviews");

      collection.insertOne({
        a: album,
        g: group,
        r: +rating,
        c: comment,
        u: author,
        d: date
      })
        .then((response) => {
          res.send({
            id: response.insertedId
          })
        })
        .catch((e) => {
          console.error('errer', e);
          res.status(500).send(e);
        })
    }
  } else {
    res.status(400).send('no required parameters to create');
  }
});


/** update a review */
router.put('/review/:id', (req, res) => {
  const {
    album, group, rating, comment, author, date,
  } = req.body;
  const {id} = req.params;

  // TODO more validation
  if (album && group && rating && comment && author && date && id) {
    if (isDbConnected(res)) {
      const collection = client.db("reviews").collection("reviews");

      collection.findOneAndUpdate({_id: ObjectId(id)}, {
        $set: {
          a: album,
          g: group,
          r: +rating,
          c: comment,
          u: author,
          d: date
        },
      })
        .then((response) => {
          res.send(response.value)
        })
        .catch((e) => {
          res.status(500).send(e);
        })
    }
  } else {
    res.status(400).send('no required parameters to create');
  }
});

/**
 * search in db a review
 * @returns model | null
 */
router.get('/review/:id', (req, res) => {
  const {id} = req.params;

  if (isDbConnected(res)) {
    const collection = client.db("reviews").collection("reviews");

    collection
      .findOne({_id: ObjectId(id)})
      .then((model) => {
        res.json(model)
      })
      .catch(() => {
        res.status(400).send('review is not found');
      })
  }
});

/** search in db reviews list */
router.get('/reviews', (req, res) => {
  const {
    album, group, rating, comment, sort,
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
    u: userEmail,
  };
  let sortSearch = {};

  const prepareText = (name) => {
    return {$regex: name.trim().toLowerCase(), $options: "m"}
  }

  if (album) {
    search.a = prepareText(album);
  }
  if (group) {
    search.g = prepareText(group);
  }
  if (comment) {
    search.c = prepareText(comment);
  }
  if (+rating) {
    search.r = +rating;
  }
  /** compound sort requires index */
  if (sort) {
    if (sort === 'dateDesc') {
      sortSearch.d = -1
    }
    if (sort === 'dateAsc') {
      sortSearch.d = 1;
    }
    if (sort === 'ratingAsc') {
      sortSearch.r = 1;
    }
    if (sort === 'ratingDesc') {
      sortSearch.r = -1;
    }
  } else {
    sortSearch.d = -1
  }

  if (isDbConnected(res)) {
    const collection = client.db("reviews").collection("reviews");

    const dataPromise = new Promise((resolve) => {
      collection
        .find(search)
        .sort(sortSearch)
        .skip((page - 1) * perPage)
        .limit(perPagePrepared)
        .toArray((err, docs) => {
          if (err) {
            resolve({error: err});
          } else {
            resolve({data: docs});
          }
        });
    });

    const amountPromise = collection.countDocuments(search)
      .catch(() => 0)

    Promise.all([
      dataPromise,
      amountPromise
    ])
      .then(([data, amount]) => {
        if (data.error) {
          res.status(500).send(data.error);
        } else {
          res.json({ data: data.data, amount });
        }
      })
  }
});

/** export data */
router.get('/export', function (req, res) {
  const collection = client.db("reviews").collection("reviews");

  new Promise((resolve, reject) => {
    collection
      .find()
      .toArray((err, docs) => {
        if (err) {
          reject(err);
        } else {
          resolve(docs);
        }
      });
  })
    .then((data) => {
      res.setHeader('Content-disposition', 'attachment; filename=export.json');
      res.setHeader('Content-type', 'application/json');
      res.write(JSON.stringify(data), () => {
        res.end();
      });
    })
    .catch((e) => {
      res.status(500).send(e.toString());
    });
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
//       d: new Date(data.date.value._seconds * 1000).toISOString(),
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
