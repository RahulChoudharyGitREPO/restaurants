const mongoose = require('mongoose');

const loyaltyProgramSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  points: {
    current: { type: Number, default: 0 },
    lifetime: { type: Number, default: 0 },
    pending: { type: Number, default: 0 }
  },
  tier: {
    current: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
    pointsToNext: { type: Number, default: 1000 },
    benefits: [{
      type: String
    }]
  },
  transactions: [{
    type: { type: String, enum: ['earned', 'redeemed', 'expired', 'bonus'] },
    points: Number,
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    description: String,
    date: { type: Date, default: Date.now },
    expiryDate: Date
  }],
  rewards: [{
    rewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward' },
    status: { type: String, enum: ['available', 'redeemed', 'expired'], default: 'available' },
    redeemedAt: Date,
    expiryDate: Date,
    code: String
  }],
  referrals: {
    code: { type: String, unique: true },
    referred: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    totalRewards: { type: Number, default: 0 }
  },
  streaks: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastOrderDate: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LoyaltyProgram', loyaltyProgramSchema);