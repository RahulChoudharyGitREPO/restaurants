const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    trim: true
  },
  avatar: {
    type: String
  },
  addresses: [{
    label: String,
    street: String,
    city: String,
    state: String,
    zipCode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    isDefault: { type: Boolean, default: false }
  }],
  preferences: {
    cuisineTypes: [String],
    dietaryRestrictions: [String],
    spiceLevel: { type: String, enum: ['mild', 'medium', 'hot', 'extra_hot'] },
    notifications: {
      orderUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: true },
      newsletter: { type: Boolean, default: false }
    }
  },
  socialAuth: {
    googleId: String,
    facebookId: String,
    appleId: String
  },
  deviceTokens: [String], // For push notifications
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['customer', 'restaurant_owner', 'admin', 'driver'],
    default: 'customer'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);