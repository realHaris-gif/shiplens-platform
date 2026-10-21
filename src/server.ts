import app from './app';
import dotenv from 'dotenv';
import { runMigrations } from './db/migrate';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  try {
    // Run schema migrations prior to listening
    await runMigrations();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`ShipLens server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server due to migration error:', error);
    process.exit(1);
  }
}

startServer();