require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const Indexer = require('./services/indexer');
const ThumbnailGenerationService = require('./services/thumbnailGenerator');

const startServer = async () => {
  try {
    const app = express();
    const port = process.env.PORT || 3001;

    // Add JSON body parsing middleware
    app.use(express.json());

    // Serve static files from public directory
    app.use(express.static(path.join(__dirname, 'public')));

    console.log('Connecting to MongoDB...');
    const client = await MongoClient.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    const db = client.db();
    app.locals.db = db;
    
    // Create and attach indexer instance
    app.locals.indexer = new Indexer(db);

    // Initialize thumbnail generator
    const thumbnailGenerator = new ThumbnailGenerationService(db);
    await thumbnailGenerator.start();
    app.locals.thumbnailGenerator = thumbnailGenerator;

    // Routes
    app.use('/media', require('./routes/media'));
    app.use('/admin', require('./routes/admin'));

    // Serve index.html for root route
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Basic error handler
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ error: err.message || 'Something went wrong!' });
    });
    
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  }
};

startServer();

module.exports = { startServer };