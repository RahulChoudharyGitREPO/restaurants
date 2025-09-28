const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  cuisine: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    default: 4.0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  deliveryTime: {
    type: String,
    default: '25-35 min'
  },
  deliveryFee: {
    type: Number,
    default: 2.99
  },
  minimumOrder: {
    type: Number,
    default: 15.00
  },
  tags: [{
    type: String
  }],
  address: {
    street: String,
    city: String,
    zipCode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  phone: {
    type: String
  },
  hours: {
    open: String,
    close: String
  },
  isOpen: {
    type: Boolean,
    default: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  locations: [{
    name: String,
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
    phone: String,
    hours: {
      monday: { open: String, close: String, closed: Boolean },
      tuesday: { open: String, close: String, closed: Boolean },
      wednesday: { open: String, close: String, closed: Boolean },
      thursday: { open: String, close: String, closed: Boolean },
      friday: { open: String, close: String, closed: Boolean },
      saturday: { open: String, close: String, closed: Boolean },
      sunday: { open: String, close: String, closed: Boolean }
    },
    deliveryZones: [String],
    isActive: { type: Boolean, default: true }
  }],
  businessInfo: {
    licenseNumber: String,
    taxId: String,
    businessType: { type: String, enum: ['restaurant', 'cafe', 'food_truck', 'cloud_kitchen'] },
    yearEstablished: Number
  },
  analytics: {
    totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    popularItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }]
  },
  promotions: [{
    title: String,
    description: String,
    discountType: { type: String, enum: ['percentage', 'fixed'] },
    discountValue: Number,
    validFrom: Date,
    validUntil: Date,
    isActive: { type: Boolean, default: true }
  }],
  socialMedia: {
    website: String,
    facebook: String,
    instagram: String,
    twitter: String
  },
  settings: {
    acceptsPreOrders: { type: Boolean, default: true },
    maxPreOrderDays: { type: Number, default: 7 },
    preparationTime: { type: Number, default: 20 }, // in minutes
    capacity: {
      ordersPerHour: { type: Number, default: 30 },
      maxConcurrentOrders: { type: Number, default: 50 }
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Restaurant', restaurantSchema);