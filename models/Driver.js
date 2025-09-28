const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  vehicle: {
    type: { type: String, enum: ['bike', 'scooter', 'car', 'bicycle'], required: true },
    licensePlate: String,
    model: String,
    color: String
  },
  documents: {
    drivingLicense: {
      number: String,
      expiryDate: Date,
      verified: { type: Boolean, default: false }
    },
    vehicleRegistration: {
      number: String,
      expiryDate: Date,
      verified: { type: Boolean, default: false }
    }
  },
  status: {
    type: String,
    enum: ['offline', 'online', 'busy', 'inactive'],
    default: 'offline'
  },
  currentLocation: {
    latitude: Number,
    longitude: Number,
    lastUpdated: Date
  },
  deliveryZones: [{
    type: String
  }],
  ratings: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  earnings: {
    today: { type: Number, default: 0 },
    thisWeek: { type: Number, default: 0 },
    thisMonth: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  performance: {
    deliveriesCompleted: { type: Number, default: 0 },
    onTimeDeliveries: { type: Number, default: 0 },
    averageDeliveryTime: { type: Number, default: 0 },
    customerRating: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Driver', driverSchema);