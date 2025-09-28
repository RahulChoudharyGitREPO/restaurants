const express = require('express');
const router = express.Router();
const Favorite = require('../models/Favorite');
const auth = require('../middleware/auth');

// @route   GET /api/favorites
// @desc    Get user favorites
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { type } = req.query;

    let query = { userId: req.user.userId };
    if (type) query.type = type;

    const favorites = await Favorite.find(query)
      .populate('restaurantId', 'name image cuisine rating deliveryTime deliveryFee')
      .populate('menuItemId', 'name image price category restaurantId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: favorites
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   POST /api/favorites
// @desc    Add to favorites
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { type, restaurantId, menuItemId, notes, tags } = req.body;

    // Check if already in favorites
    let query = { userId: req.user.userId };
    if (type === 'restaurant') {
      query.restaurantId = restaurantId;
    } else {
      query.menuItemId = menuItemId;
    }

    const existingFavorite = await Favorite.findOne(query);

    if (existingFavorite) {
      return res.status(400).json({
        success: false,
        message: 'Item already in favorites'
      });
    }

    const favorite = new Favorite({
      userId: req.user.userId,
      type,
      restaurantId: type === 'restaurant' ? restaurantId : undefined,
      menuItemId: type === 'menuItem' ? menuItemId : undefined,
      notes,
      tags: tags || []
    });

    await favorite.save();

    await favorite.populate('restaurantId', 'name image cuisine rating');
    await favorite.populate('menuItemId', 'name image price category');

    res.status(201).json({
      success: true,
      data: favorite
    });
  } catch (error) {
    console.error('Error adding to favorites:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   PUT /api/favorites/:id
// @desc    Update favorite
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { notes, tags } = req.body;

    const favorite = await Favorite.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { notes, tags },
      { new: true, runValidators: true }
    )
      .populate('restaurantId', 'name image cuisine rating')
      .populate('menuItemId', 'name image price category');

    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: 'Favorite not found'
      });
    }

    res.json({
      success: true,
      data: favorite
    });
  } catch (error) {
    console.error('Error updating favorite:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   DELETE /api/favorites/:id
// @desc    Remove from favorites
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const favorite = await Favorite.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: 'Favorite not found'
      });
    }

    res.json({
      success: true,
      message: 'Removed from favorites'
    });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   DELETE /api/favorites/remove
// @desc    Remove specific item from favorites
// @access  Private
router.delete('/remove', auth, async (req, res) => {
  try {
    const { type, restaurantId, menuItemId } = req.body;

    let query = { userId: req.user.userId };
    if (type === 'restaurant') {
      query.restaurantId = restaurantId;
    } else {
      query.menuItemId = menuItemId;
    }

    const favorite = await Favorite.findOneAndDelete(query);

    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: 'Item not in favorites'
      });
    }

    res.json({
      success: true,
      message: 'Removed from favorites'
    });
  } catch (error) {
    console.error('Error removing from favorites:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   GET /api/favorites/check
// @desc    Check if item is in favorites
// @access  Private
router.get('/check', auth, async (req, res) => {
  try {
    const { type, restaurantId, menuItemId } = req.query;

    let query = { userId: req.user.userId };
    if (type === 'restaurant') {
      query.restaurantId = restaurantId;
    } else {
      query.menuItemId = menuItemId;
    }

    const favorite = await Favorite.findOne(query);

    res.json({
      success: true,
      isFavorite: !!favorite,
      favoriteId: favorite ? favorite._id : null
    });
  } catch (error) {
    console.error('Error checking favorite status:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

module.exports = router;