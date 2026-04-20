require('dotenv').config();

const crypto = require('crypto');
const rp = require('request-promise');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const passport = require('passport');
const authJwtController = require('./auth_jwt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const User = require('./Users');
const Movie = require('./Movies');
const Review = require('./models/Review');

const app = express();

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());
require('./auth_jwt');

const router = express.Router();

const GA_TRACKING_ID = process.env.GA_KEY;

function trackDimension(category, action, label, value, dimension, metric) {
  const options = {
    method: 'GET',
    url: 'https://www.google-analytics.com/collect',
    qs: {
      v: '1',
      tid: GA_TRACKING_ID,
      cid: crypto.randomBytes(16).toString('hex'),
      t: 'event',
      ec: category,
      ea: action,
      el: label,
      ev: value,
      cd1: dimension,
      cm1: metric
    },
    headers: { 'Cache-Control': 'no-cache' }
  };

  return rp(options);
}

// SIGNUP
router.post('/signup', async (req, res) => {
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({
      success: false,
      msg: 'Please include both username and password to signup.'
    });
  }

  try {
    const user = new User({
      name: req.body.name,
      username: req.body.username,
      password: req.body.password
    });

    await user.save();

    res.status(201).json({
      success: true,
      msg: 'Successfully created new user.'
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A user with that username already exists.'
      });
    }

    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.'
    });
  }
});

// SIGNIN
router.post('/signin', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username })
      .select('name username password');

    if (!user) {
      return res.status(401).json({
        success: false,
        msg: 'Authentication failed. User not found.'
      });
    }

    const isMatch = await user.comparePassword(req.body.password);

    if (isMatch) {
      const userToken = {
        id: user._id,
        username: user.username
      };

      const token = jwt.sign(userToken, process.env.SECRET_KEY, {
        expiresIn: '1h'
      });

      return res.json({
        success: true,
        token: token
      });
    }

    return res.status(401).json({
      success: false,
      msg: 'Authentication failed. Incorrect password.'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.'
    });
  }
});

// MOVIES
router.route('/movies')

  // GET all movies sorted by average rating descending
  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const aggregate = [
        {
          $lookup: {
            from: 'reviews',
            localField: '_id',
            foreignField: 'movieId',
            as: 'movieReviews'
          }
        },
        {
          $addFields: {
            avgRating: { $avg: '$movieReviews.rating' }
          }
        },
        {
          $sort: { avgRating: -1 }
        }
      ];

      const movies = await Movie.aggregate(aggregate);
      res.json(movies);
    } catch (err) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving movies'
      });
    }
  })

  // POST create movie
  .post(authJwtController.isAuthenticated, async (req, res) => {
    if (!req.body.title || !req.body.actors || req.body.actors.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Movie must contain title and at least one actor'
      });
    }

    try {
      const movie = new Movie(req.body);
      await movie.save();

      res.status(201).json({
        success: true,
        movie
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: 'Error saving movie'
      });
    }
  });

// EXTRA CREDIT: SEARCH MOVIES
router.post('/movies/search', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const { search } = req.body;

    if (!search || search.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search term is required'
      });
    }

    const aggregate = [
      {
        $match: {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { 'actors.actorName': { $regex: search, $options: 'i' } }
          ]
        }
      },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'movieId',
          as: 'movieReviews'
        }
      },
      {
        $addFields: {
          avgRating: { $avg: '$movieReviews.rating' }
        }
      },
      {
        $sort: { avgRating: -1 }
      }
    ];

    const movies = await Movie.aggregate(aggregate);
    res.json(movies);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: err.message
    });
  }
});

// MOVIE DETAIL
router.route('/movies/:id')

  // GET one movie with avgRating + reviews
  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const movieId = req.params.id;

      if (!mongoose.Types.ObjectId.isValid(movieId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid movie ID'
        });
      }

      const aggregate = [
        {
          $match: { _id: new mongoose.Types.ObjectId(movieId) }
        },
        {
          $lookup: {
            from: 'reviews',
            localField: '_id',
            foreignField: 'movieId',
            as: 'movieReviews'
          }
        },
        {
          $addFields: {
            avgRating: { $avg: '$movieReviews.rating' }
          }
        }
      ];

      const result = await Movie.aggregate(aggregate);

      if (!result.length) {
        return res.status(404).json({
          success: false,
          message: 'Movie not found'
        });
      }

      return res.json(result[0]);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Error retrieving movie',
        error: err.message
      });
    }
  })

  // PUT update movie
  .put(authJwtController.isAuthenticated, async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid movie ID'
        });
      }

      const movie = await Movie.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );

      if (!movie) {
        return res.status(404).json({
          success: false,
          message: 'Movie not found'
        });
      }

      res.json({
        success: true,
        message: 'Movie updated',
        movie
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: 'Update failed',
        error: err.message
      });
    }
  })

  // DELETE movie
  .delete(authJwtController.isAuthenticated, async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid movie ID'
        });
      }

      const movie = await Movie.findByIdAndDelete(req.params.id);

      if (!movie) {
        return res.status(404).json({
          success: false,
          message: 'Movie not found'
        });
      }

      res.json({
        success: true,
        message: 'Movie deleted'
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: 'Delete failed',
        error: err.message
      });
    }
  });

// REVIEWS
router.post('/reviews', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const { movieId, review, rating } = req.body;

    if (!mongoose.Types.ObjectId.isValid(movieId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid movie ID'
      });
    }

    const movie = await Movie.findById(movieId);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    const newReview = new Review({
      movieId,
      username: req.user.username,
      review,
      rating
    });

    await newReview.save();

    trackDimension(
      movie.genre || 'Unknown',
      'post /reviews',
      'API Request for Movie Review',
      '1',
      movie.title,
      '1'
    ).catch(err => console.log('GA Error:', err.message));

    res.json({ message: 'Review created!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET reviews for one movie
router.get('/reviews/:movieId', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const movieId = req.params.movieId;

    if (!mongoose.Types.ObjectId.isValid(movieId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid movie ID'
      });
    }

    const reviews = await Review.find({ movieId });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/', router);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;