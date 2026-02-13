import { Router } from 'express';
import { registerUser } from '../controllers/user.controller.js';
import { upload } from './../middlewares/multer.middleware.js';
import { registerValidator } from '../middlewares/auth.validator.js';

const router = Router();

router.route('/register').post(
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
  ]),
  registerValidator,
  registerUser,
);

export default router;
