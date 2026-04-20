# Assignment 5 – Movie App (MERN)

## Overview
This project is a full-stack **MERN application** that allows users to:
- Sign up and log in
- View top-rated movies
- See detailed movie information
- Submit reviews
- Search movies (extra credit)

It builds on Assignment 4 by adding a **React frontend** and integrating it with the API.

---

## Features
- JWT Authentication (Login / Signup)
- View movies sorted by **average rating**
- Movie detail page with:
  - Image
  - Actors
  - Average rating (MongoDB aggregation)
  - Reviews grid
- Submit reviews (username from JWT)
- **Search movies** by:
  - Partial title
  - Actor name (extra credit)
- Google Analytics tracking (extra credit- assignment 4)

---
## API Endpoints

### Auth
- `POST /signup`
- `POST /signin`

### Movies
- `GET /movies` → top-rated movies
- `GET /movies/:id` → movie + reviews + avgRating
- `POST /movies`
- `PUT /movies/:id`
- `DELETE /movies/:id`

### Reviews
- `POST /reviews`
- `GET /reviews/:movieId`

### Search (Extra Credit)
- `POST /movies/search`

Example:
```json
{
  "search": "leo"
}

## API URL
https://csc3916-assignment3-api.onrender.com

## Frontend URL
https://csc3916-assignment3-react-sam.onrender.com

## Postman Collection
https://www.postman.com/samreet-kaur-9185559/workspace/assignment3-samreet/environment/51992009-410b03e5-725b-4d70-871f-2085de6629e2?action=share&creator=51992009&active-environment=51992009-410b03e5-725b-4d70-871f-2085de6629e2
