const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const Review = require('../models/Review');
const MenuItem = require('../models/MenuItem');
const auth = require('../middleware/auth');

// @route   GET /api/analytics/restaurant/:id
// @desc    Get restaurant analytics
// @access  Private (Restaurant Owner)
router.get('/restaurant/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'restaurant_owner' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { startDate, endDate, metric } = req.query;
    const restaurantId = req.params.id;

    // Date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = { createdAt: { $gte: thirtyDaysAgo } };
    }

    const orderFilter = {
      restaurantId,
      status: { $ne: 'cancelled' },
      ...dateFilter
    };

    // Revenue Analytics
    const revenueData = await Order.aggregate([
      { $match: orderFilter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          totalRevenue: { $sum: '$pricing.total' },
          orderCount: { $sum: 1 },
          averageOrderValue: { $avg: '$pricing.total' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Popular Items
    const popularItems = await Order.aggregate([
      { $match: orderFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.menuItemId',
          name: { $first: '$items.name' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]);

    // Order Status Distribution
    const orderStatusData = await Order.aggregate([
      { $match: { restaurantId, ...dateFilter } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Peak Hours Analysis
    const peakHours = await Order.aggregate([
      { $match: orderFilter },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          orderCount: { $sum: 1 },
          revenue: { $sum: '$pricing.total' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Customer Analytics
    const customerData = await Order.aggregate([
      { $match: orderFilter },
      {
        $group: {
          _id: '$userId',
          orderCount: { $sum: 1 },
          totalSpent: { $sum: '$pricing.total' }
        }
      },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          avgOrdersPerCustomer: { $avg: '$orderCount' },
          avgSpentPerCustomer: { $avg: '$totalSpent' }
        }
      }
    ]);

    // Rating Analytics
    const ratingData = await Review.aggregate([
      { $match: { restaurantId, ...dateFilter } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ]);

    // Calculate rating distribution
    let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (ratingData[0]?.ratingDistribution) {
      ratingData[0].ratingDistribution.forEach(rating => {
        ratingDistribution[rating]++;
      });
    }

    // Summary metrics
    const totalOrders = await Order.countDocuments(orderFilter);
    const totalRevenue = await Order.aggregate([
      { $match: orderFilter },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]);

    const summary = {
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      averageOrderValue: totalRevenue[0]?.total ? (totalRevenue[0].total / totalOrders).toFixed(2) : 0,
      totalCustomers: customerData[0]?.totalCustomers || 0,
      averageRating: ratingData[0]?.averageRating?.toFixed(1) || 0,
      totalReviews: ratingData[0]?.totalReviews || 0
    };

    res.json({
      success: true,
      data: {
        summary,
        revenueData,
        popularItems,
        orderStatusData,
        peakHours,
        customerData: customerData[0] || {},
        ratingData: {
          average: ratingData[0]?.averageRating?.toFixed(1) || 0,
          total: ratingData[0]?.totalReviews || 0,
          distribution: ratingDistribution
        }
      }
    });
  } catch (error) {
    console.error('Error fetching restaurant analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   GET /api/analytics/driver
// @desc    Get driver analytics
// @access  Private (Driver)
router.get('/driver', auth, async (req, res) => {
  try {
    if (req.user.role !== 'driver' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = { createdAt: { $gte: thirtyDaysAgo } };
    }

    const deliveryFilter = {
      'delivery.driverId': req.user.userId,
      status: 'delivered',
      ...dateFilter
    };

    // Delivery Analytics
    const deliveryData = await Order.aggregate([
      { $match: deliveryFilter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          deliveries: { $sum: 1 },
          totalEarnings: { $sum: '$pricing.deliveryFee' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Performance Metrics
    const performanceData = await Order.aggregate([
      { $match: deliveryFilter },
      {
        $group: {
          _id: null,
          totalDeliveries: { $sum: 1 },
          averageDeliveryTime: {
            $avg: {
              $divide: [
                { $subtract: ['$actualDeliveryTime', '$createdAt'] },
                1000 * 60 // Convert to minutes
              ]
            }
          },
          totalEarnings: { $sum: '$pricing.deliveryFee' }
        }
      }
    ]);

    // Peak Hours for Driver
    const driverPeakHours = await Order.aggregate([
      { $match: deliveryFilter },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          deliveries: { $sum: 1 },
          earnings: { $sum: '$pricing.deliveryFee' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        summary: performanceData[0] || {
          totalDeliveries: 0,
          averageDeliveryTime: 0,
          totalEarnings: 0
        },
        deliveryData,
        peakHours: driverPeakHours
      }
    });
  } catch (error) {
    console.error('Error fetching driver analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   GET /api/analytics/admin
// @desc    Get admin analytics
// @access  Private (Admin only)
router.get('/admin', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = { createdAt: { $gte: thirtyDaysAgo } };
    }

    // Platform Overview
    const platformStats = await Promise.all([
      // Total orders
      Order.countDocuments(dateFilter),
      // Total revenue
      Order.aggregate([
        { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$pricing.total' } } }
      ]),
      // Total users
      User.countDocuments(dateFilter),
      // Total restaurants
      Restaurant.countDocuments(dateFilter),
      // Active restaurants (with orders)
      Order.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$restaurantId' } },
        { $count: 'activeRestaurants' }
      ])
    ]);

    // Growth Analytics
    const growthData = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            week: { $week: '$createdAt' }
          },
          orders: { $sum: 1 },
          revenue: { $sum: '$pricing.total' },
          uniqueCustomers: { $addToSet: '$userId' }
        }
      },
      {
        $addFields: {
          uniqueCustomerCount: { $size: '$uniqueCustomers' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } }
    ]);

    // Top Performing Restaurants
    const topRestaurants = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$restaurantId',
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.total' },
          averageOrderValue: { $avg: '$pricing.total' }
        }
      },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id',
          foreignField: '_id',
          as: 'restaurant'
        }
      },
      { $unwind: '$restaurant' },
      {
        $project: {
          name: '$restaurant.name',
          totalOrders: 1,
          totalRevenue: 1,
          averageOrderValue: 1
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

    // User Acquisition
    const userAcquisition = await User.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          newUsers: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Order Status Distribution
    const orderStatusDistribution = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        platformStats: {
          totalOrders: platformStats[0],
          totalRevenue: platformStats[1][0]?.total || 0,
          totalUsers: platformStats[2],
          totalRestaurants: platformStats[3],
          activeRestaurants: platformStats[4][0]?.activeRestaurants || 0
        },
        growthData,
        topRestaurants,
        userAcquisition,
        orderStatusDistribution
      }
    });
  } catch (error) {
    console.error('Error fetching admin analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   GET /api/analytics/menu-performance/:restaurantId
// @desc    Get menu item performance analytics
// @access  Private (Restaurant Owner)
router.get('/menu-performance/:restaurantId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'restaurant_owner' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { startDate, endDate } = req.query;
    const restaurantId = req.params.restaurantId;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    // Menu item performance
    const menuPerformance = await Order.aggregate([
      {
        $match: {
          restaurantId,
          status: { $ne: 'cancelled' },
          ...dateFilter
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.menuItemId',
          itemName: { $first: '$items.name' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          orderCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'menuitems',
          localField: '_id',
          foreignField: '_id',
          as: 'menuItem'
        }
      },
      { $unwind: { path: '$menuItem', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          itemName: { $ifNull: ['$menuItem.name', '$itemName'] },
          category: '$menuItem.category',
          totalQuantity: 1,
          totalRevenue: 1,
          orderCount: 1,
          averagePrice: { $divide: ['$totalRevenue', '$totalQuantity'] }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json({
      success: true,
      data: menuPerformance
    });
  } catch (error) {
    console.error('Error fetching menu performance:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

module.exports = router;