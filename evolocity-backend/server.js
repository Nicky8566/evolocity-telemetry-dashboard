import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'EVolocity backend is currently running.' });
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});