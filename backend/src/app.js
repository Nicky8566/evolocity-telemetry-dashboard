import express from 'express';
import cors from 'cors';
import router from './routes/index.js';

const app = express();

// Middleware
app.use(cors()); 
app.use(express.json());

app.use((req, res, next) => {
  console.log(`INCOMING: ${req.method} ${req.url}`);
  next();
});

// Routes (all from api)
app.use('/api', router);

export default app;