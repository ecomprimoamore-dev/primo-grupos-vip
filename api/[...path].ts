// This catch-all Node function gives the Express API a concrete Vercel route.
// The Vite output remains static while every /api/* request reaches Express.
import app from '../server';

export default app;
