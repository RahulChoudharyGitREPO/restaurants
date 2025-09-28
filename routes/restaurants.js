const express = require('express');
const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');

const router = express.Router();

// Get restaurants with search and filter
router.get('/', async (req, res, next) => {
  try {
    const { q, tag, limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    let query = {};

    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { cuisine: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }

    if (tag) {
      query.tags = { $in: [tag] };
    }

    const restaurants = await Restaurant.find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ rating: -1 });

    const total = await Restaurant.countDocuments(query);

    res.json({
      restaurants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get single restaurant with menu
router.get('/:id', async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    const menuItems = await MenuItem.find({ restaurantId: req.params.id })
      .sort({ category: 1, name: 1 });

    res.json({
      restaurant,
      menuItems
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;