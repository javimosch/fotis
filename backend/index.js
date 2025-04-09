require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const Indexer = require('./services/indexer');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Connect to MongoDB and start server
async function startServer() {
  try {
    console.log('Connecting to MongoDB...');
    const client = await MongoClient.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    const db = client.db();
    app.locals.db = db;
    
    // Create and attach indexer instance
    app.locals.indexer = new Indexer(db);

    // Routes
    app.use('/media', require('./routes/media'));
    app.use('/admin', require('./routes/admin'));

    // Basic error handler
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ error: 'Something went wrong!' });
    });
    
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  }
}

startServer();