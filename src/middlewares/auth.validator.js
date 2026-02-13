import { validateRegisterUser } from '../utils/user.validation.js';

export const registerValidator = (req, res, next) => {
  validateRegisterUser(req.body); // error ho to yahin throw hoga
  next(); // sab theek → controller chalega
};
