const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  image: {
    type: String
  },
  category: {
    type: String,
    required: true
  },
  tags: [{
    type: String
  }],
  nutritionInfo: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number
  },
  customizations: [{
    name: String,
    options: [{
      name: String,
      price: Number
    }]
  }],
  available: {
    type: Boolean,
    default: true
  },
  inventory: {
    quantity: { type: Number, default: 100 },
    lowStockThreshold: { type: Number, default: 10 },
    unlimitedStock: { type: Boolean, default: true }
  },
  ratings: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  popularity: {
    orderCount: { type: Number, default: 0 },
    score: { type: Number, default: 0 }
  },
  pricing: {
    basePrice: { type: Number, required: true },
    peakHourMultiplier: { type: Number, default: 1 },
    discountPercentage: { type: Number, default: 0 },
    validFrom: Date,
    validUntil: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MenuItem', menuItemSchema);