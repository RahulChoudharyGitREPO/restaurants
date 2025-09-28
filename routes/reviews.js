const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const auth = require('../middleware/auth');

// @route   POST /api/reviews
// @desc    Create a review
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { restaurantId, menuItemId, orderId, rating, comment, images } = req.body;

    // Check if user already reviewed this order
    const existingReview = await Review.findOne({
      userId: req.user._id,
      orderId
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this order'
      });
    }

    const review = new Review({
      userId: req.user._id,
      restaurantId,
      menuItemId,
      orderId,
      rating,
      comment,
      images: images || []
    });

    await review.save();

    // Update restaurant rating
    if (restaurantId) {
      await updateRestaurantRating(restaurantId);
    }

    // Update menu item rating
    if (menuItemId) {
      await updateMenuItemRating(menuItemId);
    }

    await review.populate('userId', 'name avatar');

    res.status(201).json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   GET /api/reviews/restaurant/:restaurantId
// @desc    Get restaurant reviews
// @access  Public
router.get('/restaurant/:restaurantId', async (req, res) => {
  try {
    const { rating, sortBy = 'date', page = 1, limit = 10 } = req.query;

    let query = { restaurantId: req.params.restaurantId };
    if (rating) query.rating = parseInt(rating);

    let sort = {};
    switch (sortBy) {
      case 'rating_high':
        sort.rating = -1;
        break;
      case 'rating_low':
        sort.rating = 1;
        break;
      case 'helpful':
        sort['helpful.count'] = -1;
        break;
      default:
        sort.createdAt = -1;
    }

    const reviews = await Review.find(query)
      .populate('userId', 'name avatar')
      .populate('menuItemId', 'name')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(query);

    // Get rating statistics
    const ratingStats = await Review.aggregate([
      { $match: { restaurantId: req.params.restaurantId } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: reviews,
      ratingStats,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   GET /api/reviews/menu-item/:menuItemId
// @desc    Get menu item reviews
// @access  Public
router.get('/menu-item/:menuItemId', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ menuItemId: req.params.menuItemId })
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments({ menuItemId: req.params.menuItemId });

    res.json({
      success: true,
      data: reviews,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching menu item reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   POST /api/reviews/:id/helpful
// @desc    Mark review as helpful
// @access  Private
router.post('/:id/helpful', auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user already marked as helpful
    const alreadyMarked = review.helpful.users.includes(req.user._id);

    if (alreadyMarked) {
      // Remove helpful mark
      review.helpful.users = review.helpful.users.filter(
        userId => !userId.equals(req.user._id)
      );
      review.helpful.count = Math.max(0, review.helpful.count - 1);
    } else {
      // Add helpful mark
      review.helpful.users.push(req.user._id);
      review.helpful.count += 1;
    }

    await review.save();

    res.json({
      success: true,
      data: {
        helpful: !alreadyMarked,
        count: review.helpful.count
      }
    });
  } catch (error) {
    console.error('Error updating helpful status:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   POST /api/reviews/:id/report
// @desc    Report a review
// @access  Private
router.post('/:id/report', auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user already reported
    const alreadyReported = review.reported.users.includes(req.user._id);

    if (!alreadyReported) {
      review.reported.users.push(req.user._id);
      review.reported.count += 1;
      await review.save();
    }

    res.json({
      success: true,
      message: 'Review reported successfully'
    });
  } catch (error) {
    console.error('Error reporting review:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   POST /api/reviews/:id/response
// @desc    Restaurant owner response to review
// @access  Private
router.post('/:id/response', auth, async (req, res) => {
  try {
    if (req.user.role !== 'restaurant_owner' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { text } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    review.response = {
      text,
      respondedAt: new Date(),
      respondedBy: req.user._id
    };

    await review.save();

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Error responding to review:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// Helper function to update restaurant rating
const updateRestaurantRating = async (restaurantId) => {
  try {
    const stats = await Review.aggregate([
      { $match: { restaurantId: restaurantId } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      await Restaurant.findByIdAndUpdate(restaurantId, {
        rating: parseFloat(stats[0].averageRating.toFixed(1)),
        reviewCount: stats[0].totalReviews
      });
    }
  } catch (error) {
    console.error('Error updating restaurant rating:', error);
  }
};

// Helper function to update menu item rating
const updateMenuItemRating = async (menuItemId) => {
  try {
    const stats = await Review.aggregate([
      { $match: { menuItemId: menuItemId } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      await MenuItem.findByIdAndUpdate(menuItemId, {
        'ratings.average': parseFloat(stats[0].averageRating.toFixed(1)),
        'ratings.count': stats[0].totalReviews
      });
    }
  } catch (error) {
    console.error('Error updating menu item rating:', error);
  }
};

module.exports = router;