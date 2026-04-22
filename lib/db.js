import mongoose from 'mongoose'

const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'majles'

if (!MONGO_URL) {
  throw new Error('MONGO_URL is not defined in environment')
}

let cached = global._mongooseCache

if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null }
}

export async function connectDB() {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGO_URL, {
        dbName: DB_NAME,
        bufferCommands: false,
      })
      .then((m) => m)
  }

  cached.conn = await cached.promise
  return cached.conn
}
