// Utility for Billing Calculations

/**
 * Calculates prorate information for Fixed Date billing.
 * 
 * @param {number} fixedDate 1-31
 * @param {number} monthlyPrice The full price for 1 month
 * @returns {object} { proratePrice, prorateDays, nextExpiryDate }
 */
function calculateProrate(fixedDate, monthlyPrice) {
  const now = new Date();
  let nextExpiry = new Date(now.getFullYear(), now.getMonth(), fixedDate);

  // If the target date has already passed this month, or is today, the next expiry is next month
  // Wait, if today is the 10th and fixedDate is the 15th, nextExpiry is 15th of THIS month.
  // If today is the 16th and fixedDate is the 15th, nextExpiry is 15th of NEXT month.
  if (nextExpiry <= now) {
    nextExpiry.setMonth(nextExpiry.getMonth() + 1);
  }

  // To avoid weird times, set time to current time or start of day?
  // Since other logic uses NOW(), let's just use current time on the target date.
  
  const diffTime = nextExpiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Prorate formula: (Price / 30) * diffDays
  let proratePrice = Math.round((monthlyPrice / 30) * diffDays);
  
  // Optionally, round to nearest 100 or 1000. Let's round to nearest 100 for a realistic Indonesian billing.
  proratePrice = Math.round(proratePrice / 100) * 100;

  // Edge case: if prorate is somehow higher than monthly price, cap it.
  // Actually, sometimes the month has 31 days and prorate > monthlyPrice. Let's cap at monthlyPrice.
  if (proratePrice > monthlyPrice) {
    proratePrice = monthlyPrice;
  }

  return {
    proratePrice,
    prorateDays: diffDays,
    nextExpiryDate: nextExpiry
  };
}

module.exports = {
  calculateProrate
};
