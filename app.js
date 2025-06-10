import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './src/routes/auth-routes.js';
import { syncRouter } from './src/routes/sync-routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

import './src/jobs/scheduler.js';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: 'tabularium-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.alert = req.session.alert || null;
  res.locals.old = req.session.old || null;
  req.session.alert = null;
  req.session.old = null;
  next();
});

app.use('/', authRouter);
app.use('/', syncRouter);

app.listen(PORT, () => {
  console.log(`🚀 Tabularium running at http://localhost:${PORT}`);
});
