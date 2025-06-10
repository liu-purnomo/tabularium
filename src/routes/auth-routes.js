import dotenv from 'dotenv';
import express from 'express';
import { redirectIfLoggedIn } from '../middleware/redirect-if-logged-in.js';

dotenv.config();

export const authRouter = express.Router();

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

authRouter.post('/login', redirectIfLoggedIn, (req, res) => {
  const { email, password } = req.body;

  if (email !== adminEmail || password !== adminPassword) {
    req.session.alert = '❌ Invalid email or password';
    req.session.old = { email };
    return res.redirect('/login');
  }

  req.session.user = { email };
  res.redirect('/');
});

authRouter.get('/login', redirectIfLoggedIn, (req, res) => {
  res.render('login', {
    old: req.session.old || {},
  });
  req.session.old = null;
});
