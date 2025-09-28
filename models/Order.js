const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  items: [{
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true
    },
    name: String,
    price: Number,
    quantity: Number,
    customizations: [{
      name: String,
      selectedOption: String,
      price: Number
    }]
  }],
  address: {
    street: String,
    city: String,
    zipCode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  pricing: {
    subtotal: Number,
    deliveryFee: Number,
    serviceFee: Number,
    tax: Number,
    tip: Number,
    discount: Number,
    total: Number
  },
  promoCode: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'pending'
  },
  estimatedDeliveryTime: {
    type: Date
  },
  actualDeliveryTime: {
    type: Date
  },
  specialInstructions: {
    type: String
  },
  scheduling: {
    isScheduled: { type: Boolean, default: false },
    scheduledFor: Date,
    timezone: String
  },
  delivery: {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
    status: { type: String, enum: ['assigned', 'picked_up', 'on_the_way', 'delivered'], default: 'assigned' },
    trackingHistory: [{
      status: String,
      timestamp: { type: Date, default: Date.now },
      location: {
        latitude: Number,
        longitude: Number
      },
      notes: String
    }],
    estimatedArrival: Date,
    contactAttempts: [{ timestamp: Date, method: String, successful: Boolean }]
  },
  groupOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupOrder'
  },
  loyaltyPoints: {
    earned: { type: Number, default: 0 },
    redeemed: { type: Number, default: 0 }
  },
  rating: {
    food: { type: Number, min: 1, max: 5 },
    delivery: { type: Number, min: 1, max: 5 },
    overall: { type: Number, min: 1, max: 5 },
    comment: String,
    ratedAt: Date
  },
  refund: {
    requested: { type: Boolean, default: false },
    reason: String,
    amount: Number,
    status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
    processedAt: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);