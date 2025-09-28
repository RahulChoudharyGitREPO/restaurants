const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planType: {
    type: String,
    enum: ['basic', 'premium', 'family', 'corporate'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'cancelled', 'expired'],
    default: 'active'
  },
  benefits: {
    freeDelivery: { type: Boolean, default: false },
    discountPercentage: { type: Number, default: 0 },
    prioritySupport: { type: Boolean, default: false },
    exclusiveOffers: { type: Boolean, default: false },
    maxOrdersPerMonth: { type: Number, default: -1 }, // -1 for unlimited
    bonusPoints: { type: Number, default: 0 }
  },
  pricing: {
    monthlyFee: { type: Number, required: true },
    yearlyFee: Number,
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' }
  },
  usage: {
    ordersThisMonth: { type: Number, default: 0 },
    savedOnDelivery: { type: Number, default: 0 },
    discountsUsed: { type: Number, default: 0 }
  },
  billing: {
    nextBillingDate: Date,
    lastBilledDate: Date,
    autoRenew: { type: Boolean, default: true }
  },
  trial: {
    isTrialActive: { type: Boolean, default: false },
    trialStartDate: Date,
    trialEndDate: Date,
    trialUsed: { type: Boolean, default: false }
  },
  family: {
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    maxMembers: { type: Number, default: 1 },
    inviteCode: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Subscription', subscriptionSchema);