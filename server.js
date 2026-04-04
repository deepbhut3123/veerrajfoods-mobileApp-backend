const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const publicRoutes = require('./routes/publicRoutes');
const adminRoutes = require('./routes/adminRoutes');
const shopRoutes = require('./routes/shopRoutes');

dotenv.config();

const app = express();

connectDB();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/shops', shopRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
