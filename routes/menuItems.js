const express = require('express');
const router = express.Router();
const MenuItem = require('../models/MenuItem');
const auth = require('../middleware/auth');

// @route   GET /api/menu-items
// @desc    Get menu items with filtering
// @access  Public
router.get('/', async (req, res) => {
  try {
    const {
      restaurantId,
      category,
      search,
      minPrice,
      maxPrice,
      available,
      sortBy,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    let query = {};

    if (restaurantId) query.restaurantId = restaurantId;
    if (category) query.category = new RegExp(category, 'i');
    if (available !== undefined) query.available = available === 'true';

    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Build sort
    let sort = {};
    switch (sortBy) {
      case 'price_low':
        sort.price = 1;
        break;
      case 'price_high':
        sort.price = -1;
        break;
      case 'rating':
        sort['ratings.average'] = -1;
        break;
      case 'popularity':
        sort['popularity.score'] = -1;
        break;
      default:
        sort.createdAt = -1;
    }

    const items = await MenuItem.find(query)
      .populate('restaurantId', 'name cuisine image')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await MenuItem.countDocuments(query);

    res.json({
      success: true,
      data: items,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   GET /api/menu-items/search
// @desc    Advanced search menu items
// @access  Public
router.get('/search', async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, tags } = req.query;

    let query = {};

    if (q) {
      query.$text = { $search: q };
    }

    if (category) query.category = new RegExp(category, 'i');

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    if (tags) {
      const tagArray = tags.split(',');
      query.tags = { $in: tagArray };
    }

    const items = await MenuItem.find(query)
      .populate('restaurantId', 'name cuisine image')
      .sort({ score: { $meta: 'textScore' } })
      .limit(50);

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error searching menu items:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   GET /api/menu-items/popular
// @desc    Get popular menu items
// @access  Public
router.get('/popular', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const items = await MenuItem.find({ available: true })
      .populate('restaurantId', 'name cuisine image')
      .sort({ 'popularity.score': -1, 'ratings.average': -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error fetching popular items:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   GET /api/menu-items/:id
// @desc    Get single menu item
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id)
      .populate('restaurantId');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   POST /api/menu-items
// @desc    Create menu item (Restaurant Owner only)
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'restaurant_owner' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const menuItem = new MenuItem({
      ...req.body,
      'pricing.basePrice': req.body.price
    });

    await menuItem.save();

    res.status(201).json({
      success: true,
      data: menuItem
    });
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   PUT /api/menu-items/:id
// @desc    Update menu item
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'restaurant_owner' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    res.json({
      success: true,
      data: menuItem
    });
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

module.exports = router;