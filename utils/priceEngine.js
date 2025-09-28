const TAX_RATE = 0.08; // 8% tax
const SERVICE_FEE_RATE = 0.02; // 2% service fee

const calculateOrderTotal = ({ items, fees = {}, tip = 0, distanceKm = 0, promo = null }) => {
  // Calculate subtotal from items
  const subtotal = items.reduce((total, item) => {
    const itemPrice = item.price * item.quantity;
    const customizationPrice = (item.customizations || []).reduce(
      (customTotal, custom) => customTotal + (custom.price || 0),
      0
    );
    return total + itemPrice + customizationPrice;
  }, 0);

  // Base fees
  const deliveryFee = fees.deliveryFee || Math.max(2.99, distanceKm * 0.5);
  const serviceFee = fees.serviceFee || subtotal * SERVICE_FEE_RATE;

  // Calculate tax on subtotal + fees
  const taxableAmount = subtotal + serviceFee;
  const tax = taxableAmount * TAX_RATE;

  // Apply promo discount
  let discount = 0;
  if (promo && subtotal >= (promo.minOrderValue || 0)) {
    if (promo.discountType === 'percentage') {
      discount = subtotal * (promo.discountValue / 100);
      if (promo.maxDiscount) {
        discount = Math.min(discount, promo.maxDiscount);
      }
    } else if (promo.discountType === 'fixed') {
      discount = Math.min(promo.discountValue, subtotal);
    }
  }

  // Calculate final total
  const total = Math.max(0, subtotal + deliveryFee + serviceFee + tax + tip - discount);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    deliveryFee: Math.round(deliveryFee * 100) / 100,
    serviceFee: Math.round(serviceFee * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    tip: Math.round(tip * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    total: Math.round(total * 100) / 100
  };
};

const calculateDeliveryFee = (distanceKm, baseFee = 2.99) => {
  return Math.max(baseFee, distanceKm * 0.5);
};

const estimateDeliveryTime = (distanceKm, baseTimeMinutes = 25) => {
  const additionalTime = Math.floor(distanceKm * 3); // 3 minutes per km
  return baseTimeMinutes + additionalTime;
};

module.exports = {
  calculateOrderTotal,
  calculateDeliveryFee,
  estimateDeliveryTime,
  TAX_RATE,
  SERVICE_FEE_RATE
};