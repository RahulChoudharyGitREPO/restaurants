const mongoose = require('mongoose');

const groupOrderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  status: {
    type: String,
    enum: ['collecting', 'ready_to_order', 'ordered', 'completed', 'cancelled'],
    default: 'collecting'
  },
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: [{
      menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
      quantity: Number,
      customizations: [{
        name: String,
        selectedOption: String,
        price: Number
      }],
      specialInstructions: String,
      price: Number
    }],
    subtotal: Number,
    joinedAt: { type: Date, default: Date.now },
    hasPaid: { type: Boolean, default: false }
  }],
  settings: {
    deadline: Date,
    maxParticipants: { type: Number, default: 20 },
    allowItemChanges: { type: Boolean, default: true },
    splitDeliveryFee: { type: Boolean, default: true },
    requireApproval: { type: Boolean, default: false }
  },
  delivery: {
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    instructions: String,
    fee: Number
  },
  totals: {
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    tips: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  inviteCode: {
    type: String,
    unique: true
  },
  chat: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('GroupOrder', groupOrderSchema);