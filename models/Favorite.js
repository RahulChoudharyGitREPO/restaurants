const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant'
  },
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem'
  },
  type: {
    type: String,
    enum: ['restaurant', 'menuItem'],
    required: true
  },
  tags: [{
    type: String
  }],
  notes: {
    type: String,
    maxLength: 200
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicates
favoriteSchema.index({ userId: 1, restaurantId: 1, menuItemId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);