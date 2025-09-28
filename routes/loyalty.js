const express = require('express');
const router = express.Router();
const LoyaltyProgram = require('../models/LoyaltyProgram');
const auth = require('../middleware/auth');
const {
  initializeLoyaltyProgram,
  awardPoints,
  redeemPoints,
  processReferral,
  POINTS_RULES,
  TIER_THRESHOLDS
} = require('../services/loyaltyService');

// @route   GET /api/loyalty/status
// @desc    Get user loyalty status
// @access  Private
router.get('/status', auth, async (req, res) => {
  try {
    let loyaltyProgram = await LoyaltyProgram.findOne({ userId: req.user.userId });

    if (!loyaltyProgram) {
      loyaltyProgram = await initializeLoyaltyProgram(req.user.userId);
    }

    res.json({
      success: true,
      data: loyaltyProgram
    });
  } catch (error) {
    console.error('Error fetching loyalty status:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   GET /api/loyalty/transactions
// @desc    Get loyalty transaction history
// @access  Private
router.get('/transactions', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;

    const loyaltyProgram = await LoyaltyProgram.findOne({ userId: req.user.userId });

    if (!loyaltyProgram) {
      return res.status(404).json({
        success: false,
        message: 'Loyalty program not found'
      });
    }

    let transactions = loyaltyProgram.transactions;

    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }

    // Sort by date (newest first)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedTransactions = transactions.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedTransactions,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(transactions.length / limit),
        total: transactions.length
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   POST /api/loyalty/redeem
// @desc    Redeem loyalty points
// @access  Private
router.post('/redeem', auth, async (req, res) => {
  try {
    const { points, rewardId, description } = req.body;

    if (!points || points <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid points amount'
      });
    }

    const loyaltyProgram = await redeemPoints(req.user.userId, points, {
      rewardId,
      description: description || 'Points redemption'
    });

    res.json({
      success: true,
      data: loyaltyProgram,
      message: `Successfully redeemed ${points} points`
    });
  } catch (error) {
    console.error('Error redeeming points:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/loyalty/referral
// @desc    Process referral
// @access  Private
router.post('/referral', auth, async (req, res) => {
  try {
    const { referralCode } = req.body;

    if (!referralCode) {
      return res.status(400).json({
        success: false,
        message: 'Referral code is required'
      });
    }

    // Find referrer by referral code
    const referrerProgram = await LoyaltyProgram.findOne({
      'referrals.code': referralCode
    });

    if (!referrerProgram) {
      return res.status(404).json({
        success: false,
        message: 'Invalid referral code'
      });
    }

    // Process referral
    const updatedProgram = await processReferral(referrerProgram.userId, req.user.userId);

    res.json({
      success: true,
      data: updatedProgram,
      message: 'Referral processed successfully'
    });
  } catch (error) {
    console.error('Error processing referral:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   GET /api/loyalty/rewards
// @desc    Get available rewards
// @access  Private
router.get('/rewards', auth, async (req, res) => {
  try {
    const loyaltyProgram = await LoyaltyProgram.findOne({ userId: req.user.userId });

    if (!loyaltyProgram) {
      return res.status(404).json({
        success: false,
        message: 'Loyalty program not found'
      });
    }

    // Define available rewards based on points and tier
    const availableRewards = [
      {
        id: 'free_delivery',
        name: 'Free Delivery',
        description: 'Free delivery on your next order',
        pointsCost: 200,
        tier: 'bronze'
      },
      {
        id: 'discount_10',
        name: '10% Discount',
        description: '10% off your next order',
        pointsCost: 500,
        tier: 'bronze'
      },
      {
        id: 'discount_15',
        name: '15% Discount',
        description: '15% off your next order',
        pointsCost: 750,
        tier: 'silver'
      },
      {
        id: 'free_appetizer',
        name: 'Free Appetizer',
        description: 'Free appetizer with any order',
        pointsCost: 300,
        tier: 'silver'
      },
      {
        id: 'discount_20',
        name: '20% Discount',
        description: '20% off your next order',
        pointsCost: 1000,
        tier: 'gold'
      },
      {
        id: 'free_meal',
        name: 'Free Meal',
        description: 'Free meal up to $25',
        pointsCost: 2500,
        tier: 'platinum'
      }
    ];

    // Filter rewards by tier and affordable points
    const currentTier = loyaltyProgram.tier.current;
    const currentPoints = loyaltyProgram.points.current;

    const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
    const userTierIndex = tierOrder.indexOf(currentTier);

    const eligibleRewards = availableRewards.filter(reward => {
      const rewardTierIndex = tierOrder.indexOf(reward.tier);
      return rewardTierIndex <= userTierIndex && reward.pointsCost <= currentPoints;
    });

    res.json({
      success: true,
      data: {
        available: eligibleRewards,
        userPoints: currentPoints,
        userTier: currentTier
      }
    });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   GET /api/loyalty/leaderboard
// @desc    Get points leaderboard
// @access  Private
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const leaderboard = await LoyaltyProgram.find({})
      .populate('userId', 'name avatar')
      .sort({ 'points.lifetime': -1 })
      .limit(parseInt(limit))
      .select('userId points.lifetime tier.current');

    // Find current user's rank
    const userProgram = await LoyaltyProgram.findOne({ userId: req.user.userId });
    let userRank = null;

    if (userProgram) {
      const higherRanked = await LoyaltyProgram.countDocuments({
        'points.lifetime': { $gt: userProgram.points.lifetime }
      });
      userRank = higherRanked + 1;
    }

    res.json({
      success: true,
      data: {
        leaderboard,
        userRank,
        userPoints: userProgram ? userProgram.points.lifetime : 0
      }
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   GET /api/loyalty/rules
// @desc    Get points rules and tier information
// @access  Public
router.get('/rules', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        pointsRules: POINTS_RULES,
        tierThresholds: TIER_THRESHOLDS,
        tiers: {
          bronze: {
            threshold: TIER_THRESHOLDS.bronze,
            benefits: ['Points on purchases'],
            multiplier: 1
          },
          silver: {
            threshold: TIER_THRESHOLDS.silver,
            benefits: ['5% bonus points', 'Early access to promotions'],
            multiplier: 1.05
          },
          gold: {
            threshold: TIER_THRESHOLDS.gold,
            benefits: ['10% bonus points', 'Free delivery on orders over $20', 'Priority support'],
            multiplier: 1.1
          },
          platinum: {
            threshold: TIER_THRESHOLDS.platinum,
            benefits: ['15% bonus points', 'Free delivery on all orders', 'Exclusive offers', 'Personal account manager'],
            multiplier: 1.15
          }
        }
      }
    });
  } catch (error) {
    console.error('Error fetching loyalty rules:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

module.exports = router;