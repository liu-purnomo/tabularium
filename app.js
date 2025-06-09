import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
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
  })
);

app.use('/', syncRouter);

app.listen(PORT, () => {
  console.log(`🚀 Tabularium running at http://localhost:${PORT}`);
});
