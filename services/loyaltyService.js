const LoyaltyProgram = require('../models/LoyaltyProgram');
const { sendLoyaltyNotification } = require('./notificationService');
const { v4: uuidv4 } = require('uuid');

// Points calculation rules
const POINTS_RULES = {
  orderComplete: 10, // Base points per order
  dollarSpent: 1, // Points per dollar spent
  review: 25, // Points for leaving a review
  referral: 500, // Points for successful referral
  birthday: 100, // Birthday bonus
  streakBonus: {
    7: 50, // 7 day streak bonus
    30: 200, // 30 day streak bonus
    365: 1000 // 1 year streak bonus
  }
};

// Tier thresholds
const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 1000,
  gold: 5000,
  platinum: 15000
};

const TIER_BENEFITS = {
  bronze: ['Points on purchases'],
  silver: ['5% bonus points', 'Early access to promotions'],
  gold: ['10% bonus points', 'Free delivery on orders over $20', 'Priority support'],
  platinum: ['15% bonus points', 'Free delivery on all orders', 'Exclusive offers', 'Personal account manager']
};

const initializeLoyaltyProgram = async (userId) => {
  try {
    const existingProgram = await LoyaltyProgram.findOne({ userId });
    if (existingProgram) return existingProgram;

    const loyaltyProgram = new LoyaltyProgram({
      userId,
      referrals: {
        code: generateReferralCode()
      }
    });

    await loyaltyProgram.save();
    return loyaltyProgram;
  } catch (error) {
    console.error('Error initializing loyalty program:', error);
    throw error;
  }
};

const generateReferralCode = () => {
  return `REF${uuidv4().substring(0, 8).toUpperCase()}`;
};

const awardPoints = async (userId, pointsData) => {
  try {
    let loyaltyProgram = await LoyaltyProgram.findOne({ userId });
    if (!loyaltyProgram) {
      loyaltyProgram = await initializeLoyaltyProgram(userId);
    }

    const { points, type, orderId, description, expiryDays = 365 } = pointsData;

    // Calculate tier bonus
    const tierMultiplier = getTierMultiplier(loyaltyProgram.tier.current);
    const finalPoints = Math.floor(points * tierMultiplier);

    // Add to points
    loyaltyProgram.points.current += finalPoints;
    loyaltyProgram.points.lifetime += finalPoints;

    // Add transaction record
    loyaltyProgram.transactions.push({
      type: 'earned',
      points: finalPoints,
      orderId,
      description: description || `${type} reward`,
      expiryDate: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
    });

    // Update tier if necessary
    await updateTier(loyaltyProgram);

    // Update streak if this is an order
    if (type === 'order_complete') {
      await updateStreak(loyaltyProgram);
    }

    await loyaltyProgram.save();

    // Send notification
    await sendLoyaltyNotification(userId, {
      points: finalPoints,
      totalPoints: loyaltyProgram.points.current
    });

    return loyaltyProgram;
  } catch (error) {
    console.error('Error awarding points:', error);
    throw error;
  }
};

const redeemPoints = async (userId, pointsToRedeem, rewardData) => {
  try {
    const loyaltyProgram = await LoyaltyProgram.findOne({ userId });
    if (!loyaltyProgram) {
      throw new Error('Loyalty program not found');
    }

    if (loyaltyProgram.points.current < pointsToRedeem) {
      throw new Error('Insufficient points');
    }

    // Deduct points
    loyaltyProgram.points.current -= pointsToRedeem;

    // Add transaction record
    loyaltyProgram.transactions.push({
      type: 'redeemed',
      points: -pointsToRedeem,
      description: rewardData.description || 'Points redeemed'
    });

    // Add reward if provided
    if (rewardData.rewardId) {
      loyaltyProgram.rewards.push({
        rewardId: rewardData.rewardId,
        code: generateRewardCode(),
        expiryDate: rewardData.expiryDate
      });
    }

    await loyaltyProgram.save();
    return loyaltyProgram;
  } catch (error) {
    console.error('Error redeeming points:', error);
    throw error;
  }
};

const generateRewardCode = () => {
  return `RWD${uuidv4().substring(0, 10).toUpperCase()}`;
};

const getTierMultiplier = (tier) => {
  const multipliers = {
    bronze: 1,
    silver: 1.05,
    gold: 1.1,
    platinum: 1.15
  };
  return multipliers[tier] || 1;
};

const updateTier = async (loyaltyProgram) => {
  const currentPoints = loyaltyProgram.points.lifetime;
  let newTier = 'bronze';

  if (currentPoints >= TIER_THRESHOLDS.platinum) {
    newTier = 'platinum';
  } else if (currentPoints >= TIER_THRESHOLDS.gold) {
    newTier = 'gold';
  } else if (currentPoints >= TIER_THRESHOLDS.silver) {
    newTier = 'silver';
  }

  if (newTier !== loyaltyProgram.tier.current) {
    loyaltyProgram.tier.current = newTier;
    loyaltyProgram.tier.benefits = TIER_BENEFITS[newTier];

    // Award tier upgrade bonus
    const bonusPoints = {
      silver: 100,
      gold: 250,
      platinum: 500
    };

    if (bonusPoints[newTier]) {
      loyaltyProgram.points.current += bonusPoints[newTier];
      loyaltyProgram.transactions.push({
        type: 'bonus',
        points: bonusPoints[newTier],
        description: `${newTier.charAt(0).toUpperCase() + newTier.slice(1)} tier upgrade bonus`
      });
    }
  }

  // Calculate points to next tier
  const nextTierThresholds = {
    bronze: TIER_THRESHOLDS.silver,
    silver: TIER_THRESHOLDS.gold,
    gold: TIER_THRESHOLDS.platinum,
    platinum: null
  };

  const nextThreshold = nextTierThresholds[newTier];
  loyaltyProgram.tier.pointsToNext = nextThreshold ? nextThreshold - currentPoints : 0;
};

const updateStreak = async (loyaltyProgram) => {
  const today = new Date();
  const lastOrderDate = loyaltyProgram.streaks.lastOrderDate;

  if (!lastOrderDate) {
    // First order
    loyaltyProgram.streaks.current = 1;
    loyaltyProgram.streaks.longest = 1;
  } else {
    const daysDifference = Math.floor((today - lastOrderDate) / (1000 * 60 * 60 * 24));

    if (daysDifference === 1) {
      // Consecutive day
      loyaltyProgram.streaks.current += 1;
      loyaltyProgram.streaks.longest = Math.max(
        loyaltyProgram.streaks.longest,
        loyaltyProgram.streaks.current
      );

      // Check for streak bonuses
      const streakBonuses = POINTS_RULES.streakBonus;
      if (streakBonuses[loyaltyProgram.streaks.current]) {
        const bonusPoints = streakBonuses[loyaltyProgram.streaks.current];
        loyaltyProgram.points.current += bonusPoints;
        loyaltyProgram.transactions.push({
          type: 'bonus',
          points: bonusPoints,
          description: `${loyaltyProgram.streaks.current} day streak bonus`
        });
      }
    } else if (daysDifference > 1) {
      // Streak broken
      loyaltyProgram.streaks.current = 1;
    }
    // daysDifference === 0 means same day, no change to streak
  }

  loyaltyProgram.streaks.lastOrderDate = today;
};

const processReferral = async (referrerUserId, newUserId) => {
  try {
    const referrerProgram = await LoyaltyProgram.findOne({ userId: referrerUserId });
    if (!referrerProgram) return;

    // Check if this user was already referred
    if (referrerProgram.referrals.referred.includes(newUserId)) {
      return;
    }

    // Add to referred list
    referrerProgram.referrals.referred.push(newUserId);

    // Award referral points
    const referralPoints = POINTS_RULES.referral;
    referrerProgram.points.current += referralPoints;
    referrerProgram.points.lifetime += referralPoints;
    referrerProgram.referrals.totalRewards += referralPoints;

    referrerProgram.transactions.push({
      type: 'earned',
      points: referralPoints,
      description: 'Referral bonus'
    });

    await referrerProgram.save();

    // Award bonus to new user as well
    await awardPoints(newUserId, {
      points: POINTS_RULES.referral / 2, // Half points for new user
      type: 'referral_signup',
      description: 'Welcome referral bonus'
    });

    return referrerProgram;
  } catch (error) {
    console.error('Error processing referral:', error);
    throw error;
  }
};

const expirePoints = async () => {
  try {
    const programs = await LoyaltyProgram.find({});

    for (const program of programs) {
      let pointsExpired = 0;
      const now = new Date();

      // Check for expired transactions
      program.transactions.forEach(transaction => {
        if (transaction.type === 'earned' &&
            transaction.expiryDate &&
            transaction.expiryDate < now &&
            !transaction.expired) {
          pointsExpired += transaction.points;
          transaction.expired = true;
        }
      });

      if (pointsExpired > 0) {
        program.points.current = Math.max(0, program.points.current - pointsExpired);

        program.transactions.push({
          type: 'expired',
          points: -pointsExpired,
          description: 'Points expired'
        });

        await program.save();
      }
    }

    console.log('Points expiration check completed');
  } catch (error) {
    console.error('Error expiring points:', error);
  }
};

module.exports = {
  initializeLoyaltyProgram,
  awardPoints,
  redeemPoints,
  processReferral,
  expirePoints,
  POINTS_RULES,
  TIER_THRESHOLDS
};