import { validateRegisterUser } from '../utils/user.validation.js';

export const registerValidator = (req, res, next) => {
  // validateRegisterUser(req.body); // error ho to yahin throw hoga
  // next(); // sab theek → controller chalega
  try {
    const sanitized = validateRegisterUser(req.body);
    req.body = { ...req.body, ...sanitized }; // normalized fields forward karo
    next();
  } catch (error) {
    next(error); // error middleware ko do
  }
};
