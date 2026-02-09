// require('dotenv').config({ path: './.env' });
import dotenv from 'dotenv';
import { connectDB } from './db/index.js';
import app from './app.js';

dotenv.config({ path: './.env' });

connectDB()
  .then(() => {
    app.on('error', (error) => {
      console.error('Server error: ', error);
      throw error;
    });
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((error) => {
    console.log('Error in DB Connection Failed: ', error);
  });

//
