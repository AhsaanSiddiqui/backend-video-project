import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(
  express.json({
    limit: '1mb',
  }),
);
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static('public'));
app.use(cookieParser());

// routes import
import userRouter from './routes/user.routes.js';
import videoRouter from './routes/video.routes.js';
import commentRouter from './routes/comment.routes.js';
import likeRouter from './routes/like.routes.js';
import tweetRouter from './routes/tweet.routes.js';
import playlistRouter from './routes/playlist.routes.js';
import subscriptionRouter from './routes/subscription.routes.js';
import healthcheckRouter from './routes/healthcheck.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';
import { ApiError } from './utils/ApiError.js';

// routes declaration
app.use('/api/v1/healthcheck', healthcheckRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/videos', videoRouter);
app.use('/api/v1/comments', commentRouter);
app.use('/api/v1/likes', likeRouter);
app.use('/api/v1/tweets', tweetRouter);
app.use('/api/v1/playlists', playlistRouter);
app.use('/api/v1/subscriptions', subscriptionRouter);

// http://localhost:8000/api/v1/users/register

app.use((err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  return res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

export default app;
